// ─── RentCast API Service ─────────────────────────────────────────────────────
// Rental market data: comparable active listings and AVM rent estimates.
// Used by Stage 3 income analysis when ATTOM returns no rental comps.
// Auth: X-Api-Key header.

const BASE_URL = 'https://api.rentcast.io/v1';

import { apiLogger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RentcastRentEstimate {
  rent: number;
  rentRangeLow: number;
  rentRangeHigh: number;
  latitude: number | null;
  longitude: number | null;
  comparables: RentcastListing[];
}

export interface RentcastListing {
  id: string;
  formattedAddress: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  price: number; // monthly rent in USD
  status: string | null;
  listedDate: string | null;
  distance: number | null;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toRentcastPropertyType(subtype: string): string {
  const map: Record<string, string> = {
    residential_sfr: 'Single Family',
    residential_condo: 'Condo',
    residential_townhome: 'Townhouse',
    residential_multifamily: 'Multi-Family',
    commercial_general: 'Apartment',
    commercial_office: 'Commercial',
    commercial_retail: 'Commercial',
    industrial_general: 'Commercial',
  };
  return map[subtype] ?? 'Single Family';
}

async function rentcastFetch<T>(
  path: string,
  params: Record<string, string>,
): Promise<ServiceResult<T>> {
  const apiKey = process.env.RENTCAST_API_KEY ?? '';
  if (!apiKey) return { data: null, error: 'RENTCAST_API_KEY not configured' };

  try {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(url.toString(), {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      apiLogger.error({ path, status: res.status, body: body.slice(0, 300) }, '[rentcast] returned');
      return { data: null, error: `RentCast API returned ${res.status}` };
    }
    return { data: (await res.json()) as T, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    apiLogger.warn({ path, msg }, '[rentcast] error');
    return { data: null, error: msg };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * AVM rent estimate for a single property.
 * Returns monthly rent estimate with range and nearest comparables.
 * Endpoint costs 2 credits per call.
 */
export async function getRentEstimate(
  address: string,
  city: string,
  state: string,
  propertySubtype: string,
  squareFootage: number | null,
): Promise<ServiceResult<RentcastRentEstimate>> {
  const fullAddress = [address, city, state].filter(Boolean).join(', ');
  const params: Record<string, string> = {
    address: fullAddress,
    propertyType: toRentcastPropertyType(propertySubtype),
    compCount: '5',
  };
  if (squareFootage && squareFootage > 0) params.squareFootage = String(squareFootage);

  apiLogger.info({ fullAddress, toRentcastPropertyType: toRentcastPropertyType(propertySubtype) }, '[rentcast] Rent estimate for "" ()');
  return rentcastFetch<RentcastRentEstimate>('/avm/rent/long-term', params);
}

/**
 * Active rental listings near a coordinate.
 * Returns monthly rent + sqft — caller converts to $/sqft/yr.
 * Costs 1 credit per call.
 */
export async function getRentalListings(
  latitude: number,
  longitude: number,
  radiusMiles: number,
  propertySubtype: string,
  limit = 20,
): Promise<ServiceResult<RentcastListing[]>> {
  const params: Record<string, string> = {
    latitude: String(latitude),
    longitude: String(longitude),
    radius: String(radiusMiles),
    propertyType: toRentcastPropertyType(propertySubtype),
    status: 'Active',
    limit: String(limit),
  };

  apiLogger.info(
    { latitude, longitude, radiusMiles, propertyType: toRentcastPropertyType(propertySubtype) },
    '[rentcast] Fetching rental listings',
  );
  return rentcastFetch<RentcastListing[]>('/listings/rental/long-term', params);
}
