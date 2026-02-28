const { callHaiku } = require("../claude");
const { buildSystemPrompt } = require("../library");

async function copyrightCheck(content, page) {
  return await callHaiku(
    buildSystemPrompt(page),
    `Review for copyright / fair use concerns. Check for:
- Direct copying of another creator's unique angle or format
- Large quoted passages from articles or books  
- Lyrics, poems, or fully protected creative works
- Images or video that may need licensing
- Anything that could trigger an Instagram copyright strike

Respond with ✅ No concerns / ⚠️ Minor concern / ❌ Flag
Then 1-2 bullet points explaining. Be brief.

Content:
"""
${content.slice(0, 2000)}
"""`
  );
}

module.exports = { copyrightCheck };

