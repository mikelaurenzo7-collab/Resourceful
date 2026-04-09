// ─── Web Market Data Research ────────────────────────────────────────────────
// Researches real-time market data (cap rates, vacancy rates, construction costs,
// market appreciation) via Serper + Claude extraction to override hardcoded
// valuation.ts constants with location- and property-type-specific data.
//
// Sources: CBRE cap rate surveys, JLL market reports, NAR/CoStar vacancy data,
// RSMeans/HomeAdvisor construction costs, FHFA/Zillow appreciation indices.
//
// Returns MarketDataOverrides — each field is optional (null = use hardcoded default).
// Graceful: returns all-null on any failure, pipeline continues with defaults.

import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS } from '@/config/ai';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MarketDataOverrides {
  capRate: number | null;
  capRateLow: number | null;
  capRateHigh: number | null;
  capRateSurveySource: string | null;
  vacancyRatePct: number | null;
  vacancySource: string | null;
  constructionCostPerSqFt: number | null;
  constructionCostSource: string | null;
  appreciationPctAnnual: number | null;
  appreciationSource: string | null;
  marketRentPerSqFtYr: number | null;
  marketRentSource: string | null;
}

export interface MarketDataContext {
  city: string;
  state: string;
  county: string | null;
  propertyType: string;
  subtype: string;
}

