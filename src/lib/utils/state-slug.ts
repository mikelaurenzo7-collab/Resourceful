// ─── State Slug Utilities ────────────────────────────────────────────────────
// Converts state names to/from URL-safe slugs.
// "New York" → "new-york", "Illinois" → "illinois"

/**
 * Build a state SEO slug from a state name.
 * @example buildStateSlug("New York") → "new-york"
 */
export function buildStateSlug(stateName: string): string {
  return stateName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Parse a state slug back to a title-cased state name pattern.
 * @example parseStateSlug("new-york") → "New York"
 */
export function parseStateSlug(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
