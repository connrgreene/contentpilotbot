const { callHaiku } = require("../claude");

// Hard filter — obvious non-submissions that don't need an API call
const CHATTER_PATTERNS = [
  /^(ok|okay|yessir|yes sir|got it|gotchu|all good|nice|lol|haha|sure|sounds good|let'?s go|fire|rest good|ty|thx|thanks|approved|👍|🔥|💯|✅|yep|yup|nope|no|yes|great|perfect|done)/i,
  /^@\w+(\s@\w+)*$/, // just mentions
  /^https?:\/\/\S+$/, // just a single link (source reply, not a submission)
];

/**
 * Returns true if the message looks like a new content submission.
 * Uses cheap regex first, then Haiku only if needed.
 */
async function isContentSubmission(text) {
  if (!text || text.length < 40) return false;
  if (CHATTER_PATTERNS.some((r) => r.test(text.trim()))) return false;

  const verdict = await callHaiku(
    `You are a filter for a Telegram content approval chat used by a social media team.
Your job is to detect whether a message contains content being considered for posting — even if it's phrased casually.
Say "yes" if the message includes ANY of: a post caption, a description of a video/clip, a story pitch, a fact or topic someone wants to post about, or anything prefaced with phrases like "thinking about posting", "what about this", "I want to post", "review this", etc.
Say "no" ONLY if it is pure chat with zero content (e.g. "sounds good", "let's do it", "approved").
Answer ONLY "yes" or "no".`,
    `Message:
"""
${text.slice(0, 800)}
"""`
  );

  return verdict.toLowerCase().startsWith("yes");
}

module.exports = { isContentSubmission };
