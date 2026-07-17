// ─── Resourceful Location Services ───────────────────────────────────────────
// Historical filename retained for stable imports. Google Maps is the primary
// location provider; Azure Maps and Mapillary remain bounded fallbacks while
// the US Census geocoder supplies county FIPS data and keyless resilience.

import { apiLogger } from '@/lib/logger';

// ─── Configuration ───────────────────────────────────────────────────────────

const GOOGLE_KEY =
  process.env.GOOGLE_MAPS_API_KEY ??
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
  '';
const AZURE_KEY = process.env.AZURE_MAPS_SUBSCRIPTION_KEY ?? '';
const MAPILLARY_TOKEN = process.env.NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN ?? '';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_STATIC_MAP_URL = 'https://maps.googleapis.com/maps/api/staticmap';
const GOOGLE_STREET_VIEW_URL = 'https://maps.googleapis.com/maps/api/streetview';
const GOOGLE_STREET_VIEW_METADATA_URL = 'https://maps.googleapis.com/maps/api/streetview/metadata';

const AZURE_GEOCODE_URL = 'https://atlas.microsoft.com/search/address/json';
const AZURE_STATIC_MAP_URL = 'https://atlas.microsoft.com/map/static/png';
const AZURE_FUZZY_SEARCH_URL = 'https://atlas.microsoft.com/search/fuzzy/json';
const MAPILLARY_SEARCH_URL = 'https://graph.mapillary.com/images';
const CENSUS_GEOCODE_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';

// ─── Public contracts ────────────────────────────────────────────────────────

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

/** @deprecated Address lookup is server-proxied; no provider key is sent to clients. */
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

