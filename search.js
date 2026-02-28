/**
 * Tavily search helper
 * Used by fact-check and copyright checks for real web search.
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_URL = "https://api.tavily.com/search";

/**
 * Run a single Tavily search. Returns array of {title, url, content} results.
 * @param {string} query
 * @param {object} opts
 * @param {number} opts.maxResults - default 5
 * @param {"basic"|"advanced"} opts.searchDepth - advanced costs 2 credits, default basic
 */
async function tavilySearch(query, { maxResults = 5, searchDepth = "basic" } = {}) {
  if (!TAVILY_API_KEY) {
    console.warn("TAVILY_API_KEY not set — skipping web search");
    return [];
  }

  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: searchDepth,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!res.ok) {
      console.error("Tavily error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return (data.results || []).map((r) => ({
      title:   r.title,
      url:     r.url,
      content: r.content?.slice(0, 500) || "",
      score:   r.score,
    }));
  } catch (err) {
    console.error("tavilySearch error:", err.message);
    return [];
  }
}

/**
 * Run multiple searches in parallel and return combined deduplicated results.
 */
async function tavilyMultiSearch(queries, opts = {}) {
  const results = await Promise.all(queries.map((q) => tavilySearch(q, opts)));
  const seen = new Set();
  return results.flat().filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

/**
 * Format search results for injection into a Claude prompt.
 */
function formatSearchResults(results) {
  if (!results.length) return "No search results found.";
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
    .join("\n\n");
}

module.exports = { tavilySearch, tavilyMultiSearch, formatSearchResults };
