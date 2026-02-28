const { callHaiku } = require("../claude");

// Quick regex pre-filter before hitting the API
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
    "You classify messages in a Telegram content approval chat for an Instagram media company. Be conservative — only flag genuine new content submissions.",
    `Is this a NEW content submission (a post idea, carousel concept, or story being pitched for approval)?
Answer ONLY "yes" or "no".

Message:
"""
${text.slice(0, 600)}
"""`
  );

  return verdict.toLowerCase().startsWith("yes");
}

module.exports = { isContentSubmission };

