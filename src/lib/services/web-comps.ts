// ─── Web Comparable Sales Search ─────────────────────────────────────────────
// Fallback service for when ATTOM returns 0 comparable sales.
// Uses Serper to search real estate portals (Redfin, Zillow, county records)
// and Claude to extract structured comparable sales data from the results.
//
// Returns AttomSaleComp[] so Stage 2's existing adjustment pipeline runs unchanged.
// Web-sourced comps are tagged with negative attomId values to distinguish them.
//
// Graceful: returns [] if SERPER_API_KEY or the configured FAST provider is not configured,
// or if any step fails — pipeline continues with cost/equity approach instead.

import { generateFastText, isFastAiConfigured, parseJsonSnippet } from '@/lib/services/fast-ai';
import type { AttomSaleComp } from './attom';
import { apiLogger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WebCompsContext {
  address: string;
  city: string;
  state: string;          // full state name or 2-letter abbrev
  propertyType: string;  // 'residential' | 'commercial' | 'industrial' | 'land' | 'agricultural'
  buildingSqFt: number;
}

// ─── Serper Search ──────────────────────────────────────────────────────────

async function serperSearch(
  query: string
): Promise<Array<{ title: string; link: string; snippet: string }>> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 8 }),
    });
    if (!res.ok) {
      apiLogger.warn({ status: res.status, query }, '[web-comps] Serper returned for query');
      return [];
    }
    const data = await res.json() as { organic?: Array<{ title: string; link: string; snippet: string }> };
    return (data.organic ?? []).map((r) => ({
      title: r.title ?? '',
      link: r.link ?? '',
      snippet: r.snippet ?? '',
    }));
  } catch (err) {
    apiLogger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Serper search error');
    return [];
  }
}

// ─── Page Content Fetch (optional enrichment) ────────────────────────────────

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

function buildSearchQueries(ctx: WebCompsContext): [string, string] {
  const year = new Date().getFullYear();
  const prevYear = year - 1;

  const isCommercialOrIndustrial = ctx.propertyType === 'commercial' || ctx.propertyType === 'industrial';

  if (isCommercialOrIndustrial) {
    // Commercial/industrial comps appear on CRE portals, not Redfin/Zillow.
    // Use LoopNet, CREXi, and county assessor search for confirmed sales.
    const propLabel: Record<string, string> = {
      commercial: 'commercial',
      industrial: 'industrial flex warehouse',
    };
    const label = propLabel[ctx.propertyType] ?? 'commercial';
    const sqftClause = ctx.buildingSqFt > 0 ? ` ${Math.round(ctx.buildingSqFt)} sqft` : '';

    const q1 = `${label} property sold ${ctx.city} ${ctx.state} ${year} ${prevYear} comparable sales price per square foot site:loopnet.com OR site:crexi.com OR site:cbre.com OR site:costar.com`;
    const q2 = `"${ctx.city}" ${ctx.state} ${label} building sold ${year} ${prevYear}${sqftClause} assessed value appeal comparable sales`;

    return [q1, q2];
  }

  const propLabel: Record<string, string> = {
    residential: 'single family home',
    land: 'vacant land',
    agricultural: 'agricultural land',
  };
  const label = propLabel[ctx.propertyType] ?? 'property';

  // Query 1: general recent sales in the area from real estate portals
  const q1 = `${label} sold ${ctx.city} ${ctx.state} ${year} ${prevYear} comparable sales site:redfin.com OR site:zillow.com OR site:realtor.com`;

  // Query 2: address-specific / county records angle
  const q2 = `comparable sales near "${ctx.address}" ${ctx.city} ${ctx.state} recently sold ${label} ${ctx.buildingSqFt > 0 ? Math.round(ctx.buildingSqFt) + ' sqft' : ''}`;

  return [q1, q2];
}

// ─── Subject Property Address Filter ───────────────────────────────────────
// After FAST-model extraction, strip any comp whose address matches the subject.
// The model is instructed to exclude it in the prompt, but occasionally still
// returns the subject property itself (e.g. a Zillow/Redfin listing page for
// the address). This catches those cases with a normalized string comparison.

function isSubjectProperty(compAddress: string, subjectAddress: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim();
  const compNorm  = normalize(compAddress);
  const subjNorm  = normalize(subjectAddress);
  // Quick full-string check
  if (compNorm === subjNorm) return true;
  // Number-level check: same house number AND shared meaningful street token
  const compTokens = compNorm.split(' ');
  const subjTokens = subjNorm.split(' ');
  if (!compTokens[0] || !subjTokens[0] || compTokens[0] !== subjTokens[0]) return false;
  const subjSet = new Set(subjTokens.slice(1).filter((t) => t.length > 1));
  return compTokens.slice(1).some((t) => t.length > 1 && subjSet.has(t));
}

