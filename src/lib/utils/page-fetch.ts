// ─── Shared Page Fetcher with In-Memory Cache ──────────────────────────────
// Deduplicates identical URL fetches across public-records, county-enrichment,
// and research-agent within a 5-minute TTL window. Full text is cached and
// sliced to the caller's requested maxChars.

const PAGE_CACHE = new Map<string, { text: string | null; ts: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 200;

function pruneCache() {
  if (PAGE_CACHE.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  PAGE_CACHE.forEach((entry, key) => {
    if (now - entry.ts > TTL_MS) PAGE_CACHE.delete(key);
  });
  // If still over limit, drop oldest entries
  if (PAGE_CACHE.size > MAX_CACHE_SIZE) {
    const entries = Array.from(PAGE_CACHE.entries()).sort((a, b) => a[1].ts - b[1].ts);
    const excess = PAGE_CACHE.size - MAX_CACHE_SIZE;
    for (let i = 0; i < excess; i++) PAGE_CACHE.delete(entries[i][0]);
  }
}

/**
 * Fetch a URL, strip HTML to plain text, and cache the result.
 * Returns null if the fetch fails or the URL was previously marked as failed.
 */
export async function fetchPageText(
  url: string,
  maxChars: number = 12_000,
  timeoutMs: number = 12_000
): Promise<string | null> {
  const cached = PAGE_CACHE.get(url);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return cached.text ? cached.text.slice(0, maxChars) : null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResourcefulBot/1.0; property-tax-research)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      PAGE_CACHE.set(url, { text: null, ts: Date.now() });
      pruneCache();
      return null;
    }

    const html = await response.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    PAGE_CACHE.set(url, { text, ts: Date.now() });
    pruneCache();
    return text.slice(0, maxChars);
  } catch {
    PAGE_CACHE.set(url, { text: null, ts: Date.now() });
    pruneCache();
    return null;
  }
}
