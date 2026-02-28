const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Fast/cheap — classification, copyright, source checks */
async function callHaiku(system, user) {
  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content.find((b) => b.type === "text")?.text?.trim() ?? "";
}

/** Smarter — fact-checking, generation, page onboarding */
async function callSonnet(system, user) {
  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2500,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content.find((b) => b.type === "text")?.text?.trim() ?? "";
}

module.exports = { callHaiku, callSonnet };

