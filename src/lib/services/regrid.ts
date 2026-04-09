// ─── Regrid Parcel Intelligence API ──────────────────────────────────────────
// Nationwide parcel boundaries, zoning detail, legal descriptions, and
// ownership data. Provides data no other source in our stack offers:
//   - Exact parcel polygon (GeoJSON) for every US parcel
//   - Lot frontage/depth derived from geometry
//   - Zoning description (not just code)
//   - Legal description (metes-and-bounds or lot/block)
//   - Assessor Parcel Number (APN)
//   - Owner name and mailing address
//
// API docs: https://regrid.com/docs/api
// Auth: API token as query parameter or Bearer header

import type { ServiceResult } from './data-router';
import { apiLogger } from '@/lib/logger';

const BASE_URL = 'https://app.regrid.com/api/v2';
const FETCH_TIMEOUT_MS = 15_000;

// ─── Response Types ──────────────────────────────────────────────────────────

interface RegridGeometry {
  type: string;
  coordinates: number[][][] | number[][][][];
}

interface RegridParcelFields {
  parcelnumb: string | null;     // APN
  owner: string | null;          // Owner name
  mailadd: string | null;        // Owner mailing address
  mail_city: string | null;
  mail_state2: string | null;
  mail_zip: string | null;
  zoning: string | null;         // Zoning code
  zoning_description: string | null;
  legaldesc: string | null;      // Legal description
  ll_gisacre: number | null;     // GIS-computed acreage
  ll_gissqft: number | null;     // GIS-computed sqft
  lat: number | null;
  lon: number | null;
  usedesc: string | null;        // Land use description
  yearbuilt: number | null;
  improvval: number | null;      // Improvement value
  landval: number | null;        // Land value
  parval: number | null;         // Total parcel value
  fips: string | null;           // County FIPS
  county: string | null;
  state2: string | null;
  saddr: string | null;          // Site address
  scity: string | null;
  // Not all fields listed — just what we use
}

interface RegridParcelFeature {
  type: 'Feature';
  geometry: RegridGeometry | null;
  properties: {
    fields: RegridParcelFields;
  };
}

interface RegridSearchResponse {
  type: 'FeatureCollection';
  features: RegridParcelFeature[];
}

// ─── Normalized Output ───────────────────────────────────────────────────────

export interface RegridParcelData {
  parcelId: string | null;
  apn: string | null;
  owner: {
    name: string | null;
    mailingAddress: string | null;
  };
  parcel: {
    boundaryGeoJSON: Record<string, unknown> | null;
    gisAcreage: number | null;
    gisSqft: number | null;
    frontageFt: number | null;
    depthFt: number | null;
    shapeDescription: string | null;
    legalDescription: string | null;
  };
  zoning: {
    code: string | null;
    description: string | null;
  };
  assessment: {
    landValue: number | null;
    improvementValue: number | null;
    totalValue: number | null;
  };
  location: {
    latitude: number | null;
    longitude: number | null;
    countyFips: string | null;
    countyName: string | null;
  };
}

// ─── Geometry Helpers ────────────────────────────────────────────────────────

/**
 * Calculate approximate frontage and depth from a parcel polygon.
 * Uses the bounding box approach: frontage = shorter side, depth = longer side.
 * This is a reasonable approximation for most rectangular parcels.
 */
