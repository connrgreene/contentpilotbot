const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Page registry ─────────────────────────────────────────────────────────────

/**
 * Get page profile by Telegram chat ID.
 * Returns null if this chat isn't registered.
 */
async function getPage(chatId) {
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("chat_id", String(chatId))
    .single();
  if (error || !data) return null;
  return data;
}

/**
 * Register or update a page.
 */
async function upsertPage({ chatId, chatTitle, handle, niche, contentFocus, systemPrompt, emoji, color }) {
  const { error } = await supabase.from("pages").upsert({
    chat_id:       String(chatId),
    chat_title:    chatTitle,
    handle,
    niche,
    content_focus: contentFocus,
    system_prompt: systemPrompt,
    emoji:         emoji || "📄",
    color:         color || "#7c6fff",
    updated_at:    new Date().toISOString(),
  }, { onConflict: "chat_id" });
  if (error) throw new Error(error.message);
}

/**
 * List all registered pages.
 */
async function listPages() {
  const { data, error } = await supabase
    .from("pages")
    .select("handle, niche, chat_title, emoji")
    .order("handle");
  if (error) return [];
  return data || [];
}

// ── Review log ────────────────────────────────────────────────────────────────

async function logReview({ chatId, handle, content, factVerdict, copyrightVerdict, sourceVerdict }) {
  const { error } = await supabase.from("reviews").insert({
    chat_id:           String(chatId),
    handle,
    content:           content?.slice(0, 2000),
    fact_verdict:      factVerdict,
    copyright_verdict: copyrightVerdict,
    source_verdict:    sourceVerdict,
    reviewed_at:       new Date().toISOString(),
  });
  if (error) console.error("logReview error:", error.message);
}

/**
 * Fetch recent reviews for a page — used to give the bot historical context.
 */
async function getRecentReviews(chatId, limit = 8) {
  const { data, error } = await supabase
    .from("reviews")
    .select("content, fact_verdict, copyright_verdict")
    .eq("chat_id", String(chatId))
    .order("reviewed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

// ── Generation log ────────────────────────────────────────────────────────────

async function logGeneration({ chatId, handle, title, hook, items, tone, seedTopic }) {
  const { error } = await supabase.from("generations").insert({
    chat_id:     String(chatId),
    handle,
    title,
    hook,
    items,
    tone,
    seed_topic:  seedTopic || null,
    generated_at: new Date().toISOString(),
  });
  if (error) console.error("logGeneration error:", error.message);
}

module.exports = { getPage, upsertPage, listPages, logReview, getRecentReviews, logGeneration };

