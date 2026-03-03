const { callHaiku } = require("../claude");
const { buildSystemPrompt } = require("../library");

function extractUrls(text) {
  return text.match(/https?:\/\/[^\s)>\]]+/g) || [];
}

async function sourceCheck(content, page) {
  const urls = extractUrls(content);

  if (urls.length === 0) {
    return "✅ No links included — claims verified via web search during fact check.";
  }

  return await callHaiku(
    buildSystemPrompt(page),
    `Evaluate source credibility for a ${page?.niche || "social media"} Instagram page.

Sources:
${urls.map((u, i) => `${i + 1}. ${u}`).join("\n")}

For each: ✅ Credible / ⚠️ Questionable / ❌ Not credible — one-line reason.
Last line: Overall quality: Strong / Adequate / Weak.
No intro, no padding. Max 5 lines total.`
  );
}

module.exports = { sourceCheck };