const EMPTY_OVERRIDES: MarketDataOverrides = {
  capRate: null,
  capRateLow: null,
  capRateHigh: null,
  capRateSurveySource: null,
  vacancyRatePct: null,
  vacancySource: null,
  constructionCostPerSqFt: null,
  constructionCostSource: null,
  appreciationPctAnnual: null,
  appreciationSource: null,
  marketRentPerSqFtYr: null,
  marketRentSource: null,
};

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
      body: JSON.stringify({ q: query, num: 8 }),
    });
    if (!res.ok) {
      console.warn(`[web-market-data] Serper returned ${res.status}`);
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
    console.warn(
      '[web-market-data] Serper error:',
      err instanceof Error ? err.message : String(err),
    );
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

// ─── Query Builders ─────────────────────────────────────────────────────────

function buildCapRateQueries(ctx: MarketDataContext): string[] {
  const year = new Date().getFullYear();
  const subtypeLabels: Record<string, string> = {
    commercial_retail_strip: 'retail',
    commercial_office: 'office',
    commercial_restaurant: 'restaurant',
    commercial_hotel: 'hotel/hospitality',
    commercial_mixed_use: 'mixed use',
    commercial_general: 'commercial',
    industrial_warehouse: 'warehouse/industrial',
    industrial_manufacturing: 'industrial',
    industrial_flex: 'flex/industrial',
    industrial_self_storage: 'self storage',
    industrial_general: 'industrial',
    residential_multifamily: 'multifamily/apartment',
    agricultural_general: 'farmland',
    agricultural_crop: 'cropland',
    agricultural_pasture: 'pasture',
  };
  const label = subtypeLabels[ctx.subtype] ?? ctx.propertyType;

  return [
    `${label} cap rate ${ctx.city} ${ctx.state} ${year} survey CBRE OR "Marcus & Millichap" OR JLL`,
    `${label} capitalization rate ${ctx.state} ${year} investor survey market report`,
  ];
}

function buildVacancyQueries(ctx: MarketDataContext): string[] {
  const year = new Date().getFullYear();
  const subtypeLabels: Record<string, string> = {
    commercial_retail_strip: 'retail',
    commercial_office: 'office',
    industrial_warehouse: 'industrial',
    industrial_general: 'industrial',
    residential_multifamily: 'apartment',
  };
  const label = subtypeLabels[ctx.subtype] ?? ctx.propertyType;

  return [
    `${label} vacancy rate ${ctx.city} ${ctx.state} ${year} market report CoStar OR CBRE OR JLL`,
  ];
}

function buildConstructionCostQueries(ctx: MarketDataContext): string[] {
  const subtypeLabels: Record<string, string> = {
    residential_sfr: 'single family home',
    residential_condo: 'condo',
    residential_multifamily: 'apartment building',
    commercial_office: 'office building',
    commercial_retail_strip: 'retail',
    industrial_warehouse: 'warehouse',
    industrial_manufacturing: 'industrial',
  };
  const label = subtypeLabels[ctx.subtype] ?? ctx.propertyType + ' building';

  return [
    `cost to build ${label} per square foot ${ctx.state} ${new Date().getFullYear()} RSMeans OR HomeAdvisor OR Fixr`,
  ];
}

function buildAppreciationQueries(ctx: MarketDataContext): string[] {
  const year = new Date().getFullYear();
  return [
    `home price appreciation ${ctx.city} ${ctx.state} ${year} FHFA OR Zillow OR Case-Shiller annual percent`,
  ];
}

// ─── Claude Extraction ──────────────────────────────────────────────────────

async function extractMarketDataFromResults(
  ctx: MarketDataContext,
  capRateResults: Array<{ title: string; link: string; snippet: string }>,
  vacancyResults: Array<{ title: string; link: string; snippet: string }>,
  constructionResults: Array<{ title: string; link: string; snippet: string }>,
  appreciationResults: Array<{ title: string; link: string; snippet: string }>,
  pageContent: string | null,
): Promise<MarketDataOverrides> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 60_000,
  });

  const formatResults = (
    results: Array<{ title: string; link: string; snippet: string }>,
    section: string,
  ) => {
    if (results.length === 0) return '';
    return (
      `\n\n=== ${section} ===\n` +
      results
        .map(
          (r, i) =>
            `[${i + 1}] ${r.title}\n${r.link}\n${r.snippet}`,
        )
        .join('\n\n')
    );
  };

  const searchBlock =
    formatResults(capRateResults, 'CAP RATE DATA') +
    formatResults(vacancyResults, 'VACANCY RATE DATA') +
    formatResults(constructionResults, 'CONSTRUCTION COST DATA') +
    formatResults(appreciationResults, 'APPRECIATION/MARKET TREND DATA');

  const pageBlock = pageContent
    ? `\n\nDETAILED PAGE CONTENT:\n${pageContent}`
    : '';

  const subtypeLabels: Record<string, string> = {
    commercial_retail_strip: 'retail',
    commercial_office: 'office',
    commercial_restaurant: 'restaurant',
    commercial_hotel: 'hotel/hospitality',
    commercial_mixed_use: 'mixed use',
    commercial_general: 'commercial',
    industrial_warehouse: 'warehouse/industrial',
    industrial_manufacturing: 'manufacturing/industrial',
    industrial_flex: 'flex space',
    industrial_self_storage: 'self storage',
    industrial_general: 'industrial',
    residential_sfr: 'single family residential',
    residential_condo: 'condo',
    residential_multifamily: 'multifamily/apartment',
    agricultural_general: 'agricultural',
    agricultural_crop: 'cropland',
    agricultural_pasture: 'pasture',
  };
  const label = subtypeLabels[ctx.subtype] ?? ctx.propertyType;

  const prompt = `You are a real estate market analyst extracting current market data from web search results.

Context:
- Location: ${ctx.city}, ${ctx.state}${ctx.county ? ` (${ctx.county} County)` : ''}
- Property type: ${label}
- Year: ${new Date().getFullYear()}

Search results:
${searchBlock}${pageBlock}

Task: Extract the following market data points for ${label} properties in or near ${ctx.city}, ${ctx.state}. Use ONLY data from the search results — do not fabricate numbers.

Return a JSON object with these fields (set to null if not found in the results):
{
  "capRate": 0.065,
  "capRateLow": 0.055,
  "capRateHigh": 0.075,
  "capRateSurveySource": "CBRE 2025 Cap Rate Survey",
  "vacancyRatePct": 8.5,
  "vacancySource": "CBRE Q3 2025 Market Report",
  "constructionCostPerSqFt": 145,
  "constructionCostSource": "RSMeans 2025",
  "appreciationPctAnnual": 3.2,
  "appreciationSource": "FHFA House Price Index Q2 2025",
  "marketRentPerSqFtYr": 22.50,
  "marketRentSource": "CBRE Office Market Report Q3 2025"
}

Rules:
- capRate: decimal (e.g. 0.065 = 6.5%). Extract the most relevant cap rate for ${label} in ${ctx.state}.
- capRateLow/High: range if available, otherwise null.
- vacancyRatePct: percentage number (e.g. 8.5 means 8.5%). Must be between 1 and 50.
- constructionCostPerSqFt: cost in USD per square foot for new construction. Must be between 30 and 600.
- appreciationPctAnnual: annual home/property price appreciation. Must be between -10 and 30.
- marketRentPerSqFtYr: annual asking rent per sqft. Must be between 1 and 200.
- For each data point, cite the source name and year.
- If a data point is for a broader region (state or national) note that in the source.
- Set fields to null when no credible data is found.

Return ONLY the JSON object. No explanation, no markdown.`;

  const response = await client.messages.create({
    model: AI_MODELS.FAST,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ...EMPTY_OVERRIDES };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { ...EMPTY_OVERRIDES };
    }
  }

  // Validate and clamp each field
  const safeNum = (val: unknown, min: number, max: number): number | null => {
    if (val == null || typeof val !== 'number') return null;
    if (val < min || val > max || !isFinite(val)) return null;
    return Math.round(val * 10000) / 10000;
  };

  const safeStr = (val: unknown): string | null => {
    if (typeof val !== 'string' || val.length === 0) return null;
    return val.slice(0, 200);
  };

  return {
    capRate: safeNum(parsed.capRate, 0.02, 0.20),
    capRateLow: safeNum(parsed.capRateLow, 0.02, 0.20),
    capRateHigh: safeNum(parsed.capRateHigh, 0.02, 0.20),
    capRateSurveySource: safeStr(parsed.capRateSurveySource),
    vacancyRatePct: safeNum(parsed.vacancyRatePct, 1, 50),
    vacancySource: safeStr(parsed.vacancySource),
    constructionCostPerSqFt: safeNum(parsed.constructionCostPerSqFt, 30, 600),
    constructionCostSource: safeStr(parsed.constructionCostSource),
    appreciationPctAnnual: safeNum(parsed.appreciationPctAnnual, -10, 30),
    appreciationSource: safeStr(parsed.appreciationSource),
    marketRentPerSqFtYr: safeNum(parsed.marketRentPerSqFtYr, 1, 200),
    marketRentSource: safeStr(parsed.marketRentSource),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Research current market data for a specific location and property type.
 * Uses Serper web search + Claude extraction to find real, current values
 * for cap rates, vacancy, construction costs, and appreciation.
 *
 * @returns MarketDataOverrides with null for any field not found.
 */
export async function researchMarketData(
  ctx: MarketDataContext,
): Promise<MarketDataOverrides> {
  if (!process.env.SERPER_API_KEY) {
    console.log('[web-market-data] SERPER_API_KEY not configured — skipping');
    return { ...EMPTY_OVERRIDES };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[web-market-data] ANTHROPIC_API_KEY not configured — skipping');
    return { ...EMPTY_OVERRIDES };
  }

  try {
    console.log(
      `[web-market-data] Researching market data for ${ctx.subtype} in ${ctx.city}, ${ctx.state}...`,
    );

    // Build all queries
    const capRateQs = buildCapRateQueries(ctx);
    const vacancyQs = buildVacancyQueries(ctx);
    const constructionQs = buildConstructionCostQueries(ctx);
    const appreciationQs = buildAppreciationQueries(ctx);

    // Run all searches in parallel (max 5 Serper calls)
    const allQueries = [
      ...capRateQs,
      ...vacancyQs,
      ...constructionQs,
      ...appreciationQs,
    ];
    const searchResults = await Promise.all(
      allQueries.map((q) => serperSearch(q)),
    );

    // Partition results back to categories
    let idx = 0;
    const capRateResults = searchResults
      .slice(idx, idx + capRateQs.length)
      .flat();
    idx += capRateQs.length;
    const vacancyResults = searchResults
      .slice(idx, idx + vacancyQs.length)
      .flat();
    idx += vacancyQs.length;
    const constructionResults = searchResults
      .slice(idx, idx + constructionQs.length)
      .flat();
    idx += constructionQs.length;
    const appreciationResults = searchResults
      .slice(idx, idx + appreciationQs.length)
      .flat();

    const totalResults =
      capRateResults.length +
      vacancyResults.length +
      constructionResults.length +
      appreciationResults.length;

    if (totalResults === 0) {
      console.log('[web-market-data] No search results returned');
      return { ...EMPTY_OVERRIDES };
    }

    // Try to fetch one promising page for richer data
    const allCombined = [
      ...capRateResults,
      ...vacancyResults,
      ...constructionResults,
    ];
    const promisingResult = allCombined.find(
      (r) =>
        r.link.includes('cbre.com') ||
        r.link.includes('jll.com') ||
        r.link.includes('marcusmillichap.com') ||
        r.link.includes('nar.realtor'),
    );
    const pageContent = promisingResult
      ? await tryFetchPageContent(promisingResult.link)
      : null;

    if (pageContent) {
      console.log(
        `[web-market-data] Fetched page content from ${promisingResult!.link} (${pageContent.length} chars)`,
      );
    }

    // Extract structured market data via Claude
    const overrides = await extractMarketDataFromResults(
      ctx,
      capRateResults,
      vacancyResults,
      constructionResults,
      appreciationResults,
      pageContent,
    );

    const foundCount = Object.values(overrides).filter(
      (v) => v !== null,
    ).length;
    console.log(
      `[web-market-data] Extracted ${foundCount}/${Object.keys(overrides).length} market data points for ${ctx.city}, ${ctx.state}`,
    );

    if (overrides.capRate != null) {
      console.log(
        `[web-market-data] Cap rate: ${(overrides.capRate * 100).toFixed(2)}% (${overrides.capRateSurveySource})`,
      );
    }
    if (overrides.vacancyRatePct != null) {
      console.log(
        `[web-market-data] Vacancy: ${overrides.vacancyRatePct}% (${overrides.vacancySource})`,
      );
    }
    if (overrides.constructionCostPerSqFt != null) {
      console.log(
        `[web-market-data] Construction: $${overrides.constructionCostPerSqFt}/sqft (${overrides.constructionCostSource})`,
      );
    }
    if (overrides.appreciationPctAnnual != null) {
      console.log(
        `[web-market-data] Appreciation: ${overrides.appreciationPctAnnual}%/yr (${overrides.appreciationSource})`,
      );
    }

    return overrides;
  } catch (err) {
    console.warn(
      '[web-market-data] Error:',
      err instanceof Error ? err.message : String(err),
    );
    return { ...EMPTY_OVERRIDES };
  }
}
