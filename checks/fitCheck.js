const { callHaiku } = require("../claude");

/**
 * Evaluate whether submitted content is a good fit for this specific page.
 * Checks niche alignment, format/structure, tone, and viral potential.
 * Uses Haiku — editorial judgment, not research.
 */
async function fitCheck(content, page) {
  const pageProfile = [
    `Handle: ${page.handle}`,
    `Niche: ${page.niche}`,
    page.content_focus  ? `Content focus: ${page.content_focus}` : "",
    page.system_prompt  ? `Page style notes: ${page.system_prompt}` : "",
    page.page_intelligence
      ? `\nLEARNED INTELLIGENCE (from real content approvals in this chat):\n${page.page_intelligence}`
      : "\n(No approval history synced yet — evaluation based on niche profile only)",
  ].filter(Boolean).join("\n");

  return await callHaiku(
    `You are an editorial reviewer for an Instagram media company.
Evaluate whether a content submission is a good fit for the page it's being submitted to.`,
    `PAGE PROFILE:
${pageProfile}

CONTENT SUBMISSION:
"""
${content.slice(0, 1500)}
"""

Evaluate on:
1. NICHE FIT — Does the topic match this page's niche and content focus?
2. FORMAT — Is it structured as a proper post (list, hook, clear angle)? Or raw/unformatted?
3. TONE — Does the voice/style match what this page posts?
4. VIRAL ANGLE — Does it have a clear emotional hook (shock, nostalgia, awe, outrage)?

OUTPUT FORMAT — be concise:
• If strong fit: one line — "✅ Good fit — [one-line reason]"
• If issues: "⚠️ [main issue]" on first line, then one bullet per concern
Max 4 lines. No intro sentences.`
  );
}

module.exports = { fitCheck };
