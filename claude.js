const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MCP_URL = process.env.TELEGRAM_MCP_URL;

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

/**
 * Sonnet with Telegram MCP attached.
 * Claude can autonomously search org chats for context before responding.
 * Falls back to standard callSonnet if TELEGRAM_MCP_URL is not set.
 */
async function callSonnetWithMCP(system, user) {
  if (!MCP_URL) return callSonnet(system, user);
  const res = await client.beta.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2500,
    system,
    messages: [{ role: "user", content: user }],
    betas: ["mcp-client-2025-04-04"],
    mcp_servers: [{ type: "url", url: MCP_URL, name: "telegram" }],
  });
  // MCP responses may have tool_use blocks before the final text block
  const textBlocks = res.content.filter((b) => b.type === "text");
  return textBlocks[textBlocks.length - 1]?.text?.trim() ?? "";
}

/**
 * Fetch org-level context from Telegram before a review session.
 * Called once per submission — result is passed to all three checks.
 * Returns a short summary string, or "" if MCP is not configured.
 */
async function getOrgContext(page) {
  if (!MCP_URL) return "";
  try {
    const res = await client.beta.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `You have access to Bolis Media's Telegram channels via the telegram MCP tool.
Search for context relevant to reviewing content for ${page.handle} (niche: ${page.niche}).

Use search_messages to look for:
1. Recent approval or rejection decisions for similar content
2. Any flagged topics, content bans, or org-wide standards discussed
3. Current campaign directions or priorities for this page or its niche

Summarize findings in 3-5 concise bullet points. If nothing relevant found, say "No recent org context found."`,
      }],
      betas: ["mcp-client-2025-04-04"],
      mcp_servers: [{ type: "url", url: MCP_URL, name: "telegram" }],
    });
    const textBlocks = res.content.filter((b) => b.type === "text");
    return textBlocks[textBlocks.length - 1]?.text?.trim() ?? "";
  } catch (err) {
    console.error("getOrgContext error:", err.message);
    return "";
  }
}

module.exports = { callHaiku, callSonnet, callSonnetWithMCP, getOrgContext };
