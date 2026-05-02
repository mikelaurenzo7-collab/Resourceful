// ─── Azure Maps + Mapillary Services ─────────────────────────────────────────
// Geocoding, static maps, street-level imagery, and address autocomplete.
// Replaces the former Google Maps service layer.

// ─── Configuration ───────────────────────────────────────────────────────────

const AZURE_KEY = process.env.AZURE_MAPS_SUBSCRIPTION_KEY ?? '';
const MAPILLARY_TOKEN = process.env.NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN ?? '';

const AZURE_GEOCODE_URL = 'https://atlas.microsoft.com/search/address/json';
const AZURE_STATIC_MAP_URL = 'https://atlas.microsoft.com/map/static/png';
const AZURE_FUZZY_SEARCH_URL = 'https://atlas.microsoft.com/search/fuzzy/json';
const MAPILLARY_SEARCH_URL = 'https://graph.mapillary.com/images';

import { apiLogger } from '@/lib/logger';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface GeocodeResult {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId: string;
  county: string | null;
  countyFips: string | null;
  streetNumber: string | null;
  route: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export interface StaticMapParams {
  lat: number;
  lng: number;
  zoom: number;
  width: number;
  height: number;
  markers?: Array<{ lat: number; lng: number; label?: string; color?: string }>;
}

export interface StreetViewParams {
  lat: number;
  lng: number;
  heading?: number;
  pitch?: number;
  width: number;
  height: number;
}

export interface AddressAutocompleteConfig {
  subscriptionKey: string;
  clientId: string;
  options: {
    countrySet: string[];
    typeahead: boolean;
    limit: number;
  };
}

export interface AutocompleteSuggestion {
  formattedAddress: string;
  streetNumber: string | null;
  route: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  latitude: number;
  longitude: number;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── US Census Bureau Geocoder (Free Fallback) ──────────────────────────────
// No API key required. Covers all US addresses. Used when Azure Maps is
// unavailable or not configured.

const CENSUS_GEOCODE_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';

async function geocodeWithCensus(
  address: string
): Promise<ServiceResult<GeocodeResult>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const url = new URL(CENSUS_GEOCODE_URL);
    url.searchParams.set('address', address);
    url.searchParams.set('benchmark', 'Public_AR_Current');
    url.searchParams.set('vintage', 'Current_Current');
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { data: null, error: `Census geocoder returned ${response.status}` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await response.json()) as any;
    const matches = json?.result?.addressMatches;

    if (!matches || matches.length === 0) {
      return { data: null, error: 'Census geocoder returned no matches' };
    }

    const match = matches[0];
    const coords = match.coordinates ?? {};
    const geo = match.geographies ?? {};
    const counties = geo['Counties'] ?? [];
    const countyGeo = counties[0];
    const stateCode = countyGeo?.STATE ?? null;
    const countyCode = countyGeo?.COUNTY ?? null;
    const countyFips = stateCode && countyCode ? `${stateCode}${countyCode}` : null;
    const countyName = countyGeo?.BASENAME ?? countyGeo?.NAME ?? null;

    const addressComponents = match.addressComponents ?? {};

    apiLogger.info({ address }, '[geocode] Census fallback succeeded for');

    return {
      data: {
        formattedAddress: match.matchedAddress ?? address,
        latitude: coords.y ?? 0,
        longitude: coords.x ?? 0,
        placeId: '',
        county: countyName,
        countyFips,
        streetNumber: addressComponents.fromAddress ?? null,
        route: addressComponents.streetName ?? null,
        city: addressComponents.city ?? null,
        state: addressComponents.state ?? null,
        zip: addressComponents.zip ?? null,
      },
      error: null,
    };
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ message }, '[geocode] Census fallback error');
    return { data: null, error: `Census geocoding failed: ${message}` };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Geocode a street address. Uses Azure Maps as primary, falls back to
 * US Census Bureau geocoder if Azure is unavailable or not configured.
 * The Census geocoder is free, requires no API key, and returns FIPS codes.
 */