function estimateDimensionsFromGeometry(
  geometry: RegridGeometry | null
): { frontageFt: number | null; depthFt: number | null; shape: string } {
  if (!geometry || !geometry.coordinates) {
    return { frontageFt: null, depthFt: null, shape: 'unknown' };
  }

  try {
    // Extract the outer ring of coordinates
    let ring: number[][];
    if (geometry.type === 'Polygon') {
      ring = geometry.coordinates[0] as number[][];
    } else if (geometry.type === 'MultiPolygon') {
      ring = (geometry.coordinates[0] as number[][][])[0];
    } else {
      return { frontageFt: null, depthFt: null, shape: 'unknown' };
    }

    if (!ring || ring.length < 4) {
      return { frontageFt: null, depthFt: null, shape: 'unknown' };
    }

    // Calculate bounding box dimensions in feet
    const lons = ring.map(c => c[0]);
    const lats = ring.map(c => c[1]);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Approximate conversion: degrees to feet at average latitude
    const avgLat = (minLat + maxLat) / 2;
    const latDegToFt = 364_567.2; // ~111,120 meters per degree * 3.28084
    const lonDegToFt = latDegToFt * Math.cos((avgLat * Math.PI) / 180);

    const widthFt = (maxLon - minLon) * lonDegToFt;
    const heightFt = (maxLat - minLat) * latDegToFt;

    // Frontage is typically the shorter dimension (street-facing)
    const frontage = Math.round(Math.min(widthFt, heightFt) * 10) / 10;
    const depth = Math.round(Math.max(widthFt, heightFt) * 10) / 10;

    // Classify shape based on vertex count and aspect ratio
    const uniqueVertices = ring.length - 1; // GeoJSON closes the ring
    const aspectRatio = depth > 0 ? frontage / depth : 1;
    let shape = 'irregular';
    if (uniqueVertices === 4 && aspectRatio > 0.3) {
      shape = 'rectangular';
    } else if (uniqueVertices === 3) {
      shape = 'triangular';
    } else if (uniqueVertices === 5) {
      shape = 'pentagonal';
    } else if (uniqueVertices > 8) {
      shape = 'irregular';
    }

    return { frontageFt: frontage, depthFt: depth, shape };
  } catch {
    return { frontageFt: null, depthFt: null, shape: 'unknown' };
  }
}

// ─── API Client ──────────────────────────────────────────────────────────────

/**
 * Search Regrid for a parcel by street address.
 * Returns the best-matching parcel with full geometry and metadata.
 */
export async function getParcelByAddress(
  address: string,
  city: string,
  state: string
): Promise<ServiceResult<RegridParcelData>> {
  const apiKey = process.env.REGRID_API_KEY;
  if (!apiKey) {
    return { data: null, error: 'Regrid not configured (no REGRID_API_KEY)' };
  }

  const query = `${address}, ${city}, ${state}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const url = new URL(`${BASE_URL}/parcels/address`);
    url.searchParams.set('query', query);
    url.searchParams.set('token', apiKey);
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      apiLogger.warn({ status: res.status, body: body.slice(0, 200) }, '[regrid] API error');
      return { data: null, error: `Regrid API error ${res.status}` };
    }

    const json = (await res.json()) as RegridSearchResponse;

    if (!json.features || json.features.length === 0) {
      apiLogger.info({ query }, '[regrid] No parcels found for ""');
      return { data: null, error: 'No parcel found at this address' };
    }

    const feature = json.features[0];
    const fields = feature.properties.fields;
    const dims = estimateDimensionsFromGeometry(feature.geometry);

    // Build owner mailing address string
    const mailParts = [
      fields.mailadd,
      fields.mail_city,
      fields.mail_state2,
      fields.mail_zip,
    ].filter(Boolean);
    const mailingAddr = mailParts.length > 0 ? mailParts.join(', ') : null;

    const result: RegridParcelData = {
      parcelId: feature.properties.fields.parcelnumb ?? null,
      apn: fields.parcelnumb ?? null,
      owner: {
        name: fields.owner ?? null,
        mailingAddress: mailingAddr,
      },
      parcel: {
        boundaryGeoJSON: feature.geometry as unknown as Record<string, unknown> | null,
        gisAcreage: fields.ll_gisacre ?? null,
        gisSqft: fields.ll_gissqft ?? null,
        frontageFt: dims.frontageFt,
        depthFt: dims.depthFt,
        shapeDescription: dims.shape,
        legalDescription: fields.legaldesc ?? null,
      },
      zoning: {
        code: fields.zoning ?? null,
        description: fields.zoning_description ?? null,
      },
      assessment: {
        landValue: fields.landval ?? null,
        improvementValue: fields.improvval ?? null,
        totalValue: fields.parval ?? null,
      },
      location: {
        latitude: fields.lat ?? null,
        longitude: fields.lon ?? null,
        countyFips: fields.fips ?? null,
        countyName: fields.county ?? null,
      },
    };

    apiLogger.info(
      { query, apn: result.apn, acres: result.parcel.gisAcreage?.toFixed(2), zoningCode: result.zoning.code ?? 'N/A', hasGeometry: !!feature.geometry },
      '[regrid] Parcel found'
    );

    return { data: result, error: null };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      apiLogger.warn({ query }, '[regrid] Request timed out for ""');
      return { data: null, error: 'Regrid request timed out' };
    }
    apiLogger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Request failed');
    return { data: null, error: `Regrid request failed: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}
