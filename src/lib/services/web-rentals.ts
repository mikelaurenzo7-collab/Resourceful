// ─── Web Rental Comparables Search ───────────────────────────────────────────
// Fallback service for when ATTOM returns 0 rental comps and before calling
// paid RentCast API. Uses Serper to search rental portals (LoopNet, Zillow,
// Apartments.com, CommercialCafe) and Claude to extract structured rental data.
//
// Returns ComparableRentalInsert[] matching the pipeline's expected format.
// Graceful: returns [] if SERPER_API_KEY or ANTHROPIC_API_KEY is not configured,
// or if any step fails — pipeline falls through to RentCast or hardcoded fallback.

import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS } from '@/config/ai';
import type { ComparableRentalInsert } from '@/types/database';
import { apiLogger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WebRentalContext {
  reportId: string;
  address: string;
  city: string;
  state: string;
  propertyType: string;   // 'commercial' | 'industrial' | 'residential'
  subtype: string;        // 'commercial_office' | 'industrial_warehouse' etc.
  buildingSqFt: number;
  latitude: number;
  longitude: number;
}

interface ExtractedRental {
  address: string;
  monthlyRent: number;
  squareFootage: number | null;
  rentPerSqFtYear: number | null;
  propertyType: string;
  listingDate: string | null;
  leaseType: string | null;
  confidence: string;
}

// ─── Serper Search ──────────────────────────────────────────────────────────

async function serperSearch(
  query: string,
): Promise<Array<{ title: string; link: string; snippet: string }>> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
    });
    if (!res.ok) {
      apiLogger.warn({ status: res.status }, '[web-rentals] Serper returned');
      return [];
    }
    const data = (await res.json()) as {
      organic?: Array<{ title: string; link: string; snippet: string }>;
    };
    return (data.organic ?? []).map((r) => ({
      title: r.title ?? '',
      link: r.link ?? '',
      snippet: r.snippet ?? '',
    }));
  } catch (err) {
    apiLogger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Serper error');
    return [];
  }
}

// ─── Page Content Fetch ─────────────────────────────────────────────────────

async function tryFetchPageContent(url: string): Promise<string | null> {
  try {
    const { fetchPageText } = await import('@/lib/utils/page-fetch');
    const content = await fetchPageText(url, 8_000, 8_000);
    return content ?? null;
  } catch {
    return null;
  }
}

// ─── Query Builder ──────────────────────────────────────────────────────────

function buildRentalSearchQueries(ctx: WebRentalContext): [string, string] {
  const subtypeLabels: Record<string, string> = {
    commercial_retail_strip: 'retail space for lease',
    commercial_office: 'office space for lease',
    commercial_restaurant: 'restaurant space for lease',
    commercial_hotel: 'hotel',
    commercial_mixed_use: 'mixed use space for lease',
    commercial_general: 'commercial space for lease',
    industrial_warehouse: 'warehouse for lease',
    industrial_manufacturing: 'manufacturing space for lease',
    industrial_flex: 'flex space for lease',
    industrial_self_storage: 'self storage',
    industrial_general: 'industrial space for lease',
    residential_multifamily: 'apartment for rent',
    agricultural_general: 'farmland for lease',
    agricultural_crop: 'cropland for lease',
    agricultural_pasture: 'pasture for lease',
  };
  const label = subtypeLabels[ctx.subtype] ?? 'commercial space for lease';

  const isCommercialIndustrial =
    ctx.propertyType === 'commercial' || ctx.propertyType === 'industrial';

  // Query 1: property-type-aware portal search
  const portalSites = isCommercialIndustrial
    ? 'site:loopnet.com OR site:commercialcafe.com OR site:crexi.com'
    : 'site:apartments.com OR site:zillow.com/homes OR site:rent.com';

  const sqftHint = ctx.buildingSqFt > 0 ? `${Math.round(ctx.buildingSqFt)} sqft` : '';
  const q1 = `${label} ${ctx.city} ${ctx.state} ${sqftHint} ${portalSites}`.trim();

  // Query 2: broader search with rent/sqft pricing focus
  const q2 = `${label} rent per square foot ${ctx.city} ${ctx.state} asking rent comparable lease ${new Date().getFullYear()}`;

  return [q1, q2];
}

// ─── Subject Property Filter ────────────────────────────────────────────────

function isSubjectProperty(compAddress: string, subjectAddress: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim();
  const compNorm = normalize(compAddress);
  const subjNorm = normalize(subjectAddress);
  if (compNorm === subjNorm) return true;
  const compTokens = compNorm.split(' ');
  const subjTokens = subjNorm.split(' ');
  if (!compTokens[0] || !subjTokens[0] || compTokens[0] !== subjTokens[0]) return false;
  const subjSet = new Set(subjTokens.slice(1).filter((t) => t.length > 1));
  return compTokens.slice(1).some((t) => t.length > 1 && subjSet.has(t));
}