export async function geocodeAddress(
  address: string
): Promise<ServiceResult<GeocodeResult>> {
  if (AZURE_KEY) {
    const azureResult = await geocodeWithAzure(address);
    if (azureResult.data) return azureResult;
    apiLogger.warn({ error: azureResult.error }, '[geocode] Azure Maps failed, falling back to Census');
  } else {
    apiLogger.info('[geocode] Azure Maps subscription key not configured, using Census geocoder');
  }

  return geocodeWithCensus(address);
}

/**
 * Geocode using Azure Maps Search API.
 */
async function geocodeWithAzure(
  address: string
): Promise<ServiceResult<GeocodeResult>> {
  const url = new URL(AZURE_GEOCODE_URL);
  url.searchParams.set('api-version', '1.0');
  url.searchParams.set('subscription-key', AZURE_KEY);
  url.searchParams.set('query', address);
  url.searchParams.set('countrySet', 'US');
  url.searchParams.set('limit', '1');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        data: null,
        error: `Azure Maps Geocoding returned ${response.status}: ${response.statusText}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await response.json()) as any;
    const results = json.results;

    if (!results?.length) {
      return {
        data: null,
        error: 'Azure Maps geocoding returned no results',
      };
    }

    const result = results[0];
    const pos = result.position ?? {};
    const addr = result.address ?? {};

    return {
      data: {
        formattedAddress: addr.freeformAddress ?? address,
        latitude: pos.lat ?? 0,
        longitude: pos.lon ?? 0,
        placeId: result.id ?? '',
        county: addr.countrySecondarySubdivision
          ? addr.countrySecondarySubdivision.replace(/\s*(County|Parish|Borough)$/i, '').trim()
          : null,
        countyFips: null, // Azure Maps does not return FIPS; Census fallback does
        streetNumber: addr.streetNumber ?? null,
        route: addr.streetName ?? null,
        city: addr.municipality ?? null,
        state: addr.countrySubdivision ?? null,
        zip: addr.postalCode ?? null,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ message }, '[azure-maps] geocode error');
    return { data: null, error: `Geocoding request failed: ${message}` };
  }
}

/**
 * Build an Azure Maps Static Image URL.
 * Uses the Render V2 API with pin markers.
 */
export function getStaticMapUrl(params: StaticMapParams): string {
  if (!AZURE_KEY) return '';

  const url = new URL(AZURE_STATIC_MAP_URL);
  url.searchParams.set('api-version', '2024-04-01');
  url.searchParams.set('subscription-key', AZURE_KEY);
  url.searchParams.set('zoom', String(params.zoom));
  url.searchParams.set('center', `${params.lng},${params.lat}`);
  url.searchParams.set('width', String(Math.min(params.width, 8192)));
  url.searchParams.set('height', String(Math.min(params.height, 8192)));
  url.searchParams.set('layer', 'basic');
  url.searchParams.set('style', 'main');

  if (params.markers?.length) {
    // Azure Maps pin format: pin-round-{color}||{label}|{lng} {lat}
    for (const m of params.markers) {
      const color = m.color === 'red' ? 'red' : m.color === 'blue' ? 'blue' : 'darkblue';
      const label = m.label ?? '';
      url.searchParams.append('pins', `default|co${color}|la${label}||${m.lng} ${m.lat}`);
    }
  }

  return url.toString();
}

/**
 * Get a Mapillary street-level image URL for a location.
 * Returns null if no imagery is available (coverage is less complete than Google).
 * This makes an API call to search for nearby images.
 */
export async function getMapillaryImageUrl(
  lat: number,
  lng: number,
  _width: number = 640,
  _height: number = 480
): Promise<string | null> {
  if (!MAPILLARY_TOKEN) {
    apiLogger.info('[mapillary] Access token not configured');
    return null;
  }

  try {
    const url = new URL(MAPILLARY_SEARCH_URL);
    url.searchParams.set('access_token', MAPILLARY_TOKEN);
    url.searchParams.set('fields', 'id,thumb_1024_url,thumb_2048_url');
    url.searchParams.set('bbox', getBoundingBox(lng, lat, 0.001)); // ~100m radius
    url.searchParams.set('limit', '1');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      apiLogger.warn({ status: response.status }, '[mapillary] API returned');
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await response.json()) as any;
    const images = json?.data;

    if (!images?.length) {
      // Widen search to ~500m radius
      url.searchParams.set('bbox', getBoundingBox(lng, lat, 0.005));
      const retryResponse = await fetch(url.toString(), { signal: controller.signal });
      if (!retryResponse.ok) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retryJson = (await retryResponse.json()) as any;
      if (!retryJson?.data?.length) return null;
      return retryJson.data[0].thumb_2048_url ?? retryJson.data[0].thumb_1024_url ?? null;
    }

    return images[0].thumb_2048_url ?? images[0].thumb_1024_url ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.warn({ message }, '[mapillary] image search error');
    return null;
  }
}

/**
 * Build a Mapillary street-level image URL for a given address.
 * First geocodes the address, then searches Mapillary.
 * Returns null if no imagery is found.
 */
export async function getStreetImageForAddress(
  address: string
): Promise<string | null> {
  const geocodeResult = await geocodeAddress(address);
  if (!geocodeResult.data) return null;
  return getMapillaryImageUrl(geocodeResult.data.latitude, geocodeResult.data.longitude);
}

/**
 * Fetch address autocomplete suggestions using Azure Maps Fuzzy Search.
 * Called from client-side API route to provide type-ahead suggestions.
 */
export async function searchAddresses(
  query: string,
  limit: number = 5
): Promise<AutocompleteSuggestion[]> {
  if (!AZURE_KEY) {
    apiLogger.warn('[azure-maps] AZURE_MAPS_SUBSCRIPTION_KEY is not set — autocomplete disabled');
    return [];
  }
  if (!query.trim()) return [];

  const url = new URL(AZURE_FUZZY_SEARCH_URL);
  url.searchParams.set('api-version', '1.0');
  url.searchParams.set('subscription-key', AZURE_KEY);
  url.searchParams.set('query', query);
  url.searchParams.set('countrySet', 'US');
  url.searchParams.set('typeahead', 'true');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('idxSet', 'PAD,Addr');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      apiLogger.error({ status: response.status, body: body.slice(0, 300) }, '[azure-maps] Fuzzy search failed ()');
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await response.json()) as any;
    const results = json.results ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results.map((r: any) => {
      const addr = r.address ?? {};
      const pos = r.position ?? {};
      return {
        formattedAddress: addr.freeformAddress ?? '',
        streetNumber: addr.streetNumber ?? null,
        route: addr.streetName ?? null,
        city: addr.municipality ?? null,
        state: addr.countrySubdivision ?? null,
        zip: addr.postalCode ?? null,
        county: addr.countrySecondarySubdivision
          ? addr.countrySecondarySubdivision.replace(/\s*(County|Parish|Borough)$/i, '').trim()
          : null,
        latitude: pos.lat ?? 0,
        longitude: pos.lon ?? 0,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Return the configuration object for client-side address autocomplete.
 * Uses Azure Maps Fuzzy Search via a server-side API route.
 */
export function getAddressAutocompleteConfig(): AddressAutocompleteConfig {
  return {
    subscriptionKey: AZURE_KEY,
    clientId: process.env.NEXT_PUBLIC_AZURE_MAPS_CLIENT_ID ?? '',
    options: {
      countrySet: ['US'],
      typeahead: true,
      limit: 5,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a bounding box string for Mapillary: west,south,east,north */
function getBoundingBox(lng: number, lat: number, delta: number): string {
  return `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
}
