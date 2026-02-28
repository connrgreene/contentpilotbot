const { getPage, logReview } = require("../supabase");
const { getOrgContext } = require("../claude");
const { isContentSubmission } = require("../checks/classifier");
const { factCheck }      = require("../checks/factCheck");
const { copyrightCheck } = require("../checks/copyrightCheck");
const { sourceCheck }    = require("../checks/sourceCheck");

// Dedup — avoid processing the same message twice
const reviewed = new Set();

async function handleMessage(ctx) {
  try {
    const msg = ctx.message;
    if (!msg?.text) return;
    if (msg.from?.is_bot) return;
    if (msg.text.startsWith("/")) return;
    if (reviewed.has(msg.message_id)) return;

    reviewed.add(msg.message_id);
    if (reviewed.size > 500) reviewed.delete(reviewed.values().next().value);

    const chatId = ctx.chat.id;

    // ── Is this chat registered? ──────────────────────────────────────────────
    const page = await getPage(chatId);
    if (!page) return; // silently ignore unregistered chats

    const text = msg.text;

    // ── Is this a content submission? ─────────────────────────────────────────
    const isSubmission = await isContentSubmission(text);
    if (!isSubmission) return;

    // ── Acknowledge ───────────────────────────────────────────────────────────
    const statusMsg = await ctx.reply("🔍 Reviewing...", {
      reply_to_message_id: msg.message_id,
    });

    // ── Fetch org context from Telegram MCP (once, shared across all checks) ──
    const orgContext = await getOrgContext(page);

    // ── Run all checks in parallel ────────────────────────────────────────────
    const [factResult, copyrightResult, sourceResult] = await Promise.all([
      factCheck(text, page, orgContext),
      copyrightCheck(text, page, orgContext),
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
    ].join("\n");

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
