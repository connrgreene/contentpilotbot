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

    // 120s timeout — MCP searches + generation takes longer than reviews
    const mcpPromise = callSonnetWithMCP(buildSystemPrompt(page),
      `Generate EXACTLY 3 super post concepts for ${page.handle}. No more, no less.
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
    const timeoutMsg = "__TIMEOUT__";
    const raw = await Promise.race([
      mcpPromise,
      new Promise((resolve) => setTimeout(() => resolve(timeoutMsg), 120000)),
    ]);

    if (raw === timeoutMsg) {
      await ctx.telegram.editMessageText(
        statusMsg.chat.id, statusMsg.message_id, undefined,
        "⏳ Generation timed out — the MCP search took too long. Try `/generate` again."
      );
      return;
    }

    let posts;
    try {
      // Strip markdown fences, then find the outermost JSON object
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in response");
      posts = JSON.parse(jsonMatch[0]).posts.slice(0, 3);
      if (!Array.isArray(posts) || posts.length === 0) throw new Error("Empty posts array");
    } catch (parseErr) {
      console.error("Generate parse error:", parseErr.message, "\nRaw:", raw?.slice(0, 300));
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
    const isRateLimit = err.message?.includes("rate_limit") || err.message?.includes("429");
    const isTimeout   = err.message?.includes("timed out") || err.message?.includes("timeout");
    const msg = isRateLimit
      ? "⏳ Rate limit hit — please try again in 1–2 minutes."
      : isTimeout
      ? "⏳ Generation timed out — please try again."
      : `❌ Generation failed: ${err.message?.slice(0, 100) || "unknown error"}`;
    await ctx.reply(msg);
  }
}

module.exports = { handleGenerate };