// ─── Core Extraction (FAST Model) ────────────────────────────────────────────

async function extractCompsFromSearchContent(
  ctx: WebCompsContext,
  searchResults: Array<{ title: string; link: string; snippet: string }>,
  pageContent: string | null
): Promise<AttomSaleComp[]> {
  const searchBlock = searchResults
    .map((r, i) => `[Result ${i + 1}]\nTitle: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`)
    .join('\n\n');

  const pageBlock = pageContent
    ? `\n\nDETAILED PAGE CONTENT (from most promising result):\n${pageContent}`
    : '';

  const propLabel: Record<string, string> = {
    residential: 'single family home',
    commercial: 'commercial building',
    industrial: 'industrial/flex building',
    land: 'vacant land',
    agricultural: 'agricultural land',
  };
  const label = propLabel[ctx.propertyType] ?? 'property';

  const prompt = `You are a real estate appraiser extracting comparable sales data from web search results.

Subject property context:
- Address: ${ctx.address}, ${ctx.city}, ${ctx.state}
- Type: ${label}
- Approximate size: ~${ctx.buildingSqFt > 0 ? ctx.buildingSqFt.toLocaleString() + ' sqft' : 'unknown'}

Search results:
${searchBlock}${pageBlock}

Task: Extract up to 6 recently SOLD comparable properties from the above content.
Rules:
- Only include confirmed SALES (not active listings, pending sales, or rentals)
- Sale must have occurred within the last 36 months
- Do NOT include the subject property (${ctx.address})
- Prefer properties in ${ctx.city} or immediately adjacent neighborhoods
- If square footage is unavailable, omit the buildingSquareFeet field
- Set confidence to "high" if you have price + date + address, "medium" if uncertain on one field, "low" if guessing

Return a JSON array. If no confirmed sales found, return [].
Format:
[
  {
    "address": "street address only (no city/state)",
    "city": "${ctx.city}",
    "state": "2-letter abbreviation",
    "zip": "zip or empty string",
    "salePrice": 450000,
    "saleDate": "YYYY-MM-DD",
    "buildingSquareFeet": 1950,
    "yearBuilt": 1988,
    "propertyType": "${ctx.propertyType}",
    "confidence": "high"
  }
]

Return ONLY the JSON array. No explanation, no markdown.`;

  const text = await generateFastText({ prompt, maxTokens: 2000 });
  const parsed = parseJsonSnippet<Array<Record<string, unknown>>>(text);
  if (!parsed || !Array.isArray(parsed)) return [];

  const comps: AttomSaleComp[] = parsed
    .filter((c) => {
      const conf = String(c.confidence ?? '').toLowerCase();
      const price = Number(c.salePrice ?? 0);
      const hasDate = typeof c.saleDate === 'string' && c.saleDate.length >= 4;
      const hasAddress = typeof c.address === 'string' && c.address.trim().length > 0;
      if (conf === 'low' || price <= 0 || !hasDate || !hasAddress) return false;
      // Exclude the subject property — Claude sometimes returns it despite instructions
      if (isSubjectProperty(String(c.address), ctx.address)) {
        apiLogger.info({ address: c.address }, '[web-comps] Filtered subject property from comps');
        return false;
      }
      return true;
    })
    .map((c, i) => {
      const price = Number(c.salePrice);
      const sqft = c.buildingSquareFeet ? Number(c.buildingSquareFeet) : null;
      return {
        attomId: -(i + 1),  // negative = web-sourced, not from ATTOM
        address: String(c.address ?? '').trim(),
        city: String(c.city ?? ctx.city).trim(),
        state: String(c.state ?? ctx.state).trim(),
        zip: String(c.zip ?? '').trim(),
        salePrice: price,
        saleDate: String(c.saleDate ?? ''),
        pricePerSqFt: sqft && sqft > 0 ? Math.round((price / sqft) * 100) / 100 : null,
        yearBuilt: c.yearBuilt ? Number(c.yearBuilt) : null,
        buildingSquareFeet: sqft,
        lotSquareFeet: null,
        bedrooms: null,
        bathrooms: null,
        stories: null,
        garageSpaces: null,
        basementSquareFeet: null,
        propertyType: String(c.propertyType ?? ctx.propertyType),
        distanceMiles: null,  // unknown from web data — adjustment logic handles null
      } satisfies AttomSaleComp;
    });

  return comps;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Search the web for comparable property sales when ATTOM returns nothing.
 * Uses Serper for discovery and the configured FAST model for structured data extraction.
 *
 * @returns Array of AttomSaleComp (web-sourced, negative attomId).
 *          Returns [] if not configured, no results, or any failure.
 */
export async function findCompsViaWeb(ctx: WebCompsContext): Promise<AttomSaleComp[]> {
  if (!process.env.SERPER_API_KEY) {
    apiLogger.info('[web-comps] SERPER_API_KEY not configured — skipping web comp search');
    return [];
  }
  if (!isFastAiConfigured()) {
    apiLogger.info('[web-comps] FAST AI provider not configured — skipping web comp search');
    return [];
  }

  try {
    const [q1, q2] = buildSearchQueries(ctx);
    apiLogger.info({ address: ctx.address, city: ctx.city }, '[web-comps] Searching web for comparable sales near , ...');

    // Run both searches in parallel
    const [results1, results2] = await Promise.all([
      serperSearch(q1),
      serperSearch(q2),
    ]);

    // Deduplicate by URL
    const seen = new Set<string>();
    const allResults = [...results1, ...results2].filter((r) => {
      if (seen.has(r.link)) return false;
      seen.add(r.link);
      return true;
    }).slice(0, 12);

    if (allResults.length === 0) {
      apiLogger.info('[web-comps] No search results returned');
      return [];
    }

    // Try to fetch page content from the most promising result
    // Prefer Redfin or Zillow sold listings pages (they have the most structured data)
    const preferredResult = allResults.find(
      (r) =>
        (r.link.includes('redfin.com') || r.link.includes('zillow.com')) &&
        (r.link.includes('/sold') || r.link.includes('sold') || r.link.includes('/homes'))
    ) ?? allResults[0];

    const pageContent = preferredResult
      ? await tryFetchPageContent(preferredResult.link)
      : null;

    if (pageContent) {
      apiLogger.info({ link: preferredResult.link, length: pageContent.length }, '[web-comps] Fetched page content from ( chars)');
    }

    // Use the configured FAST model to extract structured comps from search snippets + page content
    const comps = await extractCompsFromSearchContent(ctx, allResults, pageContent);

    if (comps.length > 0) {
      apiLogger.info(
        { compCount: comps.length, comps: comps.map((c) => ({ address: c.address, salePrice: c.salePrice })) },
        '[web-comps] Extracted web-sourced comps'
      );
    } else {
      apiLogger.info('[web-comps] FAST model found no confirmed sales in search results');
    }

    return comps;
  } catch (err) {
    apiLogger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      '[web-comps] Fallback comp search failed'
    );
    return [];
  }
}