// ─── Claude Extraction ──────────────────────────────────────────────────────

async function extractRentalsFromSearchContent(
  ctx: WebRentalContext,
  searchResults: Array<{ title: string; link: string; snippet: string }>,
  pageContent: string | null,
): Promise<ExtractedRental[]> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 60_000,
  });

  const searchBlock = searchResults
    .map(
      (r, i) =>
        `[Result ${i + 1}]\nTitle: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`,
    )
    .join('\n\n');

  const pageBlock = pageContent
    ? `\n\nDETAILED PAGE CONTENT (from most promising result):\n${pageContent}`
    : '';

  const subtypeLabels: Record<string, string> = {
    commercial_retail_strip: 'retail',
    commercial_office: 'office',
    commercial_restaurant: 'restaurant',
    commercial_hotel: 'hotel',
    commercial_mixed_use: 'mixed use',
    commercial_general: 'commercial',
    industrial_warehouse: 'warehouse',
    industrial_manufacturing: 'manufacturing',
    industrial_flex: 'flex/industrial',
    industrial_self_storage: 'self storage',
    industrial_general: 'industrial',
    residential_multifamily: 'apartment/multifamily',
    agricultural_general: 'agricultural',
    agricultural_crop: 'cropland',
    agricultural_pasture: 'pasture',
  };
  const label = subtypeLabels[ctx.subtype] ?? 'commercial';

  const prompt = `You are a real estate appraiser extracting comparable rental/lease data from web search results.

Subject property context:
- Address: ${ctx.address}, ${ctx.city}, ${ctx.state}
- Type: ${label}
- Approximate size: ~${ctx.buildingSqFt > 0 ? ctx.buildingSqFt.toLocaleString() + ' sqft' : 'unknown'}

Search results:
${searchBlock}${pageBlock}

Task: Extract up to 10 comparable RENTAL or LEASE listings from the above content.
Rules:
- Only include active or recent rentals/leases (NOT sales)
- Prefer properties in ${ctx.city} or immediately adjacent areas
- For commercial/industrial: extract asking rent per sqft if available
- If monthly rent is given, include it. If only $/sqft/year is given, include that.
- Do NOT include the subject property (${ctx.address})
- Set confidence to "high" if you have rent amount + address, "medium" if uncertain on one field, "low" if guessing

Return a JSON array. If no rentals found, return [].
Format:
[
  {
    "address": "street address",
    "monthlyRent": 5000,
    "squareFootage": 2500,
    "rentPerSqFtYear": 24.00,
    "propertyType": "${ctx.subtype}",
    "listingDate": "YYYY-MM-DD or null",
    "leaseType": "NNN or Gross or Modified Gross or null",
    "confidence": "high"
  }
]

IMPORTANT:
- monthlyRent is the total monthly rent in USD. If only annual rent is given, divide by 12.
- rentPerSqFtYear is the annual rent per square foot. If you have monthly rent and sqft, calculate it: (monthlyRent * 12) / squareFootage
- If you only have one of monthlyRent or rentPerSqFtYear, include what you have and set the other to null.

Return ONLY the JSON array. No explanation, no markdown.`;

  const response = await client.messages.create({
    model: AI_MODELS.FAST,
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

  let parsed: Array<Record<string, unknown>>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((c) => {
      const conf = String(c.confidence ?? '').toLowerCase();
      if (conf === 'low') return false;
      const hasAddress = typeof c.address === 'string' && c.address.trim().length > 0;
      const hasRent =
        (typeof c.monthlyRent === 'number' && c.monthlyRent > 0) ||
        (typeof c.rentPerSqFtYear === 'number' && c.rentPerSqFtYear > 0);
      if (!hasAddress || !hasRent) return false;
      if (isSubjectProperty(String(c.address), ctx.address)) {
        apiLogger.info({ address: c.address }, '[web-rentals] Filtered subject property');
        return false;
      }
      return true;
    })
    .map((c) => ({
      address: String(c.address).trim(),
      monthlyRent: typeof c.monthlyRent === 'number' ? c.monthlyRent : 0,
      squareFootage:
        typeof c.squareFootage === 'number' && c.squareFootage > 0
          ? c.squareFootage
          : null,
      rentPerSqFtYear:
        typeof c.rentPerSqFtYear === 'number' && c.rentPerSqFtYear > 0
          ? c.rentPerSqFtYear
          : null,
      propertyType: String(c.propertyType ?? ctx.subtype),
      listingDate:
        typeof c.listingDate === 'string' && c.listingDate.length >= 4
          ? c.listingDate
          : null,
      leaseType:
        typeof c.leaseType === 'string' && c.leaseType.length > 0
          ? c.leaseType
          : null,
      confidence: String(c.confidence ?? 'medium'),
    }));
}

// ─── Convert to Pipeline Format ─────────────────────────────────────────────

function toComparableRentalInserts(
  reportId: string,
  extracted: ExtractedRental[],
): ComparableRentalInsert[] {
  return extracted.map((r) => {
    // Calculate rent_per_sqft_yr from available data
    let rentPerSqFtYr: number | null = r.rentPerSqFtYear;
    if (!rentPerSqFtYr && r.monthlyRent > 0 && r.squareFootage && r.squareFootage > 0) {
      rentPerSqFtYr = Math.round(((r.monthlyRent * 12) / r.squareFootage) * 100) / 100;
    }

    return {
      report_id: reportId,
      address: r.address,
      lease_date: r.listingDate,
      pin: null,
      building_sqft_leased: r.squareFootage,
      rent_per_sqft_yr: rentPerSqFtYr,
      lease_type: r.leaseType,
      tenant_pays_description: null,
      adjustment_notes: `Web search (${r.confidence} confidence)`,
      effective_net_rent_per_sqft: rentPerSqFtYr,
    };
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Search the web for comparable rental listings when ATTOM returns nothing.
 * Uses Serper for discovery and Claude for structured data extraction.
 *
 * @returns Object with inserts (ComparableRentalInsert[]) and median rent/sqft/yr.
 *          Returns { inserts: [], medianRentPerSqFtYr: 0 } on failure.
 */
export async function findRentalsViaWeb(
  ctx: WebRentalContext,
): Promise<{ inserts: ComparableRentalInsert[]; medianRentPerSqFtYr: number }> {
  const empty = { inserts: [], medianRentPerSqFtYr: 0 };

  if (!process.env.SERPER_API_KEY) {
    apiLogger.info('[web-rentals] SERPER_API_KEY not configured — skipping');
    return empty;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    apiLogger.info('[web-rentals] ANTHROPIC_API_KEY not configured — skipping');
    return empty;
  }

  try {
    const [q1, q2] = buildRentalSearchQueries(ctx);
    apiLogger.info(
      `[web-rentals] Searching for rental comps near ${ctx.address}, ${ctx.city}...`,
    );

    // Run both searches in parallel
    const [results1, results2] = await Promise.all([
      serperSearch(q1),
      serperSearch(q2),
    ]);

    // Deduplicate by URL
    const seen = new Set<string>();
    const allResults = [...results1, ...results2]
      .filter((r) => {
        if (seen.has(r.link)) return false;
        seen.add(r.link);
        return true;
      })
      .slice(0, 15);

    if (allResults.length === 0) {
      apiLogger.info('[web-rentals] No search results returned');
      return empty;
    }

    // Fetch page content from the most promising result
    const isCommercialIndustrial =
      ctx.propertyType === 'commercial' || ctx.propertyType === 'industrial';
    const preferredResult = allResults.find((r) =>
      isCommercialIndustrial
        ? r.link.includes('loopnet.com') ||
          r.link.includes('commercialcafe.com') ||
          r.link.includes('crexi.com')
        : r.link.includes('apartments.com') ||
          r.link.includes('zillow.com') ||
          r.link.includes('rent.com'),
    ) ?? allResults[0];

    const pageContent = preferredResult
      ? await tryFetchPageContent(preferredResult.link)
      : null;

    if (pageContent) {
      apiLogger.info(
        `[web-rentals] Fetched page content from ${preferredResult.link} (${pageContent.length} chars)`,
      );
    }

    // Extract structured rental data via Claude
    const extracted = await extractRentalsFromSearchContent(
      ctx,
      allResults,
      pageContent,
    );

    if (extracted.length === 0) {
      apiLogger.info('[web-rentals] Claude extracted 0 rental comps from search results');
      return empty;
    }

    // Convert to pipeline format
    const inserts = toComparableRentalInserts(ctx.reportId, extracted);

    // Calculate median rent/sqft/yr from extracted data
    const rates = inserts
      .map((i) => i.rent_per_sqft_yr)
      .filter((r): r is number => r != null && r > 0)
      .sort((a, b) => a - b);

    let medianRentPerSqFtYr = 0;
    if (rates.length > 0) {
      const mid = Math.floor(rates.length / 2);
      medianRentPerSqFtYr =
        rates.length % 2 === 0
          ? (rates[mid - 1] + rates[mid]) / 2
          : rates[mid];
    }

    apiLogger.info(
      `[web-rentals] Found ${inserts.length} web rental comps, ` +
        `median $${medianRentPerSqFtYr.toFixed(2)}/sqft/yr: ` +
        inserts.map((i) => `${i.address} ($${i.rent_per_sqft_yr}/sf/yr)`).join(', '),
    );

    return { inserts, medianRentPerSqFtYr };
  } catch (err) {
    apiLogger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      '[web-rentals] Error'
    );
    return empty;
  }
}