// ─── Provider response shapes ────────────────────────────────────────────────

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodeItem {
  formatted_address: string;
  place_id: string;
  address_components: GoogleAddressComponent[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results?: GoogleGeocodeItem[];
}

interface GoogleStreetViewMetadataResponse {
  status: string;
  date?: string;
  location?: { lat: number; lng: number };
  pano_id?: string;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, timeoutMs: number): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        data: null,
        error: `Location provider returned ${response.status}: ${response.statusText}`,
      };
    }

    return { data: (await response.json()) as T, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function component(
  components: GoogleAddressComponent[],
  type: string,
  format: 'long' | 'short' = 'long'
): string | null {
  const match = components.find((entry) => entry.types.includes(type));
  if (!match) return null;
  return format === 'short' ? match.short_name : match.long_name;
}

function normalizeGoogleResult(item: GoogleGeocodeItem): GeocodeResult {
  const components = item.address_components ?? [];
  const city =
    component(components, 'locality') ??
    component(components, 'postal_town') ??
    component(components, 'sublocality') ??
    component(components, 'administrative_area_level_3');
  const county = component(components, 'administrative_area_level_2')
    ?.replace(/\s*(County|Parish|Borough|Census Area|Municipality)$/i, '')
    .trim() ?? null;

  return {
    formattedAddress: item.formatted_address,
    latitude: item.geometry.location.lat,
    longitude: item.geometry.location.lng,
    placeId: item.place_id,
    county,
    countyFips: null,
    streetNumber: component(components, 'street_number'),
    route: component(components, 'route'),
    city,
    state: component(components, 'administrative_area_level_1', 'short'),
    zip: component(components, 'postal_code'),
  };
}

function mergeCensusGeography(primary: GeocodeResult, census: GeocodeResult | null): GeocodeResult {
  if (!census) return primary;

  return {
    ...primary,
    county: census.county ?? primary.county,
    countyFips: census.countyFips ?? primary.countyFips,
    city: primary.city ?? census.city,
    state: primary.state ?? census.state,
    zip: primary.zip ?? census.zip,
  };
}

function normalizeMapColor(color?: string): string {
  if (!color) return '0xd4a853';
  if (color === 'red') return 'red';
  if (color === 'blue') return 'blue';
  if (/^(?:0x|#)?[0-9a-f]{6}$/i.test(color)) {
    return `0x${color.replace(/^(?:0x|#)/i, '')}`;
  }
  return '0xd4a853';
}

function getBoundingBox(lng: number, lat: number, delta: number): string {
  return `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
}

// ─── Google Maps ─────────────────────────────────────────────────────────────

async function geocodeWithGoogle(address: string): Promise<ServiceResult<GeocodeResult>> {
  if (!GOOGLE_KEY) return { data: null, error: 'Google Maps API key not configured' };

  const url = new URL(GOOGLE_GEOCODE_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('components', 'country:US');
  url.searchParams.set('key', GOOGLE_KEY);

  const response = await fetchJson<GoogleGeocodeResponse>(url.toString(), 10_000);
  if (!response.data) return { data: null, error: response.error };

  if (response.data.status !== 'OK' || !response.data.results?.length) {
    return {
      data: null,
      error: response.data.error_message || `Google geocoding returned ${response.data.status}`,
    };
  }

  return { data: normalizeGoogleResult(response.data.results[0]), error: null };
}

async function searchAddressesWithGoogle(
  query: string,
  limit: number
): Promise<AutocompleteSuggestion[]> {
  if (!GOOGLE_KEY) return [];

  const url = new URL(GOOGLE_GEOCODE_URL);
  url.searchParams.set('address', query);
  url.searchParams.set('components', 'country:US');
  url.searchParams.set('key', GOOGLE_KEY);

  const response = await fetchJson<GoogleGeocodeResponse>(url.toString(), 5_000);
  if (!response.data || response.data.status !== 'OK') {
    if (response.error || response.data?.error_message) {
      apiLogger.warn(
        { error: response.error ?? response.data?.error_message, status: response.data?.status },
        '[maps] Google address search failed'
      );
    }
    return [];
  }

  return (response.data.results ?? []).slice(0, limit).map((item) => {
    const normalized = normalizeGoogleResult(item);
    return {
      formattedAddress: normalized.formattedAddress,
      streetNumber: normalized.streetNumber,
      route: normalized.route,
      city: normalized.city,
      state: normalized.state,
      zip: normalized.zip,
      county: normalized.county,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
    };
  });
}

async function getGoogleStreetViewUrl(params: StreetViewParams): Promise<string | null> {
  if (!GOOGLE_KEY) return null;

  const metadataUrl = new URL(GOOGLE_STREET_VIEW_METADATA_URL);
  metadataUrl.searchParams.set('location', `${params.lat},${params.lng}`);
  metadataUrl.searchParams.set('radius', '100');
  metadataUrl.searchParams.set('source', 'outdoor');
  metadataUrl.searchParams.set('key', GOOGLE_KEY);

  const metadata = await fetchJson<GoogleStreetViewMetadataResponse>(
    metadataUrl.toString(),
    6_000
  );
  if (!metadata.data || metadata.data.status !== 'OK') return null;

  const url = new URL(GOOGLE_STREET_VIEW_URL);
  url.searchParams.set(
    'size',
    `${Math.min(Math.max(params.width, 1), 640)}x${Math.min(Math.max(params.height, 1), 640)}`
  );
  url.searchParams.set('location', `${params.lat},${params.lng}`);
  url.searchParams.set('fov', '90');
  url.searchParams.set('pitch', String(params.pitch ?? 0));
  if (params.heading != null) url.searchParams.set('heading', String(params.heading));
  url.searchParams.set('source', 'outdoor');
  url.searchParams.set('key', GOOGLE_KEY);
  return url.toString();
}

// ─── Census fallback and FIPS enrichment ─────────────────────────────────────

async function geocodeWithCensus(address: string): Promise<ServiceResult<GeocodeResult>> {
  const url = new URL(CENSUS_GEOCODE_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('vintage', 'Current_Current');
  url.searchParams.set('format', 'json');

  const response = await fetchJson<unknown>(url.toString(), 15_000);
  if (!response.data) return { data: null, error: response.error };

  // Census responses are deeply nested and not published as a stable TypeScript
  // contract. Narrow only the fields Resourceful consumes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches = (response.data as any)?.result?.addressMatches;
  if (!Array.isArray(matches) || matches.length === 0) {
    return { data: null, error: 'Census geocoder returned no matches' };
  }

  const match = matches[0];
  const coordinates = match.coordinates ?? {};
  const countyGeography = match.geographies?.Counties?.[0];
  const stateCode = countyGeography?.STATE ?? null;
  const countyCode = countyGeography?.COUNTY ?? null;
  const addressComponents = match.addressComponents ?? {};

  return {
    data: {
      formattedAddress: match.matchedAddress ?? address,
      latitude: Number(coordinates.y) || 0,
      longitude: Number(coordinates.x) || 0,
      placeId: '',
      county: countyGeography?.BASENAME ?? countyGeography?.NAME ?? null,
      countyFips: stateCode && countyCode ? `${stateCode}${countyCode}` : null,
      streetNumber: addressComponents.fromAddress ?? null,
      route: addressComponents.streetName ?? null,
      city: addressComponents.city ?? null,
      state: addressComponents.state ?? null,
      zip: addressComponents.zip ?? null,
    },
    error: null,
  };
}

// ─── Azure fallback ──────────────────────────────────────────────────────────

async function geocodeWithAzure(address: string): Promise<ServiceResult<GeocodeResult>> {
  if (!AZURE_KEY) return { data: null, error: 'Azure Maps key not configured' };

  const url = new URL(AZURE_GEOCODE_URL);
  url.searchParams.set('api-version', '1.0');
  url.searchParams.set('subscription-key', AZURE_KEY);
  url.searchParams.set('query', address);
  url.searchParams.set('countrySet', 'US');
  url.searchParams.set('limit', '1');

  const response = await fetchJson<unknown>(url.toString(), 10_000);
  if (!response.data) return { data: null, error: response.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = (response.data as any)?.results?.[0];
  if (!item) return { data: null, error: 'Azure Maps geocoding returned no results' };

  const addressData = item.address ?? {};
  const position = item.position ?? {};
  return {
    data: {
      formattedAddress: addressData.freeformAddress ?? address,
      latitude: Number(position.lat) || 0,
      longitude: Number(position.lon) || 0,
      placeId: item.id ?? '',
      county: addressData.countrySecondarySubdivision
        ? String(addressData.countrySecondarySubdivision)
            .replace(/\s*(County|Parish|Borough)$/i, '')
            .trim()
        : null,
      countyFips: null,
      streetNumber: addressData.streetNumber ?? null,
      route: addressData.streetName ?? null,
      city: addressData.municipality ?? null,
      state: addressData.countrySubdivision ?? null,
      zip: addressData.postalCode ?? null,
    },
    error: null,
  };
}

async function searchAddressesWithAzure(
  query: string,
  limit: number
): Promise<AutocompleteSuggestion[]> {
  if (!AZURE_KEY) return [];

  const url = new URL(AZURE_FUZZY_SEARCH_URL);
  url.searchParams.set('api-version', '1.0');
  url.searchParams.set('subscription-key', AZURE_KEY);
  url.searchParams.set('query', query);
  url.searchParams.set('countrySet', 'US');
  url.searchParams.set('typeahead', 'true');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('idxSet', 'PAD,Addr');

  const response = await fetchJson<unknown>(url.toString(), 5_000);
  if (!response.data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = Array.isArray((response.data as any)?.results)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (response.data as any).results
    : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results.slice(0, limit).map((item: any) => {
    const addressData = item.address ?? {};
    const position = item.position ?? {};
    return {
      formattedAddress: addressData.freeformAddress ?? '',
      streetNumber: addressData.streetNumber ?? null,
      route: addressData.streetName ?? null,
      city: addressData.municipality ?? null,
      state: addressData.countrySubdivision ?? null,
      zip: addressData.postalCode ?? null,
      county: addressData.countrySecondarySubdivision
        ? String(addressData.countrySecondarySubdivision)
            .replace(/\s*(County|Parish|Borough)$/i, '')
            .trim()
        : null,
      latitude: Number(position.lat) || 0,
      longitude: Number(position.lon) || 0,
    };
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve and normalize a US address. Google is primary, Census enriches FIPS,
 * Azure is a transitional fallback, and Census can operate by itself.
 */
export async function geocodeAddress(address: string): Promise<ServiceResult<GeocodeResult>> {
  const censusPromise = geocodeWithCensus(address);

  if (GOOGLE_KEY) {
    const [google, census] = await Promise.all([
      geocodeWithGoogle(address),
      censusPromise,
    ]);
    if (google.data) return { data: mergeCensusGeography(google.data, census.data), error: null };
    apiLogger.warn({ error: google.error }, '[maps] Google geocoding failed; trying fallback');
    if (census.data) return census;
  }

  if (AZURE_KEY) {
    const [azure, census] = await Promise.all([
      geocodeWithAzure(address),
      GOOGLE_KEY ? geocodeWithCensus(address) : censusPromise,
    ]);
    if (azure.data) return { data: mergeCensusGeography(azure.data, census.data), error: null };
    apiLogger.warn({ error: azure.error }, '[maps] Azure geocoding failed; using Census fallback');
    if (census.data) return census;
  }

  return GOOGLE_KEY || AZURE_KEY ? geocodeWithCensus(address) : censusPromise;
}

/** Build a static property map URL, preferring Google Maps. */
export function getStaticMapUrl(params: StaticMapParams): string {
  if (GOOGLE_KEY) {
    const url = new URL(GOOGLE_STATIC_MAP_URL);
    url.searchParams.set('center', `${params.lat},${params.lng}`);
    url.searchParams.set('zoom', String(params.zoom));
    url.searchParams.set(
      'size',
      `${Math.min(Math.max(params.width, 1), 640)}x${Math.min(Math.max(params.height, 1), 640)}`
    );
    url.searchParams.set('scale', '2');
    url.searchParams.set('maptype', 'roadmap');
    url.searchParams.set('key', GOOGLE_KEY);

    for (const marker of params.markers ?? []) {
      const label = marker.label?.trim().slice(0, 1).toUpperCase();
      const parts = [`color:${normalizeMapColor(marker.color)}`];
      if (label && /^[A-Z0-9]$/.test(label)) parts.push(`label:${label}`);
      parts.push(`${marker.lat},${marker.lng}`);
      url.searchParams.append('markers', parts.join('|'));
    }

    return url.toString();
  }

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

  for (const marker of params.markers ?? []) {
    const color = marker.color === 'red' ? 'red' : marker.color === 'blue' ? 'blue' : 'darkblue';
    url.searchParams.append(
      'pins',
      `default|co${color}|la${marker.label ?? ''}||${marker.lng} ${marker.lat}`
    );
  }

  return url.toString();
}

/** Search Mapillary for nearby imagery when Google Street View is unavailable. */
export async function getMapillaryImageUrl(
  lat: number,
  lng: number,
  _width: number = 640,
  _height: number = 480
): Promise<string | null> {
  if (!MAPILLARY_TOKEN) return null;

  for (const delta of [0.001, 0.005]) {
    const url = new URL(MAPILLARY_SEARCH_URL);
    url.searchParams.set('access_token', MAPILLARY_TOKEN);
    url.searchParams.set('fields', 'id,thumb_1024_url,thumb_2048_url');
    url.searchParams.set('bbox', getBoundingBox(lng, lat, delta));
    url.searchParams.set('limit', '1');

    const response = await fetchJson<unknown>(url.toString(), 8_000);
    if (!response.data) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const image = (response.data as any)?.data?.[0];
    if (image) return image.thumb_2048_url ?? image.thumb_1024_url ?? null;
  }

  return null;
}

/** Resolve the best available street-level image for an address. */
export async function getStreetImageForAddress(address: string): Promise<string | null> {
  const geocode = await geocodeAddress(address);
  if (!geocode.data) return null;

  const googleStreetView = await getGoogleStreetViewUrl({
    lat: geocode.data.latitude,
    lng: geocode.data.longitude,
    width: 640,
    height: 480,
  });
  if (googleStreetView) return googleStreetView;

  return getMapillaryImageUrl(geocode.data.latitude, geocode.data.longitude, 640, 480);
}

/** Server-side address suggestions, preferring Google Maps. */
export async function searchAddresses(
  query: string,
  limit: number = 5
): Promise<AutocompleteSuggestion[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const google = await searchAddressesWithGoogle(normalizedQuery, limit);
  if (google.length > 0) return google;

  const azure = await searchAddressesWithAzure(normalizedQuery, limit);
  if (azure.length > 0) return azure;

  return [];
}

/** @deprecated Address search is server-side and exposes no provider credentials. */
export function getAddressAutocompleteConfig(): AddressAutocompleteConfig {
  return {
    subscriptionKey: '',
    clientId: '',
    options: {
      countrySet: ['US'],
      typeahead: true,
      limit: 5,
    },
  };
}
