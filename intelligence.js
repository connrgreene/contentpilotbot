/**
 * PAGE INTELLIGENCE
 * ─────────────────
 * Reads the last 30 days of a page's Telegram chat history via MCP,
 * extracts lessons from real content approvals/rejections, and stores
 * the result in Supabase as `page_intelligence`.
 *
 * Called automatically on /addpage, weekly via cron, and on /syncpage.
 */

const { callSonnetWithMCP } = require("./claude");
const { ORG_LIBRARY }        = require("./library");
const { updatePageIntelligence } = require("./supabase");

async function syncPageIntelligence(page) {
  if (!process.env.TELEGRAM_MCP_URL) {
    console.log(`[intelligence] MCP not configured — skipping ${page.handle}`);
    return null;
  }

  console.log(`[intelligence] 🔄 Syncing ${page.handle} (chat_id: ${page.chat_id})...`);

  try {
    const intelligence = await callSonnetWithMCP(
      ORG_LIBRARY,
      `You have access to Bolis Media's Telegram channels via the telegram MCP tool.

Your task: read the last 30 days of messages from the Telegram chat for the Instagram page ${page.handle} (niche: ${page.niche}, chat_id: ${page.chat_id}).

Use the available MCP tools to retrieve messages from this chat. Focus on content submission discussions — where team members submitted post ideas, captions, scripts, videos, or Instagram links, and the team responded with approval, rejection, edits, or feedback.

After reading the history, synthesize everything into a structured intelligence report under these exact headings:

## APPROVED PATTERNS
What topics, formats, angles, hooks, and content styles consistently get approved or praised? Be specific — name actual examples, recurring themes, and what makes them work for this page.

## REJECTED PATTERNS
What gets flagged, shot down, or edited heavily? What reasons come up repeatedly? Include specific examples.

## TONE & VOICE
The exact writing style, energy level, vocabulary, and personality that fits this page. How is it different from a generic ${page.niche} account?

## TOP TOPIC AREAS
The specific subject categories that get strong reactions or consistently move forward. With real examples from the chat where possible.

## AVOID LIST
Specific topics, formats, angles, or types of content that don't fit — based on what was rejected or never submitted.

## PAGE IDENTITY
In 2-3 sentences: what makes this page's content distinct? What is its unique editorial angle vs other ${page.niche} pages?

Be specific and grounded in what you actually find in the chat. If fewer than 5 content submissions are found, note that at the top and provide best-effort analysis from what's available. Do not invent examples.`
    );

    await updatePageIntelligence(page.chat_id, intelligence);
    console.log(`[intelligence] ✅ Synced ${page.handle}`);
    return intelligence;

  } catch (err) {
    console.error(`[intelligence] Error for ${page.handle}:`, err.message);
    return null;
  }
}

module.exports = { syncPageIntelligence };
