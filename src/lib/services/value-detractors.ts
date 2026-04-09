// ─── Value Detractor Detection ───────────────────────────────────────────────
// Our Blue Ocean moat: identify nearby negative externalities that suppress
// property value but the county assessor never accounts for. Competitors
// (Zillow, Redfin, Realtor) don't do this. We find what they miss.
//
// Sources:
//   1. Azure Maps POI Category Search — industrial facilities, waste
//      treatment, airports, railroads, power stations within proximity
//   2. Serper web search — recent news (construction, contamination,
//      crime spikes) near the property address
//   3. FEMA flood data — already captured in Stage 1
//
// Output is a structured list of detractors with estimated value impact
// percentages, passed to the narrative AI for professional framing.

import { apiLogger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValueDetractor {
  type: DetractorType;
  name: string;
  distance_meters: number;
  estimated_impact_pct: number; // negative = reduces value
  source: 'azure_maps' | 'web_search' | 'fema';
  details: string;
}

export type DetractorType =
  | 'industrial_facility'
  | 'waste_treatment'
  | 'power_infrastructure'
  | 'transportation_noise'
  | 'airport'
  | 'railroad'
  | 'highway'
  | 'environmental_contamination'
  | 'construction_disruption'
  | 'commercial_adjacency'
  | 'flood_zone'
  | 'crime_elevated'
  | 'cell_tower'
  | 'landfill';

// POI categories → detractor mapping
// Azure Maps POI Category IDs: https://learn.microsoft.com/en-us/azure/azure-maps/supported-map-data
const POI_CATEGORY_MAP: Record<string, { type: DetractorType; label: string; impactPct: (distM: number) => number }> = {
  // Industrial
  '7309': { type: 'industrial_facility', label: 'industrial facility', impactPct: (d) => d < 500 ? -8 : d < 1000 ? -5 : -2 },
  '9159': { type: 'industrial_facility', label: 'manufacturing facility', impactPct: (d) => d < 500 ? -8 : d < 1000 ? -5 : -2 },
  // Waste
  '9152': { type: 'waste_treatment', label: 'waste treatment plant', impactPct: (d) => d < 500 ? -12 : d < 1000 ? -7 : -3 },
  '9153': { type: 'landfill', label: 'landfill/waste disposal', impactPct: (d) => d < 1000 ? -15 : d < 2000 ? -8 : -4 },
  // Power
  '9157': { type: 'power_infrastructure', label: 'power plant/substation', impactPct: (d) => d < 300 ? -7 : d < 800 ? -4 : -2 },
  // Transportation noise
  '7383': { type: 'airport', label: 'airport', impactPct: (d) => d < 2000 ? -10 : d < 5000 ? -5 : -2 },
  '7380': { type: 'railroad', label: 'railroad station/yard', impactPct: (d) => d < 300 ? -8 : d < 800 ? -4 : -2 },
  // Cell towers
  '9156': { type: 'cell_tower', label: 'cell tower/telecommunications', impactPct: (d) => d < 200 ? -5 : d < 500 ? -3 : -1 },
};

const AZURE_KEY = process.env.AZURE_MAPS_SUBSCRIPTION_KEY ?? '';
const AZURE_POI_URL = 'https://atlas.microsoft.com/search/poi/category/json';

// ─── Azure Maps POI Proximity Search ─────────────────────────────────────────

async function searchNearbyDetractors(
  lat: number,
  lng: number,
  radiusMeters: number = 2000
): Promise<ValueDetractor[]> {
  if (!AZURE_KEY) {
    apiLogger.info('[value-detractors] Azure Maps not configured — skipping POI search');
    return [];
  }

  const detractors: ValueDetractor[] = [];
  const categories = Object.keys(POI_CATEGORY_MAP);

  // Query up to 3 batches to stay within reasonable API usage
  // Azure allows comma-separated category IDs
  const categoryBatches = [
    categories.slice(0, 3).join(','),
    categories.slice(3, 6).join(','),
    categories.slice(6).join(','),
  ].filter(Boolean);

  for (const batch of categoryBatches) {
    try {
      const url = new URL(AZURE_POI_URL);
      url.searchParams.set('api-version', '1.0');
      url.searchParams.set('subscription-key', AZURE_KEY);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('radius', String(radiusMeters));
      url.searchParams.set('limit', '10');
      url.searchParams.set('categorySet', batch);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      const response = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        apiLogger.warn({ status: response.status }, '[value-detractors] Azure POI search returned');
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (await response.json()) as any;
      const results = json?.results ?? [];

      for (const result of results) {
        const poiCategories = result.poi?.categorySet ?? [];
        const position = result.position ?? {};
        const distM = result.dist ?? computeDistance(lat, lng, position.lat, position.lon);

        for (const cat of poiCategories) {
          const catId = String(cat.id);
          const mapping = POI_CATEGORY_MAP[catId];
          if (!mapping) continue;

          detractors.push({
            type: mapping.type,
            name: result.poi?.name ?? mapping.label,
            distance_meters: Math.round(distM),
            estimated_impact_pct: mapping.impactPct(distM),
            source: 'azure_maps',
            details: `${mapping.label} "${result.poi?.name ?? 'unnamed'}" located ${Math.round(distM)}m from subject property`,
          });
        }
      }
    } catch (err) {
      apiLogger.warn({ err: err instanceof Error ? err.message : err }, '[value-detractors] POI search batch failed');
    }
  }

  // Deduplicate by name + type
  const seen = new Set<string>();
  return detractors.filter((d) => {
    const key = `${d.type}:${d.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Web Search for Local Issues ─────────────────────────────────────────────

async function searchLocalIssues(
  address: string,
  city: string,
  state: string
): Promise<ValueDetractor[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) return [];

  const detractors: ValueDetractor[] = [];

  // Search for negative news near the property
  const queries = [
    `"${city}" ${state} construction noise disruption near ${address.split(' ').slice(0, 3).join(' ')}`,
    `"${city}" ${state} environmental contamination industrial pollution site`,
  ];

  for (const query of queries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 3 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const data = (await response.json()) as { organic?: Array<{ link: string; title: string; snippet: string }> };
      const results = data.organic ?? [];

      for (const result of results.slice(0, 2)) {
        const snippet = result.snippet.toLowerCase();

        // Only flag genuinely negative findings
        if (snippet.includes('contamination') || snippet.includes('toxic') || snippet.includes('superfund')) {
          detractors.push({
            type: 'environmental_contamination',
            name: result.title,
            distance_meters: 0, // unknown from web search
            estimated_impact_pct: -10,
            source: 'web_search',
            details: `Per web search: "${result.snippet.slice(0, 200)}"`,
          });
        } else if (snippet.includes('construction') && (snippet.includes('major') || snippet.includes('highway') || snippet.includes('road'))) {
          detractors.push({
            type: 'construction_disruption',
            name: result.title,
            distance_meters: 0,
            estimated_impact_pct: -3,
            source: 'web_search',
            details: `Per web search: "${result.snippet.slice(0, 200)}"`,
          });
        }
      }
    } catch {
      // Non-fatal — web search is best-effort
    }
  }

  return detractors;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface DetractorAnalysis {
  detractors: ValueDetractor[];
  totalEstimatedImpactPct: number;
  summary: string;
}

/**
 * Detect value-suppressing factors near a property that competitors miss.
 * Non-fatal — returns empty analysis if APIs are unavailable.
 */
export async function detectValueDetractors(params: {
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
  floodZone?: string | null;
}): Promise<DetractorAnalysis> {
  const allDetractors: ValueDetractor[] = [];

  // Run POI search and web search in parallel
  const [poiResults, webResults] = await Promise.all([
    searchNearbyDetractors(params.lat, params.lng).catch((err) => {
      apiLogger.warn({ err }, '[value-detractors] POI search failed');
      return [] as ValueDetractor[];
    }),
    searchLocalIssues(params.address, params.city, params.state).catch((err) => {
      apiLogger.warn({ err }, '[value-detractors] Web search failed');
      return [] as ValueDetractor[];
    }),
  ]);

  allDetractors.push(...poiResults, ...webResults);

  // Add flood zone if applicable (already known from Stage 1)
  if (params.floodZone && !['X', 'C', ''].includes(params.floodZone)) {
    const floodImpact = params.floodZone.startsWith('A') ? -10
      : params.floodZone.startsWith('V') ? -15
      : -5;
    allDetractors.push({
      type: 'flood_zone',
      name: `FEMA Flood Zone ${params.floodZone}`,
      distance_meters: 0,
      estimated_impact_pct: floodImpact,
      source: 'fema',
      details: `Property is in FEMA flood zone ${params.floodZone}, which typically requires flood insurance and suppresses market value`,
    });
  }

  // Sort by impact magnitude (worst first)
  allDetractors.sort((a, b) => a.estimated_impact_pct - b.estimated_impact_pct);

  // Cap cumulative impact at -30% (individual detractors have diminishing effect)
  const rawTotal = allDetractors.reduce((sum, d) => sum + d.estimated_impact_pct, 0);
  const totalEstimatedImpactPct = Math.max(rawTotal, -30);

  // Build human-readable summary
  let summary = '';
  if (allDetractors.length > 0) {
    const topDetractors = allDetractors.slice(0, 5);
    summary = `${allDetractors.length} value-suppressing factor${allDetractors.length > 1 ? 's' : ''} detected within proximity: ` +
      topDetractors.map(d =>
        `${d.name} (${d.distance_meters > 0 ? `${d.distance_meters}m away, ` : ''}est. ${d.estimated_impact_pct}% impact)`
      ).join('; ') +
      `. Aggregate estimated impact: ${totalEstimatedImpactPct}%.`;
  }

  if (allDetractors.length > 0) {
    apiLogger.info(
      { detractorCount: allDetractors.length, totalImpactPct: totalEstimatedImpactPct },
      '[value-detractors] Analysis complete'
    );
  }

  return {
    detractors: allDetractors,
    totalEstimatedImpactPct,
    summary,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Haversine distance in meters between two lat/lng points */
function computeDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
