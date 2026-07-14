// ─── Evidence-Grounded Comparable Sales Router ────────────────────────────────
// Keeps the legacy residential/land search path intact while routing commercial
// and industrial properties to CRE-specific sources. It also disables the former
// model-training-knowledge value estimate: without observable market, income,
// cost, assessment, or transaction evidence, the pipeline must request more data
// rather than manufacture a concluded value.

import { generateFastText, isFastAiConfigured, parseJsonSnippet } from '@/lib/services/fast-ai';
import { fetchPageText } from '@/lib/utils/page-fetch';
import { apiLogger } from '@/lib/logger';
import type { AttomSaleComp } from './attom';
import {
  findCompsViaWeb as findLegacyCompsViaWeb,
  findSubjectPriorSaleViaWeb,
  type AIValueEstimate,
  type PriorSaleResult,
  type WebCompsContext,
} from './web-comps';

export type { AIValueEstimate, PriorSaleResult, WebCompsContext };
export { findSubjectPriorSaleViaWeb };

type SearchResult = {
  title: string;
  link: string;
  snippet: string;
};

type ExtractedCommercialSale = {
  address?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
  salePrice?: unknown;
  saleDate?: unknown;
  buildingSquareFeet?: unknown;
  yearBuilt?: unknown;
  propertyType?: unknown;
  confidence?: unknown;
  sourceUrl?: unknown;
};

const COMMERCIAL_SOURCE_HOSTS = [
  'crexi.com',
  'loopnet.com',
  'costar.com',
  'cbre.com',
  'colliers.com',
  'jll.com',
  'cushmanwakefield.com',
  'marcusmillichap.com',
] as const;

function isCommercialOrIndustrial(propertyType: string): boolean {
  return propertyType === 'commercial' || propertyType === 'industrial';
}

async function serperSearch(query: string): Promise<SearchResult[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 10 }),
    });

    if (!response.ok) {
      apiLogger.warn({ status: response.status, query }, '[web-comps-router] Serper search failed');
      return [];
    }

    const data = await response.json() as { organic?: SearchResult[] };
    return (data.organic ?? []).map((result) => ({
      title: result.title ?? '',
      link: result.link ?? '',
      snippet: result.snippet ?? '',
    }));
  } catch (error) {
    apiLogger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      '[web-comps-router] Serper search threw'
    );
    return [];
  }
}

