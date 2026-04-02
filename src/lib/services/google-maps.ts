// ─── Google Maps Services ────────────────────────────────────────────────────
// Geocoding, static maps, street view, and Places Autocomplete config.

// ─── Configuration ───────────────────────────────────────────────────────────

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const STATIC_MAP_URL = 'https://maps.googleapis.com/maps/api/staticmap';
const STREET_VIEW_URL = 'https://maps.googleapis.com/maps/api/streetview';

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

export interface PlacesAutocompleteConfig {
  apiKey: string;
  options: {
    types: string[];
    componentRestrictions: { country: string };
  };
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── US Census Bureau Geocoder (Free Fallback) ──────────────────────────────
// No API key required. Covers all US addresses. Used when Google Maps is
// unavailable or not configured.

const CENSUS_GEOCODE_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';

async function geocodeWithCensus(
  address: string
): Promise<ServiceResult<GeocodeResult>> {
  try {
    const url = new URL(CENSUS_GEOCODE_URL);
    url.searchParams.set('address', address);
    url.searchParams.set('benchmark', 'Public_AR_Current');
    url.searchParams.set('vintage', 'Current_Current');
    url.searchParams.set('format', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
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

    // Parse address components from matched address
    const addressComponents = match.addressComponents ?? {};

    console.log(`[geocode] Census fallback succeeded for: ${address}`);

    return {
      data: {
        formattedAddress: match.matchedAddress ?? address,
        latitude: coords.y ?? 0,
        longitude: coords.x ?? 0,
        placeId: '', // Census doesn't provide place IDs
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
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[geocode] Census fallback error: ${message}`);
    return { data: null, error: `Census geocoding failed: ${message}` };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Geocode a street address. Uses Google Maps as primary, falls back to
 * US Census Bureau geocoder if Google is unavailable or not configured.
 * The Census geocoder is free, requires no API key, and returns FIPS codes.
 */
export async function geocodeAddress(
  address: string
): Promise<ServiceResult<GeocodeResult>> {
  // Try Google Maps first (if API key is configured)
  if (API_KEY) {
    const googleResult = await geocodeWithGoogle(address);
    if (googleResult.data) return googleResult;
    console.warn(`[geocode] Google Maps failed, falling back to Census: ${googleResult.error}`);
  } else {
    console.log('[geocode] Google Maps API key not configured, using Census geocoder');
  }

  // Fallback: US Census Bureau geocoder (free, no API key)
  return geocodeWithCensus(address);
}

/**
 * Geocode using Google Maps API.
 */
async function geocodeWithGoogle(
  address: string
): Promise<ServiceResult<GeocodeResult>> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('key', API_KEY);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return {
        data: null,
        error: `Google Geocoding API returned ${response.status}: ${response.statusText}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await response.json()) as any;

    if (json.status !== 'OK' || !json.results?.length) {
      return {
        data: null,
        error: `Geocoding failed: ${json.status} - ${json.error_message ?? 'No results'}`,
      };
    }

    const result = json.results[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components: any[] = result.address_components ?? [];
    const geo = result.geometry?.location ?? {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const find = (type: string): string | null =>
      components.find((c: any) => c.types?.includes(type))?.long_name ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findShort = (type: string): string | null =>
      components.find((c: any) => c.types?.includes(type))?.short_name ?? null;

    return {
      data: {
        formattedAddress: result.formatted_address ?? '',
        latitude: geo.lat ?? 0,
        longitude: geo.lng ?? 0,
        placeId: result.place_id ?? '',
        county: find('administrative_area_level_2'),
        countyFips: null, // Google does not return FIPS; Census fallback does
        streetNumber: find('street_number'),
        route: find('route'),
        city: find('locality'),
        state: findShort('administrative_area_level_1'),
        zip: find('postal_code'),
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[google-maps] geocode error: ${message}`);
    return { data: null, error: `Geocoding request failed: ${message}` };
  }
}

/**
 * Build a Google Static Maps URL (no API call, just URL construction).
 */
export function getStaticMapUrl(params: StaticMapParams): string {
  const url = new URL(STATIC_MAP_URL);
  url.searchParams.set('center', `${params.lat},${params.lng}`);
  url.searchParams.set('zoom', String(params.zoom));
  url.searchParams.set('size', `${params.width}x${params.height}`);
  url.searchParams.set('maptype', 'roadmap');
  url.searchParams.set('key', API_KEY);

  if (params.markers?.length) {
    for (const m of params.markers) {
      const parts: string[] = [];
      if (m.color) parts.push(`color:${m.color}`);
      if (m.label) parts.push(`label:${m.label}`);
      parts.push(`${m.lat},${m.lng}`);
      url.searchParams.append('markers', parts.join('|'));
    }
  }

  return url.toString();
}

/**
 * Build a Google Street View image URL (no API call, just URL construction).
 */
export function getStreetViewUrl(params: StreetViewParams): string {
  const url = new URL(STREET_VIEW_URL);
  url.searchParams.set('location', `${params.lat},${params.lng}`);
  url.searchParams.set('size', `${params.width}x${params.height}`);
  url.searchParams.set('key', API_KEY);
  if (params.heading !== undefined) {
    url.searchParams.set('heading', String(params.heading));
  }
  if (params.pitch !== undefined) {
    url.searchParams.set('pitch', String(params.pitch));
  }
  return url.toString();
}

/**
 * Return the configuration object for client-side Google Places Autocomplete.
 * This is consumed by the frontend to initialise the widget without exposing
 * the API key in source — the key is read from the server environment and
 * passed via a server component or API route.
 */
export function getPlacesAutocompleteConfig(): PlacesAutocompleteConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? API_KEY,
    options: {
      types: ['address'],
      componentRestrictions: { country: 'us' },
    },
  };
}
