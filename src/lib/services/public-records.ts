// ─── Public Records Data Service ──────────────────────────────────────────────
// Free property data collection via web search + AI extraction.
// Searches public county assessor records and extracts structured property data
// using Claude. Falls back gracefully — never blocks the pipeline.
//
// Strategy:
//   1. Search web for "[address] property tax assessment [county] [state]"
//   2. Fetch the top public records results (county assessor, tax collector)
//   3. Use Claude to extract structured property data from the pages
//   4. Search for recent comparable sales in the area
//   5. Use Claude to extract structured comp data
//
// This service is FREE — the only cost is Anthropic API usage we're already paying for.
// It works for ANY county because Claude can parse any page format.

import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS } from '@/config/ai';
import type {
  AttomPropertyDetail,
  AttomSaleComp,
} from './attom';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PublicRecordsSearchParams {
  address: string;
  city: string;
  state: string;
  county?: string | null;
  propertyType?: string;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── AI Client ───────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;
function getAIClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 60_000,
    });
  }
  return _client;
}

// ─── Web Helpers ─────────────────────────────────────────────────────────────

async function webSearch(query: string): Promise<string[]> {
  // Use a search engine to find relevant URLs
  // In production, use a search API (Serper, SerpAPI, or Brave Search)
  // For now, construct likely URLs based on known patterns
  const urls: string[] = [];

  try {
    // Try fetching from a search API if configured
    const serperKey = process.env.SERPER_API_KEY;
    if (serperKey) {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 5 }),
      });
      if (response.ok) {
        const data = await response.json() as { organic?: Array<{ link: string }> };
        const results = data.organic ?? [];
        urls.push(...results.map((r: { link: string }) => r.link));
      }
    }
  } catch (err) {
    console.warn(`[public-records] Search API failed: ${err}`);
  }

  return urls;
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResourcefulBot/1.0; property-tax-research)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    // Strip HTML tags to get raw text, limit to 15k chars for AI context
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15_000);

    return text;
  } catch (err) {
    console.warn(`[public-records] Failed to fetch ${url}: ${err}`);
    return null;
  }
}

// ─── AI Extraction ───────────────────────────────────────────────────────────

