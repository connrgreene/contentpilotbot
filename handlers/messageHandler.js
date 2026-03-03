const { getPage, logReview, logCorrection, getRecentCorrections } = require("../supabase");
const { getOrgContext, analyzeVisual } = require("../claude");
const { isContentSubmission, isFeedbackCorrection } = require("../checks/classifier");
const { factCheck }      = require("../checks/factCheck");
const { copyrightCheck } = require("../checks/copyrightCheck");
const { fitCheck }       = require("../checks/fitCheck");
const { extractVideoFrames, getPhotoBase64, downloadTelegramFile } = require("../media");
const { extractInstagramUrl, enrichInstagramLink } = require("../instagram");

// Dedup — avoid processing the same message twice
const reviewed = new Set();

async function handleMessage(ctx) {
  try {
    const msg = ctx.message;
    if (msg.from?.is_bot) return;

    // ── Human feedback: reply to a bot review ────────────────────────────────
    if (msg.reply_to_message?.from?.is_bot) {
      const chatId = ctx.chat.id;
      const page   = await getPage(chatId);
      if (page) {
        await logCorrection({
          chatId,
          handle:            page.handle,
          botReviewSnippet:  msg.reply_to_message.text,
          correctionText:    msg.text || msg.caption,
        });
        console.log(`[feedback] stored correction for ${page.handle}`);
      }
      return; // Don't treat feedback as a new submission
    }

    // Accept both plain text messages and media messages with a caption
    const text = msg.text || msg.caption;
    if (!text) return;
    if (text.startsWith("/")) return;
    if (reviewed.has(msg.message_id)) return;

    reviewed.add(msg.message_id);
    if (reviewed.size > 500) reviewed.delete(reviewed.values().next().value);

    const chatId = ctx.chat.id;
    console.log(`[msg] chatId=${chatId} textLen=${text.length}`);

    // ── Is this chat registered? ──────────────────────────────────────────────
    const page = await getPage(chatId);
    if (!page) {
      console.log(`[msg] no page found for chatId=${chatId} — skipping`);
      return;
    }

    // ── Instagram link shortcut — enrich and skip classifier ─────────────────
    let instagramContext = "";
    let igImageBase64 = null;
    const igUrl = extractInstagramUrl(text);
    if (igUrl) {
      console.log(`[ig] enriching ${igUrl}`);
      const enriched = await enrichInstagramLink(igUrl);
      instagramContext = enriched.context;
      igImageBase64    = enriched.imageBase64;
      if (igImageBase64) console.log("[ig] og:image downloaded for vision analysis");
    }

    // ── Is this a content submission? ─────────────────────────────────────────
    // Instagram links are always treated as submissions
    const isSubmission = igUrl ? true : await isContentSubmission(text);
    console.log(`[msg] isSubmission=${isSubmission} igUrl=${igUrl || "none"} for chatId=${chatId}`);

    if (!isSubmission) {
      // ── Contextual feedback detection (no Telegram reply needed) ─────────────
      const isCorrection = await isFeedbackCorrection(text);
      if (isCorrection) {
        await logCorrection({
          chatId,
          handle:            page.handle,
          botReviewSnippet:  null, // no specific reply — contextual correction
          correctionText:    text,
        });
        console.log(`[feedback] contextual correction stored for ${page.handle}`);
      }
      return;
    }

    // ── Acknowledge ───────────────────────────────────────────────────────────
    const statusMsg = await ctx.reply("🔍 Reviewing...", {
      reply_to_message_id: msg.message_id,
    });

    // ── Extract visual context from video/photo/ig thumbnail ─────────────────
    let visualContext = "";
    try {
      if (igImageBase64) {
        console.log("[media] analyzing Instagram og:image thumbnail");
        visualContext = await analyzeVisual([igImageBase64], text);
      } else if (msg.video) {
        const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB Telegram bot limit
        if ((msg.video.file_size || 0) <= MAX_VIDEO_BYTES) {
          console.log(`[media] downloading video (${msg.video.file_size} bytes)`);
          const buf    = await downloadTelegramFile(ctx.telegram, msg.video.file_id);
          const frames = await extractVideoFrames(buf);
          console.log(`[media] extracted ${frames.length} frames`);
          if (frames.length > 0) visualContext = await analyzeVisual(frames, text);
        } else {
          console.log(`[media] video too large (${msg.video.file_size} bytes) — skipping visual`);
        }
      } else if (msg.photo) {
        console.log("[media] downloading photo");
        const imgB64  = await getPhotoBase64(ctx.telegram, msg.photo);
        visualContext = await analyzeVisual([imgB64], text);
      }
    } catch (mediaErr) {
      console.error("[media] visual analysis error:", mediaErr.message);
    }

    // ── Fetch org context + recent human corrections ──────────────────────────
    const [orgContext, corrections] = await Promise.all([
      getOrgContext(page),
      getRecentCorrections(chatId),
    ]);

    const correctionContext = corrections.length
      ? `\n\nRECENT HUMAN CORRECTIONS IN THIS CHAT:\n${corrections.map((c, i) => `${i + 1}. ${c.correction_text}`).join("\n")}`
      : "";

    const fullOrgContext = orgContext + correctionContext +
      (instagramContext ? `\n\nINSTAGRAM LINK CONTEXT:\n${instagramContext}` : "");

    // ── Run all checks in parallel ────────────────────────────────────────────
    const [factResult, copyrightResult, fitResult] = await Promise.all([
      factCheck(text, page, fullOrgContext, visualContext),
      copyrightCheck(text, page, fullOrgContext, visualContext),
      fitCheck(text, page),
    ]);

    // ── Build reply ───────────────────────────────────────────────────────────
    const reply = [
      `📋 *Content Review* — ${page.handle}`,
      `*📌 Fact:* ${factResult}`,
      `*©️ Copyright:* ${copyrightResult}`,
      `*✨ Fit:* ${fitResult}`,
      visualContext ? `*🎬 Visual:* _media analyzed — see above_` : "",
    ].filter(Boolean).join("\n");

    await ctx.telegram.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      undefined,
      reply,
      { parse_mode: "Markdown" }
    );

    // ── Log to Supabase ───────────────────────────────────────────────────────
    await logReview({
      chatId,
      handle: page.handle,
      content: text,
      factVerdict: factResult,
      copyrightVerdict: copyrightResult,
    });

  } catch (err) {
    console.error("handleMessage error:", err.message);
  }
}

module.exports = { handleMessage };