// ─── Subject Property Prior Sale Search ──────────────────────────────────────

export interface PriorSaleResult {
  salePrice: number;
  saleDate: string;   // ISO date string
  source: string;     // URL where data was found
}

/**
 * Search the web for the subject property's own past sale price.
 * Used as a last-resort value indicator when ATTOM has no data and no comps exist.
 *
 * @returns PriorSaleResult or null if not found / not configured.
 */
export async function findSubjectPriorSaleViaWeb(
  address: string,
  city: string,
  state: string
): Promise<PriorSaleResult | null> {
  if (!process.env.SERPER_API_KEY || !isFastAiConfigured()) return null;

  try {
    const fullAddress = `${address}, ${city}, ${state}`;
    const queries = [
      `"${address}" ${city} ${state} sold price site:redfin.com OR site:zillow.com OR site:realtor.com`,
      `${fullAddress} sale history property sold last sold`,
    ];

    apiLogger.info({ fullAddress }, '[web-comps] Searching for prior sale of subject');
    const [r1, r2] = await Promise.all([serperSearch(queries[0]), serperSearch(queries[1])]);

    const seen = new Set<string>();
    const allResults = [...r1, ...r2].filter((r) => {
      if (seen.has(r.link)) return false;
      seen.add(r.link);
      return true;
    }).slice(0, 8);

    if (allResults.length === 0) {
      apiLogger.info('[web-comps] No results for subject prior sale search');
      return null;
    }

    // Try to get the most relevant page (the property's own Redfin/Zillow page)
    const subjectPage = allResults.find(
      (r) => r.link.includes('redfin.com') || r.link.includes('zillow.com')
    ) ?? allResults[0];
    const pageContent = subjectPage ? await tryFetchPageContent(subjectPage.link) : null;

    const searchBlock = allResults
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.link}\n${r.snippet}`)
      .join('\n\n');

    const prompt = `You are a real estate researcher. Find the most recent confirmed arm's-length sale price for this specific property:

Address: ${fullAddress}

Search results:
${searchBlock}${pageContent ? `\n\nPage content:\n${pageContent.substring(0, 4000)}` : ''}

Extract the most recent CLOSED arm's-length sale (not foreclosure, not short sale, not gift deed, not a current/active/pending listing) for this exact address.

CRITICAL RULES:
- Only return a result if a specific historical closing price AND closing date are explicitly stated in the search snippets or page content above. Do NOT infer, estimate, or guess.
- The saleDate must be a real, fully-specified historical date (year/month/day). Reject anything dated within the last 30 days, anything in the future, or anything described as "listed," "for sale," "asking," "estimated," "Zestimate," or "Redfin Estimate."
- The source must be a real URL from the search results above.
- If no closed historical sale is unambiguously documented in the source material, return exactly the word: null

Return JSON object or null:
{
  "salePrice": 425000,
  "saleDate": "2021-06-15",
  "source": "https://..."
}
Only return this exact JSON or the word null. No explanation.`;

    const text = await generateFastText({ prompt, maxTokens: 300 });
    if (text === 'null' || !text) return null;

    const parsed = parseJsonSnippet<{ salePrice: number; saleDate: string; source: string }>(text);
    if (!parsed) return null;

    if (!parsed.salePrice || parsed.salePrice <= 0 || !parsed.saleDate) return null;

    // Sanity guard — reject sales dated in the future or within the last 30 days.
    // The model is prone to hallucinating "today's" date when search snippets
    // describe a current listing rather than a closed sale. Closed comparable
    // transactions for appraisal work should be at least a month old.
    const saleMs = new Date(parsed.saleDate).getTime();
    if (!Number.isFinite(saleMs)) {
      apiLogger.warn({ saleDate: parsed.saleDate }, '[web-comps] Rejected prior sale: unparseable date');
      return null;
    }
    const ageDays = (Date.now() - saleMs) / (24 * 3600 * 1000);
    if (ageDays < 30) {
      apiLogger.warn(
        { saleDate: parsed.saleDate, ageDays: Math.round(ageDays) },
        '[web-comps] Rejected prior sale: date is in the future or <30 days old (likely hallucination or active listing)'
      );
      return null;
    }
    if (!parsed.source || !/^https?:\/\//i.test(parsed.source)) {
      apiLogger.warn({ source: parsed.source }, '[web-comps] Rejected prior sale: missing or invalid source URL');
      return null;
    }

    apiLogger.info(
      { salePrice: parsed.salePrice, saleDate: parsed.saleDate, source: parsed.source },
      '[web-comps] Subject prior sale found'
    );
    return { salePrice: parsed.salePrice, saleDate: parsed.saleDate, source: parsed.source };
  } catch (err) {
    apiLogger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Subject prior sale web search failed');
    return null;
  }
}

// ─── AI Knowledge-Based Value Estimate ───────────────────────────────────────

export interface AIValueEstimate {
  estimatedValue: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: 'low' | 'medium';
  reasoning: string;
}

/**
 * Use the configured FAST model's training knowledge to estimate market value when all data sources fail.
 * Returns a neighborhood-level estimate clearly labeled as AI-generated.
 * Only called as absolute last resort — after ATTOM, web comps, and deed history all fail.
 */
export async function estimateValueViaAI(
  address: string,
  city: string,
  state: string,
  propertyType: string,
  latitude: number | null,
  longitude: number | null
): Promise<AIValueEstimate | null> {
  if (!isFastAiConfigured()) return null;

  try {
    const locationHint = latitude && longitude
      ? ` (coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
      : '';

    const prompt = `You are a certified real estate appraiser with extensive knowledge of US residential real estate markets.

Property: ${address}, ${city}, ${state}${locationHint}
Type: ${propertyType}

Based on your knowledge of this location and comparable neighborhoods, provide a reasonable market value estimate for this property as of early 2026. Consider: neighborhood, city/metro area, typical property sizes and styles, recent market trends.

Return ONLY a JSON object:
{
  "estimatedValue": 485000,
  "rangeLow": 420000,
  "rangeHigh": 550000,
  "confidence": "low",
  "reasoning": "Brief 1-2 sentence explanation of what drives value in this neighborhood."
}

Rules:
- confidence must be "low" (no MLS data available)
- estimatedValue should be the midpoint of your range
- rangeLow and rangeHigh should be ±15-20% around your estimate
- reasoning must be factual and neighborhood-specific
- Return ONLY the JSON object, no explanation`;

    const text = await generateFastText({ prompt, maxTokens: 300 });
    const parsed = parseJsonSnippet<AIValueEstimate>(text);
    if (!parsed) return null;

    if (!parsed.estimatedValue || parsed.estimatedValue <= 0) return null;

    apiLogger.warn(
      { address, estimatedValue: parsed.estimatedValue, rangeLow: parsed.rangeLow, rangeHigh: parsed.rangeHigh },
      '[web-comps] AI knowledge-based estimate'
    );
    return {
      estimatedValue: Math.round(parsed.estimatedValue / 1000) * 1000,
      rangeLow: Math.round(parsed.rangeLow / 1000) * 1000,
      rangeHigh: Math.round(parsed.rangeHigh / 1000) * 1000,
      confidence: 'low',
      reasoning: parsed.reasoning ?? '',
    };
  } catch (err) {
    apiLogger.warn({ err: err instanceof Error ? err.message : String(err) }, 'AI value estimate failed');
    return null;
  }
}
