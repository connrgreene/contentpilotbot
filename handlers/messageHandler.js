const { getPage, logReview, logCorrection, getRecentCorrections } = require("../supabase");
const { getOrgContext, analyzeVisual } = require("../claude");
const { isContentSubmission } = require("../checks/classifier");
const { factCheck }      = require("../checks/factCheck");
const { copyrightCheck } = require("../checks/copyrightCheck");
const { sourceCheck }    = require("../checks/sourceCheck");
const { extractVideoFrames, getPhotoBase64, downloadTelegramFile } = require("../media");

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

    // ── Is this a content submission? ─────────────────────────────────────────
    const isSubmission = await isContentSubmission(text);
    console.log(`[msg] isSubmission=${isSubmission} for chatId=${chatId}`);
    if (!isSubmission) return;

    // ── Acknowledge ───────────────────────────────────────────────────────────
    const statusMsg = await ctx.reply("🔍 Reviewing...", {
      reply_to_message_id: msg.message_id,
    });

    // ── Extract visual context from video/photo ───────────────────────────────
    let visualContext = "";
    try {
      if (msg.video) {
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

    const fullOrgContext = orgContext + correctionContext;

    // ── Run all checks in parallel ────────────────────────────────────────────
    const [factResult, copyrightResult, sourceResult] = await Promise.all([
      factCheck(text, page, fullOrgContext, visualContext),
      copyrightCheck(text, page, fullOrgContext, visualContext),
      sourceCheck(text, page),
    ]);

    // ── Build reply ───────────────────────────────────────────────────────────
    const reply = [
      `📋 *Content Review* — ${page.handle}`,
      "",
      `*📌 Fact Check*`,
      factResult,
      "",
      `*©️ Copyright / Fair Use*`,
      copyrightResult,
      "",
      `*🔗 Sources*`,
      sourceResult,
      visualContext ? "\n*🎬 Visual*\n_Video/image analyzed — see fact & copyright notes above._" : "",
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
      sourceVerdict: sourceResult,
    });

  } catch (err) {
    console.error("handleMessage error:", err.message);
  }
}

module.exports = { handleMessage };
