const { callSonnet } = require("../claude");
const { buildSystemPrompt } = require("../library");
const { tavilyMultiSearch, formatSearchResults } = require("../search");

/**
 * Build copyright-focused search queries from content.
 * Searches for: exact title matches, similar formats, original sources.
 */
function buildCopyrightQueries(content, page) {
  const queries = [];

  // Look for the title/headline (first line or ALL CAPS phrase)
  const titleMatch = content.match(/^([A-Z][A-Z\s]{5,60})/m);
  if (titleMatch) {
    queries.push(`"${titleMatch[1].trim()}" instagram`);
    queries.push(`${titleMatch[1].trim()} viral post`);
  }

  // Search for the niche + format combo to find pre-existing similar posts
  if (page?.niche) {
    const firstLine = content.split("\n")[0].slice(0, 80);
    queries.push(`${firstLine} site:instagram.com OR site:twitter.com OR site:tiktok.com`);
  }

  // Check if content appears to be copied from a known article
  const snippet = content.slice(0, 100).replace(/\n/g, " ").trim();
  queries.push(`"${snippet.slice(0, 60)}"`);

  return queries.slice(0, 3);
}

async function copyrightCheck(content, page, orgContext = "", visualContext = "") {
  // Run web searches to find existing similar content and original sources
  const queries = buildCopyrightQueries(content, page);
  const results = await tavilyMultiSearch(queries, { maxResults: 4 });

  const searchContext = results.length
    ? `\n\nWEB SEARCH RESULTS:\n${formatSearchResults(results)}`
    : "\n\nWEB SEARCH: No matching content found online.";

  return await callSonnet(
    buildSystemPrompt(page),
    `You are a strict copyright and originality analyst for an Instagram media company.
Analyze this content submission for copyright risk and originality. Be rigorous.

CHECK FOR:
1. **Direct copying** — Does this appear to be lifted from an existing article, post, or creator? Check search results.
2. **Format plagiarism** — Is this a near-identical copy of another creator's viral format or angle?
3. **Protected text** — Any lyrics, poems, book excerpts, or long article quotes (10+ words verbatim)?
4. **Image/video risk** — Any mention of specific images, clips, or media that may need licensing?
5. **Originality** — If similar posts already exist virally, flag that this isn't original content
6. **Instagram strike risk** — Anything likely to trigger an automated or manual copyright claim?

OUTPUT FORMAT — be concise, no padding:
• If clear: one line only — "✅ CLEAR — [one-line reason]"
• If issues: "⚠️ MODERATE RISK" or "❌ HIGH RISK" on the first line, then one bullet per concern (name the specific source if found)
Max 5 lines total. No intro sentences.

Content:
"""
${content.slice(0, 2000)}
"""
${searchContext}${orgContext ? `\n\nORG CONTEXT (from Telegram — prior decisions & flagged formats):\n${orgContext}` : ""}${visualContext ? `\n\nVISUAL ANALYSIS (from submitted video/image):\n${visualContext}` : ""}`
  );
}

module.exports = { copyrightCheck };