function normalizeAddress(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/\b(street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|parkway|pkwy)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSubjectProperty(candidate: string, subject: string): boolean {
  const candidateNormalized = normalizeAddress(candidate);
  const subjectNormalized = normalizeAddress(subject);
  if (!candidateNormalized || !subjectNormalized) return false;
  if (candidateNormalized === subjectNormalized) return true;

  const candidateParts = candidateNormalized.split(' ');
  const subjectParts = subjectNormalized.split(' ');
  if (candidateParts[0] !== subjectParts[0]) return false;

  const subjectStreetTokens = new Set(subjectParts.slice(1).filter((part) => part.length > 2));
  return candidateParts.slice(1).some((part) => subjectStreetTokens.has(part));
}

function isAllowedSource(sourceUrl: string, searchResults: SearchResult[]): boolean {
  try {
    const source = new URL(sourceUrl);
    const sourceHost = source.hostname.replace(/^www\./, '');
    if (!COMMERCIAL_SOURCE_HOSTS.some((host) => sourceHost === host || sourceHost.endsWith(`.${host}`))) {
      return false;
    }

    return searchResults.some((result) => {
      try {
        const resultUrl = new URL(result.link);
        return resultUrl.hostname.replace(/^www\./, '') === sourceHost;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function isRecentClosedSale(saleDate: string): boolean {
  const timestamp = Date.parse(saleDate);
  if (!Number.isFinite(timestamp)) return false;

  const now = Date.now();
  const futureToleranceMs = 30 * 24 * 60 * 60 * 1000;
  const maximumAgeMs = 36 * 30.4375 * 24 * 60 * 60 * 1000;
  return timestamp <= now + futureToleranceMs && timestamp >= now - maximumAgeMs;
}

async function fetchPreferredCommercialPage(results: SearchResult[]): Promise<string | null> {
  const preferred = results.find((result) =>
    COMMERCIAL_SOURCE_HOSTS.some((host) => result.link.includes(host))
  );
  if (!preferred) return null;

  try {
    return await fetchPageText(preferred.link, 8_000, 8_000) ?? null;
  } catch {
    return null;
  }
}

async function extractCommercialSales(
  context: WebCompsContext,
  searchResults: SearchResult[],
  pageContent: string | null
): Promise<AttomSaleComp[]> {
  const resultText = searchResults
    .map((result, index) =>
      `[Result ${index + 1}]\nTitle: ${result.title}\nURL: ${result.link}\nSnippet: ${result.snippet}`
    )
    .join('\n\n');

  const propertyLabel = context.propertyType === 'industrial'
    ? 'industrial, flex, or warehouse property'
    : 'commercial property';

  const prompt = `Extract confirmed closed comparable sales for a ${propertyLabel}.

SUBJECT:
- Address: ${context.address}, ${context.city}, ${context.state}
- Approximate building area: ${context.buildingSqFt > 0 ? `${Math.round(context.buildingSqFt)} square feet` : 'unknown'}

SEARCH EVIDENCE:
${resultText}
${pageContent ? `\nFETCHED SOURCE CONTENT:\n${pageContent.slice(0, 8_000)}` : ''}

EVIDENCE RULES:
1. Use only facts explicitly stated in the supplied search results or fetched source content.
2. Include only confirmed CLOSED SALES. Exclude active listings, asking prices, leases, pending deals, portfolio estimates, assessed values, and model-generated values.
3. Every row must include an address, sale price, sale date, and sourceUrl copied from the supplied results.
4. The sale date must be within the last 36 months.
5. Exclude the subject property.
6. Do not infer a price, date, building size, or source. Omit uncertain fields and reject a row when price/date/address are not explicit.
7. confidence may be "high" or "medium" only. Use "medium" when one non-required attribute such as building area is missing.

Return only a JSON array in this shape:
[
  {
    "address": "123 Example Road",
    "city": "${context.city}",
    "state": "${context.state}",
    "zip": "",
    "salePrice": 2500000,
    "saleDate": "YYYY-MM-DD",
    "buildingSquareFeet": 18000,
    "yearBuilt": 1998,
    "propertyType": "${context.propertyType}",
    "confidence": "high",
    "sourceUrl": "https://source-from-results.example/..."
  }
]

Return [] when the evidence does not contain a confirmed sale.`;

  const response = await generateFastText({ prompt, maxTokens: 2_500 });
  const extracted = parseJsonSnippet<ExtractedCommercialSale[]>(response);
  if (!Array.isArray(extracted)) return [];

  return extracted
    .filter((sale) => {
      const address = typeof sale.address === 'string' ? sale.address.trim() : '';
      const saleDate = typeof sale.saleDate === 'string' ? sale.saleDate.trim() : '';
      const sourceUrl = typeof sale.sourceUrl === 'string' ? sale.sourceUrl.trim() : '';
      const salePrice = Number(sale.salePrice ?? 0);
      const confidence = String(sale.confidence ?? '').toLowerCase();

      return Boolean(
        address &&
        salePrice > 0 &&
        isRecentClosedSale(saleDate) &&
        (confidence === 'high' || confidence === 'medium') &&
        isAllowedSource(sourceUrl, searchResults) &&
        !isSubjectProperty(address, context.address)
      );
    })
    .slice(0, 6)
    .map((sale, index) => {
      const salePrice = Number(sale.salePrice);
      const buildingSquareFeet = Number(sale.buildingSquareFeet ?? 0) || null;

      return {
        attomId: -(10_000 + index),
        address: String(sale.address).trim(),
        city: typeof sale.city === 'string' && sale.city.trim() ? sale.city.trim() : context.city,
        state: typeof sale.state === 'string' && sale.state.trim() ? sale.state.trim() : context.state,
        zip: typeof sale.zip === 'string' ? sale.zip.trim() : '',
        salePrice,
        saleDate: String(sale.saleDate),
        pricePerSqFt: buildingSquareFeet
          ? Math.round((salePrice / buildingSquareFeet) * 100) / 100
          : null,
        yearBuilt: Number(sale.yearBuilt ?? 0) || null,
        buildingSquareFeet,
        lotSquareFeet: null,
        bedrooms: null,
        bathrooms: null,
        stories: null,
        garageSpaces: null,
        basementSquareFeet: null,
        propertyType: context.propertyType,
        distanceMiles: null,
      } satisfies AttomSaleComp;
    });
}

export async function findCompsViaWeb(context: WebCompsContext): Promise<AttomSaleComp[]> {
  if (!isCommercialOrIndustrial(context.propertyType)) {
    return findLegacyCompsViaWeb(context);
  }

  if (!process.env.SERPER_API_KEY || !isFastAiConfigured()) {
    apiLogger.info('[web-comps-router] CRE search not configured; continuing without web comps');
    return [];
  }

  const currentYear = new Date().getFullYear();
  const priorYear = currentYear - 1;
  const propertyLabel = context.propertyType === 'industrial'
    ? 'industrial flex warehouse'
    : 'commercial';
  const squareFeet = context.buildingSqFt > 0 ? `${Math.round(context.buildingSqFt)} sqft` : '';

  const queries = [
    `${propertyLabel} property closed sale ${context.city} ${context.state} ${currentYear} ${priorYear} sale price ${squareFeet} site:crexi.com OR site:loopnet.com OR site:costar.com`,
    `"${context.city}" ${context.state} ${propertyLabel} building sold sale price ${currentYear} ${priorYear} site:cbre.com OR site:colliers.com OR site:jll.com OR site:cushmanwakefield.com OR site:marcusmillichap.com`,
  ];

  try {
    const resultSets = await Promise.all(queries.map((query) => serperSearch(query)));
    const seen = new Set<string>();
    const results = resultSets.flat().filter((result) => {
      if (!result.link || seen.has(result.link)) return false;
      seen.add(result.link);
      return true;
    }).slice(0, 16);

    if (results.length === 0) return [];

    const pageContent = await fetchPreferredCommercialPage(results);
    const comps = await extractCommercialSales(context, results, pageContent);

    apiLogger.info(
      { propertyType: context.propertyType, resultCount: results.length, compCount: comps.length },
      '[web-comps-router] Evidence-grounded CRE search complete'
    );
    return comps;
  } catch (error) {
    apiLogger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      '[web-comps-router] CRE comparable search failed'
    );
    return [];
  }
}

export async function estimateValueViaAI(
  address: string,
  city: string,
  state: string,
  propertyType: string,
  latitude: number | null,
  longitude: number | null
): Promise<AIValueEstimate | null> {
  apiLogger.warn(
    { address, city, state, propertyType, latitude, longitude },
    '[web-comps-router] Unsupported model-knowledge valuation blocked; additional evidence is required'
  );
  return null;
}
