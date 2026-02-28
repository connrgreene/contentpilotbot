const { getPage, logGeneration } = require("../supabase");
const { callSonnetWithMCP } = require("../claude");
const { buildSystemPrompt } = require("../library");

const TONES = ["shocking", "nostalgic", "inspiring", "funny", "facts"];

async function handleGenerate(ctx) {
  try {
    const chatId = ctx.chat.id;
    const page = await getPage(chatId);

    if (!page) {
      return ctx.reply(
        "⚠️ This chat isn't registered yet.\nUse `/addpage @handle Niche` to register it first.",
        { parse_mode: "Markdown" }
      );
    }

    // Parse args: /generate [tone] [optional seed topic]
    const args = ctx.message.text.replace("/generate", "").trim();
    const parts = args.split(" ");
    let tone = "shocking";
    let seedTopic = "";

    if (parts[0] && TONES.includes(parts[0].toLowerCase())) {
      tone = parts[0].toLowerCase();
      seedTopic = parts.slice(1).join(" ");
    } else {
      seedTopic = args;
    }

    const statusMsg = await ctx.reply(
      `⚡ Generating for ${page.handle}${seedTopic ? ` — "${seedTopic}"` : ""}...`,
      { reply_to_message_id: ctx.message.message_id }
    );

    const raw = await callSonnetWithMCP(
      buildSystemPrompt(page),
      `Generate 3 different super post concepts for ${page.handle}.
Tone: ${tone}
${seedTopic ? `Seed topic: ${seedTopic}` : `Pick the most viral-worthy topics for ${page.niche}.`}

Before generating, use the telegram MCP tool to search for:
- Recent content approved or rejected for ${page.handle} or similar ${page.niche} pages
- Current campaign themes or priorities discussed in org chats
- What angles or formats have performed well recently

Then generate 3 posts informed by that org context.

For each post:
- TITLE in ALL CAPS (4-8 words)
- Hook: 1 sentence that stops the scroll
- Exactly 10 specific list items with real names, dates, or numbers

Respond ONLY with valid JSON, no markdown:
{"posts":[{"title":"...","hook":"...","items":["...","...","...","...","...","...","...","...","...","..."]}]}`
    );

    let posts;
    try {
      posts = JSON.parse(raw.replace(/```json|```/g, "").trim()).posts;
    } catch {
      await ctx.telegram.editMessageText(
        statusMsg.chat.id, statusMsg.message_id, undefined,
        "❌ Generation failed — couldn't parse response. Try again."
      );
      return;
    }

    await ctx.telegram.editMessageText(
      statusMsg.chat.id, statusMsg.message_id, undefined,
      `⚡ *3 Super Posts — ${page.handle}* (${tone}${seedTopic ? ` · ${seedTopic}` : ""})`,
      { parse_mode: "Markdown" }
    );

    for (const [i, post] of posts.entries()) {
      const body = [
        `*${i + 1}. ${post.title}*`,
        `_${post.hook}_`,
        "",
        post.items.map((item, j) => `${j + 1}. ${item}`).join("\n"),
      ].join("\n");

      await ctx.reply(body, { parse_mode: "Markdown" });

      await logGeneration({
        chatId,
        handle: page.handle,
        title: post.title,
        hook: post.hook,
        items: post.items,
        tone,
        seedTopic,
      });
    }

  } catch (err) {
    console.error("handleGenerate error:", err.message);
    await ctx.reply("❌ Generation failed. Try again.");
  }
}

module.exports = { handleGenerate };
