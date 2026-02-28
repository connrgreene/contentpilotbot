const { callHaiku } = require("../claude");
const { buildSystemPrompt } = require("../library");

function extractUrls(text) {
  return text.match(/https?:\/\/[^\s)>\]]+/g) || [];
}

async function sourceCheck(content, page) {
  const urls = extractUrls(content);

  if (urls.length === 0) {
    return "⚠️ No sources provided — claims should be backed by at least one credible link before approval.";
  }

  return await callHaiku(
    buildSystemPrompt(page),
    `Evaluate source credibility for a ${page?.niche || "social media"} Instagram page.

Sources:
${urls.map((u, i) => `${i + 1}. ${u}`).join("\n")}

For each: ✅ Credible / ⚠️ Questionable / ❌ Not credible — one-line reason.
Final line: overall source quality is Strong / Adequate / Weak.`
  );
}

module.exports = { sourceCheck };