async function extractPropertyDataFromText(
  pageTexts: string[],
  address: string,
  city: string,
  state: string
): Promise<Partial<AttomPropertyDetail> | null> {
  if (pageTexts.length === 0) return null;

  const combinedText = pageTexts.join('\n\n---PAGE BREAK---\n\n').slice(0, 30_000);

  try {
    const response = await getAIClient().messages.create({
      model: AI_MODELS.FAST,
      max_tokens: 2000,
      system: `You are a data extraction specialist. Extract structured property data from public county assessor records. Return ONLY valid JSON, no markdown, no explanation. If a field is not found, use null.`,
      messages: [{
        role: 'user',
        content: `Extract property data for "${address}, ${city}, ${state}" from these public records pages:

${combinedText}

Return this exact JSON structure:
{
  "assessed_value": <number or null>,
  "market_value": <number or null>,
  "land_value": <number or null>,
  "improvement_value": <number or null>,
  "tax_amount": <number or null>,
  "tax_year": <number or null>,
  "year_built": <number or null>,
  "building_sqft": <number or null>,
  "living_area_sqft": <number or null>,
  "lot_sqft": <number or null>,
  "bedrooms": <number or null>,
  "bathrooms": <number or null>,
  "stories": <number or null>,
  "property_class": <string or null>,
  "property_type": <string or null>,
  "zoning": <string or null>,
  "exterior_material": <string or null>,
  "roof_type": <string or null>,
  "basement_sqft": <number or null>,
  "garage_spaces": <number or null>,
  "pin": <string or null>,
  "legal_description": <string or null>,
  "latitude": <number or null>,
  "longitude": <number or null>,
  "county_name": <string or null>,
  "county_fips": <string or null>
}`,
      }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Parse the JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Convert to AttomPropertyDetail-compatible format
    return {
      attomId: 0,
      address: {
        line1: address,
        line2: `${city}, ${state}`,
        locality: city,
        countrySubd: state,
        postal1: '',
        postal2: '',
      },
      location: {
        latitude: parsed.latitude ?? 0,
        longitude: parsed.longitude ?? 0,
        countyFips: parsed.county_fips ?? '',
        countyName: parsed.county_name ?? '',
      },
      summary: {
        propertyType: parsed.property_type ?? '',
        propertyClass: parsed.property_class ?? null,
        propertyClassDescription: null,
        yearBuilt: parsed.year_built ?? 0,
        buildingSquareFeet: parsed.building_sqft ?? 0,
        livingSquareFeet: parsed.living_area_sqft ?? null,
        lotSquareFeet: parsed.lot_sqft ?? 0,
        bedrooms: parsed.bedrooms ?? 0,
        bathrooms: parsed.bathrooms ?? 0,
        stories: parsed.stories ?? 0,
      },
      assessment: {
        assessedValue: parsed.assessed_value ?? 0,
        marketValue: parsed.market_value ?? 0,
        landValue: parsed.land_value ?? 0,
        improvementValue: parsed.improvement_value ?? 0,
        assessmentYear: parsed.tax_year ?? 0,
        taxAmount: parsed.tax_amount ?? 0,
      },
      building: {
        garageType: null,
        garageSpaces: parsed.garage_spaces ?? null,
        basementType: null,
        basementSquareFeet: parsed.basement_sqft ?? null,
        exteriorMaterial: parsed.exterior_material ?? null,
        roofMaterial: parsed.roof_type ?? null,
        heatingType: null,
        coolingType: null,
        fireplaceCount: null,
        pool: false,
      },
      lot: {
        lotSquareFeet: parsed.lot_sqft ?? 0,
        zoning: parsed.zoning ?? null,
        legalDescription: parsed.legal_description ?? null,
      },
    } as AttomPropertyDetail;
  } catch (err) {
    console.error(`[public-records] AI extraction failed: ${err}`);
    return null;
  }
}

async function extractCompsFromText(
  pageTexts: string[],
  address: string,
  city: string,
  state: string
): Promise<AttomSaleComp[]> {
  if (pageTexts.length === 0) return [];

  const combinedText = pageTexts.join('\n\n---PAGE BREAK---\n\n').slice(0, 30_000);

  try {
    const response = await getAIClient().messages.create({
      model: AI_MODELS.FAST,
      max_tokens: 4000,
      system: `You are a data extraction specialist. Extract recently sold comparable properties from web pages. Return ONLY valid JSON array, no markdown. Each comp should be a recent sale within a few miles of the subject property. Only include sales with actual sale prices (not listings). Return empty array [] if no sold data found.`,
      messages: [{
        role: 'user',
        content: `Find recent comparable SOLD properties near "${address}, ${city}, ${state}" from these pages:

${combinedText}

Return a JSON array of comparable sales:
[
  {
    "address": "<street address>",
    "city": "<city>",
    "state": "<state>",
    "zip": "<zip>",
    "sale_price": <number>,
    "sale_date": "<YYYY-MM-DD>",
    "building_sqft": <number or null>,
    "lot_sqft": <number or null>,
    "year_built": <number or null>,
    "bedrooms": <number or null>,
    "bathrooms": <number or null>,
    "distance_miles": <number or null>,
    "property_type": "<string or null>"
  }
]`,
      }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;

    return parsed.map((comp, i) => ({
      attomId: i,
      address: String(comp.address ?? ''),
      city: String(comp.city ?? city),
      state: String(comp.state ?? state),
      zip: String(comp.zip ?? ''),
      salePrice: Number(comp.sale_price) || 0,
      saleDate: String(comp.sale_date ?? ''),
      pricePerSqFt: comp.building_sqft
        ? Math.round(Number(comp.sale_price) / Number(comp.building_sqft))
        : null,
      yearBuilt: comp.year_built ? Number(comp.year_built) : null,
      buildingSquareFeet: comp.building_sqft ? Number(comp.building_sqft) : null,
      lotSquareFeet: comp.lot_sqft ? Number(comp.lot_sqft) : null,
      bedrooms: comp.bedrooms ? Number(comp.bedrooms) : null,
      bathrooms: comp.bathrooms ? Number(comp.bathrooms) : null,
      stories: null,
      garageSpaces: null,
      basementSquareFeet: null,
      propertyType: comp.property_type ? String(comp.property_type) : null,
      distanceMiles: comp.distance_miles ? Number(comp.distance_miles) : null,
    }));
  } catch (err) {
    console.error(`[public-records] AI comp extraction failed: ${err}`);
    return [];
  }
}

// ─── Known County Assessor URL Patterns ──────────────────────────────────────
// Many counties use common platforms. We can construct direct URLs for these.

function buildKnownAssessorUrls(
  address: string,
  city: string,
  state: string,
  county?: string | null
): string[] {
  const encodedAddr = encodeURIComponent(address);
  const urls: string[] = [];

  // State-specific known assessor lookup patterns
  const statePatterns: Record<string, string[]> = {
    IL: [
      // Cook County (Chicago area)
      `https://www.cookcountyassessor.com/pin-search?address=${encodedAddr}`,
    ],
    TX: [
      // Many TX counties use the same pattern
      `https://esearch.${county?.toLowerCase().replace(/\s+/g, '')}cad.org/Search/SearchByAddress?SearchText=${encodedAddr}`,
    ],
    CA: [
      // LA County
      `https://portal.assessor.lacounty.gov/parceldetail/${encodedAddr}`,
    ],
    FL: [
      // Many FL counties use this pattern
      `https://www.${county?.toLowerCase().replace(/\s+/g, '')}pa.gov/Search/`,
    ],
  };

  if (statePatterns[state]) {
    urls.push(...statePatterns[state]);
  }

  return urls;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Search public records for property details using web search + AI extraction.
 * Returns data in the same format as ATTOM for seamless pipeline integration.
 */
export async function getPropertyDetailFromPublicRecords(
  params: PublicRecordsSearchParams
): Promise<ServiceResult<AttomPropertyDetail>> {
  const { address, city, state, county } = params;
  const fullAddress = `${address}, ${city}, ${state}`;

  console.log(`[public-records] Searching for property data: ${fullAddress}`);

  // Build search queries
  const queries = [
    `${address} ${city} ${state} property tax assessment`,
    `${address} ${city} ${state} county assessor property record`,
    county ? `${address} ${county} county ${state} assessed value` : null,
  ].filter(Boolean) as string[];

  // Collect URLs from web search + known patterns
  const allUrls = new Set<string>();

  // Add known assessor URLs
  const knownUrls = buildKnownAssessorUrls(address, city, state, county);
  knownUrls.forEach(u => allUrls.add(u));

  // Search the web
  for (const query of queries) {
    const urls = await webSearch(query);
    urls.forEach(u => allUrls.add(u));
  }

  if (allUrls.size === 0) {
    console.warn(`[public-records] No URLs found for ${fullAddress}`);
    return { data: null, error: 'No public records sources found for this address' };
  }

  console.log(`[public-records] Found ${allUrls.size} potential sources, fetching...`);

  // Fetch pages (limit to 5 to avoid excessive requests)
  const urlArray = Array.from(allUrls).slice(0, 5);
  const pageTexts: string[] = [];

  for (const url of urlArray) {
    const text = await fetchPageText(url);
    if (text && text.length > 200) {
      pageTexts.push(text);
      console.log(`[public-records] Fetched ${url.slice(0, 80)}... (${text.length} chars)`);
    }
  }

  if (pageTexts.length === 0) {
    return { data: null, error: 'Could not fetch any public records pages' };
  }

  // Extract structured data using AI
  const extracted = await extractPropertyDataFromText(pageTexts, address, city, state);

  if (!extracted) {
    return { data: null, error: 'AI extraction returned no usable data' };
  }

  console.log(
    `[public-records] Extracted: assessed=$${extracted.assessment?.assessedValue}, ` +
    `sqft=${extracted.summary?.buildingSquareFeet}, year=${extracted.summary?.yearBuilt}`
  );

  return { data: extracted as AttomPropertyDetail, error: null };
}

/**
 * Search for comparable sales using web search + AI extraction.
 * Returns data in the same format as ATTOM sale comps.
 */
export async function getSalesCompsFromPublicRecords(
  params: PublicRecordsSearchParams & {
    latitude?: number;
    longitude?: number;
    radiusMiles?: number;
  }
): Promise<ServiceResult<AttomSaleComp[]>> {
  const { address, city, state, county } = params;

  console.log(`[public-records] Searching for comparable sales near: ${address}, ${city}, ${state}`);

  const queries = [
    `recently sold homes near ${address} ${city} ${state}`,
    `${city} ${state} recent home sales ${new Date().getFullYear()}`,
    county ? `${county} county ${state} recent property sales` : null,
  ].filter(Boolean) as string[];

  const allUrls = new Set<string>();

  for (const query of queries) {
    const urls = await webSearch(query);
    urls.forEach(u => allUrls.add(u));
  }

  if (allUrls.size === 0) {
    return { data: [], error: null }; // No comps is not an error — we just have fewer
  }

  const urlArray = Array.from(allUrls).slice(0, 5);
  const pageTexts: string[] = [];

  for (const url of urlArray) {
    const text = await fetchPageText(url);
    if (text && text.length > 200) {
      pageTexts.push(text);
    }
  }

  const comps = await extractCompsFromText(pageTexts, address, city, state);

  console.log(`[public-records] Found ${comps.length} comparable sales`);

  return { data: comps, error: null };
}
