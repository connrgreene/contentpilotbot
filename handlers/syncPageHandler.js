const { getPage }              = require("../supabase");
const { syncPageIntelligence } = require("../intelligence");

/**
 * /syncpage
 * Manually trigger a page intelligence re-sync for this chat.
 * Reads the last 30 days of Telegram history, extracts approval patterns,
 * and stores the result in Supabase.
 */
async function handleSyncPage(ctx) {
  try {
    const chatId = ctx.chat.id;
    const page   = await getPage(chatId);

    if (!page) {
      return ctx.reply(
        "❌ This chat isn't registered. Use `/addpage` first.",
        { parse_mode: "Markdown" }
      );
    }

    const statusMsg = await ctx.reply(
      `🔄 Syncing page intelligence for *${page.handle}*...\n_Reading last 30 days of content approvals — this takes ~30 seconds_`,
      { parse_mode: "Markdown" }
    );

    const intelligence = await syncPageIntelligence(page);

    if (!intelligence) {
      return ctx.telegram.editMessageText(
        statusMsg.chat.id, statusMsg.message_id, undefined,
        "❌ Sync failed — MCP not configured or couldn't read chat history.\nCheck that `TELEGRAM_MCP_URL` is set in Railway."
      );
    }

    await ctx.telegram.editMessageText(
      statusMsg.chat.id, statusMsg.message_id, undefined,
      `✅ *${page.handle}* intelligence updated!\n\nThe fit check will now use real approval history from this chat. Run \`/syncpage\` again anytime to refresh.`,
      { parse_mode: "Markdown" }
    );

  } catch (err) {
    console.error("handleSyncPage error:", err.message);
    await ctx.reply("❌ Sync failed. Try again.");
  }
}

module.exports = { handleSyncPage };
