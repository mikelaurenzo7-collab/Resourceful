// ─── County Slug Parser ──────────────────────────────────────────────────────
// Converts URL slugs like "cook-county-il" to structured county data.
// Handles multi-word county names: "prince-georges-county-md", "st-louis-county-mo"

/**
 * Parse a county SEO slug into county name and state abbreviation.
 *
 * @example
 * parseCountySlug("cook-county-il")
 * // → { countyName: "Cook County", stateAbbrev: "IL" }
 *
 * parseCountySlug("prince-georges-county-md")
 * // → { countyName: "Prince Georges County", stateAbbrev: "MD" }
 *
 * parseCountySlug("st-louis-county-mo")
 * // → { countyName: "St Louis County", stateAbbrev: "MO" }
 */
export function parseCountySlug(
  slug: string
): { countyName: string; stateAbbrev: string } | null {
  // Slug must end with a 2-letter state abbreviation: "...-xx"
  const parts = slug.toLowerCase().split('-');

  // Minimum: "x-county-xx" → 3 parts
  if (parts.length < 3) return null;

  const stateAbbrev = parts[parts.length - 1];
  if (stateAbbrev.length !== 2) return null;

  // Remaining parts (excluding state) should end with "county"
  const nameParts = parts.slice(0, -1);
  if (nameParts[nameParts.length - 1] !== 'county') return null;

  // Build county name with title casing
  const countyName = nameParts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

  return {
    countyName,
    stateAbbrev: stateAbbrev.toUpperCase(),
  };
}

/**
 * Build a county SEO slug from a county name and state abbreviation.
 *
 * @example
 * buildCountySlug("Cook County", "IL") → "cook-county-il"
 * buildCountySlug("Prince George's County", "MD") → "prince-georges-county-md"
 */
export function buildCountySlug(countyName: string, stateAbbrev: string): string {
  return (
    countyName
      .toLowerCase()
      .replace(/['']/g, '') // Remove apostrophes (Prince George's → Prince Georges)
      .replace(/[^a-z0-9\s]/g, '') // Remove other special characters
      .trim()
      .replace(/\s+/g, '-') + // Replace spaces with hyphens
    '-' +
    stateAbbrev.toLowerCase()
  );
}
