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

async function factCheck(content, page, orgContext = "") {
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
    `You are a strict fact-checker. Apply these HARD RULES with no exceptions:

HARD RULES:
1. Every specific claim (name, date, stat, record, score, financial figure) MUST be supported by a minimum of TWO independent sources to receive ✅
2. If only ONE source supports a claim → ⚠️ SINGLE SOURCE — needs second verification
3. If ZERO sources support a claim → ❌ UNSOURCED — cannot approve
4. If a claim is directly contradicted by sources → ❌ WRONG — state the correction
5. If a person is listed as dead but sources show they are alive → ❌ FACTUAL ERROR
6. If list items don't match the post's stated premise (e.g. alive person on "died broke" list) → ❌ CONCEPT INTEGRITY FAILURE

For each claim in the content, output:
[STATUS] Claim — reason + sources found (or "no sources found")

End with:
VERDICT: ✅ APPROVED / ⚠️ NEEDS REVISION / ❌ REJECT
One-line summary of the biggest issue if not approved.

Content:
"""
${content.slice(0, 2000)}
"""
${searchContext}${orgContext ? `\n\nORG CONTEXT (from Telegram — prior decisions & standards):\n${orgContext}` : ""}`
  );
}

module.exports = { factCheck };
