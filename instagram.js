/**
 * Instagram link enrichment.
 * When someone sends just an IG link, we try to pull post context automatically
 * so the team doesn't have to copy/paste the caption.
 *
 * Strategy:
 *  1. Fetch Open Graph tags using the Facebook crawler user-agent (~60% success on public posts)
 *  2. Fall back to Tavily search on the URL for any indexable context
 */

const { tavilySearch, formatSearchResults } = require("./search");

const IG_PATTERN = /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|reels)\/([A-Za-z0-9_-]+)/;

/**
 * Returns the first Instagram post/reel URL found in a message, or null.
 */
function extractInstagramUrl(text) {
  const match = text.match(IG_PATTERN);
  return match ? match[0].split("?")[0] : null; // strip query params
}

/**
 * Try to fetch Open Graph metadata from an Instagram URL.
 * Uses the Facebook crawler user-agent which Instagram allows for link previews.
 * Returns { title, description, imageUrl } or null on failure.
 */
async function fetchOGTags(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const html = await res.text();

    const get = (prop) => {
      const match =
        html.match(new RegExp(`<meta property="${prop}"[^>]*content="([^"]*)"`, "i")) ||
        html.match(new RegExp(`<meta content="([^"]*)"[^>]*property="${prop}"`, "i"));
      return match ? decodeHTMLEntities(match[1]) : null;
    };

    const title       = get("og:title");
    const description = get("og:description");
    const imageUrl    = get("og:image");

    if (!description && !title) return null;
    return { title, description, imageUrl };

  } catch {
    return null;
  }
}

function decodeHTMLEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

/**
 * Main enrichment function.
 * Returns a plain-text context string to inject into the review,
 * or an empty string if nothing useful was found.
 */
async function enrichInstagramLink(url) {
  const lines = [`Instagram link submitted: ${url}`];

  // 1. Try OG tags
  const og = await fetchOGTags(url);
  if (og) {
    if (og.title)       lines.push(`Account/Title: ${og.title}`);
    if (og.description) lines.push(`Caption (from link preview): ${og.description}`);
    lines.push("(OG fetch succeeded — caption may be truncated)");
  } else {
    lines.push("(OG fetch failed — post may be private or deleted)");
  }

  // 2. Tavily search for additional context
  try {
    const results = await tavilySearch(url, { maxResults: 3, searchDepth: "basic" });
    if (results.length > 0) {
      lines.push("\nWeb search context:");
      lines.push(formatSearchResults(results));
    }
  } catch {
    // Tavily failure is non-fatal
  }

  return lines.join("\n");
}

module.exports = { extractInstagramUrl, enrichInstagramLink };
