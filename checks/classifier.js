// Quick regex pre-filter — no API call needed in a dedicated review chat
const CHATTER_PATTERNS = [
  /^(ok|okay|yessir|yes sir|got it|gotchu|all good|nice|lol|haha|sure|sounds good|let'?s go|fire|rest good|ty|thx|thanks|approved|👍|🔥|💯|✅|yep|yup|nope|no|yes|great|perfect|done)/i,
  /^@\w+(\s@\w+)*$/, // just mentions
  /^https?:\/\/\S+$/, // just a single link (source reply, not a submission)
];

/**
 * Returns true if the message looks like a new content submission.
 * In a registered content review chat, anything that isn't short
 * chatter or a single link is treated as a submission.
 */
function isContentSubmission(text) {
  if (!text || text.length < 40) return false;
  if (CHATTER_PATTERNS.some((r) => r.test(text.trim()))) return false;
  return true;
}

module.exports = { isContentSubmission };

