// ─── Google Maps Services ────────────────────────────────────────────────────
// Geocoding, static maps, street view, and Places Autocomplete config.

// ─── Configuration ───────────────────────────────────────────────────────────

const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';
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

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Geocode a street address and extract county info.
 */
export async function geocodeAddress(
  address: string
): Promise<ServiceResult<GeocodeResult>> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('key', API_KEY);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return {
        data: null,
        error: `Google Geocoding API returned ${response.status}: ${response.statusText}`,
      };
    }

    interface GeoAddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }

    interface GeoGeometry {
      location: { lat: number; lng: number };
    }

    interface GeoResult {
      address_components?: GeoAddressComponent[];
      geometry?: GeoGeometry;
      formatted_address?: string;
      place_id?: string;
    }

    interface GeocodeApiResponse {
      status: string;
      error_message?: string;
      results?: GeoResult[];
    }

    const json = (await response.json()) as GeocodeApiResponse;

    if (json.status !== 'OK' || !json.results?.length) {
      return {
        data: null,
        error: `Geocoding failed: ${json.status} - ${json.error_message ?? 'No results'}`,
      };
    }

    const result = json.results[0];
    const components: GeoAddressComponent[] = result.address_components ?? [];
    const geo = result.geometry?.location ?? { lat: 0, lng: 0 };

    const find = (type: string): string | null =>
      components.find((c: GeoAddressComponent) => c.types?.includes(type))?.long_name ?? null;

    const findShort = (type: string): string | null =>
      components.find((c: GeoAddressComponent) => c.types?.includes(type))?.short_name ?? null;

    return {
      data: {
        formattedAddress: result.formatted_address ?? '',
        latitude: geo.lat ?? 0,
        longitude: geo.lng ?? 0,
        placeId: result.place_id ?? '',
        county: find('administrative_area_level_2'),
        countyFips: null, // Google does not return FIPS; use separate lookup if needed
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
