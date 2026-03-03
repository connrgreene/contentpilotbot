const { callSonnet } = require("../claude");
const { buildSystemPrompt } = require("../library");
const { tavilyMultiSearch, formatSearchResults } = require("../search");

/**
 * Extract specific verifiable claims from content for targeted searching.
 */
function extractClaimQueries(content) {
  const sentences = content.split(/[.\n]/).map((s) => s.trim()).filter((s) => s.length > 20);
  const claimLike = sentences.filter((s) => /\d|died|born|won|scored|record|million|billion|%/i.test(s));
  return claimLike.slice(0, 4).map((s) => s.slice(0, 120));
}

async function factCheck(content, page, orgContext = "", visualContext = "") {
  // Step 1: Search for sources on the key claims
  const queries = extractClaimQueries(content);

  let searchContext = "";
  if (queries.length > 0) {
    const results = await tavilyMultiSearch(queries, { maxResults: 3 });
    searchContext = results.length
      ? `\n\nWEB SEARCH RESULTS (use these as your sources):\n${formatSearchResults(results)}`
      : "\n\nWEB SEARCH: No results returned.";
  }

  // Step 2: Strict fact-check with two-source hard rule
  return await callSonnet(
    buildSystemPrompt(page),
    `You are a strict fact-checker for social media content. Apply these HARD RULES:

FIRST — IDENTIFY CONTENT TYPE:
- If the content describes a MOVIE or TV SHOW PLOT (e.g. "In the film X, character Y does Z"), treat those as PLOT DESCRIPTIONS and verify them against entertainment sources (IMDb, Wikipedia plot summaries). Fictional storylines are not real-world factual claims — do not flag them as misinformation simply because they describe fictional events or character actions.
- If the content describes REAL PEOPLE doing real things outside of a fictional context, apply the full two-source rule below.

HARD RULES (for real-world factual claims only):
1. Every specific claim (name, date, stat, record, score, financial figure) MUST be supported by TWO independent sources to receive ✅
2. If only ONE source supports a claim → ⚠️ SINGLE SOURCE — needs second verification
3. If ZERO sources support a claim → ❌ UNSOURCED — cannot approve
4. If a claim is directly contradicted by sources → ❌ WRONG — state the correction
5. If a person is listed as dead but sources show they are alive → ❌ FACTUAL ERROR
6. If list items don't match the post's stated premise → ❌ CONCEPT INTEGRITY FAILURE

OUTPUT FORMAT — be concise, no padding:
• If all claims check out: one line only — "✅ APPROVED — [one-line reason]"
• If issues exist: "⚠️ NEEDS REVISION" or "❌ REJECT" on the first line, then one bullet per problem claim (specific, no fluff)
Max 6 lines total. No intro sentences.

Content:
"""
${content.slice(0, 2000)}
"""
${searchContext}${orgContext ? `\n\nORG CONTEXT (from Telegram — prior decisions & standards):\n${orgContext}` : ""}${visualContext ? `\n\nVISUAL ANALYSIS (from submitted video/image):\n${visualContext}` : ""}`
  );
}

module.exports = { factCheck };
