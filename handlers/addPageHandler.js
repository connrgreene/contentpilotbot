const { upsertPage, getPage } = require("../supabase");
const { callSonnet } = require("../claude");
const { ORG_LIBRARY } = require("../library");

/**
 * /addpage @handle Niche [optional content focus]
 * e.g. /addpage @goal Football Greatest moments, records, comebacks
 * e.g. /addpage @thefuck.tv Humor Weird news, absurd stories, Florida man
 *
 * The bot auto-generates a tailored system prompt for the page using Claude.
 */
async function handleAddPage(ctx) {
  try {
    const chatId    = ctx.chat.id;
    const chatTitle = ctx.chat.title || ctx.chat.username || String(chatId);

    // Check if already registered
    const existing = await getPage(chatId);
    if (existing) {
      return ctx.reply(
        `✅ This chat is already registered as *${existing.handle}* (${existing.niche}).\nTo update, use \`/addpage\` again with new details.`,
        { parse_mode: "Markdown" }
      );
    }

    // Parse args
    const args = ctx.message.text.replace("/addpage", "").trim();
    if (!args) {
      return ctx.reply(
        "Usage: `/addpage @handle Niche [content focus]`\n\nExample:\n`/addpage @goal Football Greatest moments, records, comebacks, controversies`",
        { parse_mode: "Markdown" }
      );
    }

    const parts  = args.split(" ");
    const handle = parts[0].startsWith("@") ? parts[0] : `@${parts[0]}`;
    const niche  = parts[1] || "General";
    const contentFocus = parts.slice(2).join(" ");

    const statusMsg = await ctx.reply(`⚙️ Configuring ${handle}...`);

    // Auto-generate a tailored system prompt
    const systemPrompt = await callSonnet(
      ORG_LIBRARY,
      `Write a concise page-specific guidance block (4-5 sentences) for ${handle}.
Niche: ${niche}
${contentFocus ? `Content focus: ${contentFocus}` : ""}

Cover:
1. What viral topics work best for this niche
2. What to avoid
3. The tone and style that resonates with this audience

Output ONLY the guidance text, no headers, no quotes.`
    );

    await upsertPage({
      chatId,
      chatTitle,
      handle,
      niche,
      contentFocus,
      systemPrompt,
      emoji: "📄",
    });

    await ctx.telegram.editMessageText(
      statusMsg.chat.id, statusMsg.message_id, undefined,
      `✅ *${handle}* registered!\n\n*Niche:* ${niche}\n${contentFocus ? `*Focus:* ${contentFocus}\n` : ""}
The bot will now auto-review all content submissions in this chat.

Use \`/generate\` to create super post concepts.
Use \`/status\` to see this page's config.`,
      { parse_mode: "Markdown" }
    );

  } catch (err) {
    console.error("handleAddPage error:", err.message);
    await ctx.reply("❌ Registration failed. Try again.");
  }
}

module.exports = { handleAddPage };

