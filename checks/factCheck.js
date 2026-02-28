const { callSonnet } = require("../claude");
const { buildSystemPrompt } = require("../library");

async function factCheck(content, page) {
  return await callSonnet(
    buildSystemPrompt(page),
    `Fact-check the following content submission. For each specific claim (name, date, score, record, stat):
- ✅ Verified / ⚠️ Unverified / ❌ Wrong
- If wrong or unverified, briefly state why and the correction if known

Bullet points only. If content is too vague to fact-check, say so briefly.

Content:
"""
${content.slice(0, 2000)}
"""`
  );
}

module.exports = { factCheck };

