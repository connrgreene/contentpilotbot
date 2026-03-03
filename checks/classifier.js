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
Classify whether a message is a CONTENT SUBMISSION (actual post being pitched for Instagram) or INTERNAL CHAT (team discussion, strategy, workflow, feedback, reactions).

Say "yes" ONLY if the message contains actual post content being submitted for review:
- A caption, description, or script for an Instagram post, reel, or carousel
- A list of facts/moments being pitched as a post
- Prefaced with "thinking about posting", "review this", "what about this post", etc.

Say "no" for ALL of these — even if they mention content, posts, or ideas:
- Internal strategy discussions ("we should implement X", "this would do well on FB")
- Feedback or reactions to the bot's previous reviews
- Team coordination messages ("approved", "send it", "let's do this")
- Questions about workflow or the bot itself
- General chit-chat or emoji reactions

Answer ONLY "yes" or "no".`,
    `Message:
"""
${text.slice(0, 800)}
"""`
  );

  return verdict.toLowerCase().startsWith("yes");
}

module.exports = { isContentSubmission };
