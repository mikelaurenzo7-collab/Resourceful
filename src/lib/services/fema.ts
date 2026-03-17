// ─── FEMA Flood Zone API Service ──────────────────────────────────────────────
// Queries the FEMA National Flood Hazard Layer (NFHL) ArcGIS REST API
// to determine flood zone designations for a given coordinate.
// Returns data that maps directly to PropertyData columns:
//   flood_zone_designation, flood_map_panel_number,
//   flood_map_panel_date, flood_map_panel_date

// ─── Configuration ───────────────────────────────────────────────────────────

const BASE_URL =
  'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer';

// Layer IDs in the NFHL MapServer
const LAYERS = {
  floodHazardZones: 28, // S_FLD_HAZ_AR — flood hazard zones
} as const;

// ─── Response Types ──────────────────────────────────────────────────────────

/**
 * Maps directly to PropertyData flood columns:
 *   flood_zone_designation  → floodZoneDesignation
 *   flood_map_panel_number  → floodMapPanelNumber
 *   flood_map_panel_date    → floodMapPanelDate
 *   flood_map_panel_date → floodMapPanelEffectiveDate
 */
export interface FloodZoneResult {
  flood_zone_designation: string;        // e.g. "X", "AE", "A", "VE"
  flood_zone_subtype: string | null;     // e.g. "FLOODWAY", "0.2 PCT ANNUAL CHANCE"
  flood_map_panel_number: string | null; // FIRM panel number
  flood_map_panel_date: string | null;   // effective date of the panel
  community_name: string | null;
  static_bfe: number | null;            // base flood elevation if available
  source_description: string | null;
  raw_response: Record<string, unknown>; // Full response for fema_raw_response column
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function parseArcGISDate(epoch: number | null | undefined): string | null {
  if (epoch == null) return null;
  try {
    return new Date(epoch).toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Query the FEMA NFHL to determine the flood zone at a given lat/lng.
 *
 * Uses the ArcGIS REST "identify" endpoint which accepts a point geometry
 * and returns intersecting features from the flood hazard zone layer.
 *
 * Returns data that maps to PropertyData columns:
 *   flood_zone_designation, flood_map_panel_number,
 *   flood_map_panel_date, flood_map_panel_date
 */
export async function getFloodZone(
  lat: number,
  lng: number
): Promise<ServiceResult<FloodZoneResult>> {
  // Build the identify request.
  // The geometry is a point in WGS84 (WKID 4326). We use a small mapExtent
  // around the point and an imageDisplay to satisfy the identify endpoint's
  // required parameters.
  const tolerance = 0.0001;
  const mapExtent = `${lng - tolerance},${lat - tolerance},${lng + tolerance},${lat + tolerance}`;

  const url = new URL(`${BASE_URL}/identify`);
  url.searchParams.set('geometry', `${lng},${lat}`);
  url.searchParams.set('geometryType', 'esriGeometryPoint');
  url.searchParams.set('sr', '4326');
  url.searchParams.set('layers', `all:${LAYERS.floodHazardZones}`);
  url.searchParams.set('tolerance', '1');
  url.searchParams.set('mapExtent', mapExtent);
  url.searchParams.set('imageDisplay', '800,600,96');
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('f', 'json');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(
        `[fema] identify responded ${response.status}: ${body.slice(0, 500)}`
      );
      return {
        data: null,
        error: `FEMA API returned ${response.status}: ${response.statusText}`,
      };
    }

    const json = (await response.json()) as any;

    // The identify endpoint returns { results: [...] }
    if (!json.results || json.results.length === 0) {
      // No flood zone data means the point is likely outside mapped areas
      // or in a zone X (minimal risk) area without explicit mapping.
      return {
        data: {
          flood_zone_designation: 'X',
          flood_zone_subtype: 'AREA NOT MAPPED',
          flood_map_panel_number: null,
          flood_map_panel_date: null,
          community_name: null,
          static_bfe: null,
          source_description: 'No FEMA NFHL data at this location',
          raw_response: json,
        },
        error: null,
      };
    }

    // Take the first (most relevant) result
    const attrs = json.results[0].attributes ?? {};

    return {
      data: {
        flood_zone_designation: attrs.FLD_ZONE ?? attrs.ZONE_SUBTY ?? 'UNKNOWN',
        flood_zone_subtype: attrs.ZONE_SUBTY ?? null,
        flood_map_panel_number: attrs.FIRM_PAN ?? attrs.DFIRM_ID ?? null,
        flood_map_panel_date: parseArcGISDate(attrs.EFF_DATE ?? attrs.PANEL_DATE ?? attrs.PRE_DATE),
        community_name: attrs.COMM_NAME ?? attrs.CO_FIPS ?? null,
        static_bfe: attrs.STATIC_BFE != null ? Number(attrs.STATIC_BFE) : null,
        source_description: attrs.SOURCE_CIT ?? null,
        raw_response: json,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fema] identify error: ${message}`);
    return { data: null, error: `FEMA API request failed: ${message}` };
  }
}
