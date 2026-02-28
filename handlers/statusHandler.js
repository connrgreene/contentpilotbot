const { getPage, listPages } = require("../supabase");

async function handleStatus(ctx) {
  try {
    const chatId = ctx.chat.id;
    const page = await getPage(chatId);

    if (!page) {
      // If not in a registered chat, show all pages (admin overview)
      const pages = await listPages();
      if (!pages.length) {
        return ctx.reply("No pages registered yet. Use `/addpage` to add one.", { parse_mode: "Markdown" });
      }
      const list = pages.map(p => `${p.emoji || "📄"} *${p.handle}* — ${p.niche}`).join("\n");
      return ctx.reply(`*Registered Pages (${pages.length})*\n\n${list}`, { parse_mode: "Markdown" });
    }

    // Show this chat's page config
    const reply = [
      `${page.emoji || "📄"} *${page.handle}*`,
      `Niche: ${page.niche}`,
      page.content_focus ? `Focus: ${page.content_focus}` : null,
      "",
      `_Chat: ${page.chat_title}_`,
      `_Registered: ${new Date(page.updated_at).toLocaleDateString()}_`,
      "",
      `*Commands:*`,
      `/generate [tone] [topic] — generate super posts`,
      `/generate tones: shocking · nostalgic · inspiring · funny · facts`,
    ].filter(Boolean).join("\n");

    await ctx.reply(reply, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("handleStatus error:", err.message);
  }
}

module.exports = { handleStatus };

