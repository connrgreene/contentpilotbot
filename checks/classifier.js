const { callHaiku } = require("../claude");

// Hard filter — obvious non-submissions that don't need an API call
const CHATTER_PATTERNS = [
  /^(ok|okay|yessir|yes sir|got it|gotchu|all good|nice|lol|haha|sure|sounds good|let'?s go|fire|rest good|ty|thx|thanks|approved|👍|🔥|💯|✅|yep|yup|nope|no|yes|great|perfect|done)/i,
  /^@\w+(\s@\w+)*$/, // just mentions
  /^https?:\/\/(?!www\.instagram\.com)\S+$/, // bare non-Instagram links (source replies)
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

/**
 * Returns true if the message looks like a correction or feedback
 * about a previous bot review — even without using Telegram's reply feature.
 * Only called after isContentSubmission returns false.
 */
async function isFeedbackCorrection(text) {
  if (!text || text.length < 20) return false;

  const verdict = await callHaiku(
    `You are monitoring a Telegram content approval chat for a social media team.
Detect whether a message is a CORRECTION or FEEDBACK about the AI bot's previous content review.

Say "yes" if the message:
- Corrects or disputes something the bot said (e.g. "that's a plot point, not a fact", "the bot got this wrong", "actually that's accurate")
- Comments on the quality or accuracy of a review ("it's judging too harshly", "needs more context")
- States a standard or rule the bot should follow in future ("we don't flag movie plots as misinformation")
- Expresses disagreement or agreement with a specific verdict the bot gave

Say "no" if it's just general team chat, strategy, or unrelated to a bot review.

Answer ONLY "yes" or "no".`,
    `Message:
"""
${text.slice(0, 600)}
"""`
  );

  return verdict.toLowerCase().startsWith("yes");
}

module.exports = { isContentSubmission, isFeedbackCorrection };
