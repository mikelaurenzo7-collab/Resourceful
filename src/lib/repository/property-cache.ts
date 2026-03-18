// ─── Property Cache Repository ──────────────────────────────────────────────
// Caches ATTOM property lookups to avoid redundant API calls across the
// wizard → instant preview → pipeline lifecycle. Keyed by normalized address.

import { createAdminClient } from '@/lib/supabase/admin';
import type { PropertyCache, PropertyCacheInsert } from '@/types/database';
import type { AttomPropertyDetail } from '@/lib/services/attom';
import { extractPropertySummary } from '@/lib/services/attom';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// ─── Address Normalization ──────────────────────────────────────────────────

export function normalizeAddressKey(
  line1: string,
  city: string,
  state: string
): string {
  return [line1, city, state]
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, ' '))
    .join(', ');
}

// ─── Scalar-only columns (exclude attom_raw for lightweight lookups) ────────

const SCALAR_COLUMNS = 'id, address_key, property_type, year_built, bedrooms, bathrooms, building_sqft, lot_sqft, stories, assessed_value, tax_amount, assessment_year, county_fips, county_name, created_at, expires_at' as const;

// ─── Lookup ─────────────────────────────────────────────────────────────────

/**
 * Lookup cached property by normalized address key.
 * Returns scalar fields only (excludes attom_raw JSONB for performance).
 */
export async function getCachedProperty(
  addressKey: string,
  supabase?: SupabaseAdmin
): Promise<Omit<PropertyCache, 'attom_raw'> | null> {
  const client = supabase ?? createAdminClient();
  const { data, error } = await client
    .from('property_cache')
    .select(SCALAR_COLUMNS)
    .eq('address_key', addressKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  return data as unknown as Omit<PropertyCache, 'attom_raw'>;
}

/**
 * Lookup cached property by ID. Used by valuation endpoint and pipeline Stage 1.
 * Includes attom_raw for Stage 1's full data collection needs.
 * Respects TTL — expired entries are not returned.
 */
export async function getCachedPropertyById(
  id: string,
  supabase?: SupabaseAdmin
): Promise<PropertyCache | null> {
  const client = supabase ?? createAdminClient();
  const { data, error } = await client
    .from('property_cache')
    .select('*')
    .eq('id', id)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  return data as unknown as PropertyCache;
}

// ─── Upsert ─────────────────────────────────────────────────────────────────

export async function upsertPropertyCache(
  addressKey: string,
  attomDetail: AttomPropertyDetail,
  supabase?: SupabaseAdmin
): Promise<PropertyCache> {
  const client = supabase ?? createAdminClient();
  const summary = extractPropertySummary(attomDetail);

  const payload: PropertyCacheInsert = {
    address_key: addressKey,
    attom_raw: attomDetail as unknown as Record<string, unknown>,
    property_type: summary.propertyType,
    year_built: summary.yearBuilt,
    bedrooms: summary.bedrooms,
    bathrooms: summary.bathrooms,
    building_sqft: summary.buildingSqFt,
    lot_sqft: summary.lotSqFt,
    stories: summary.stories,
    assessed_value: summary.assessedValue,
    tax_amount: summary.taxAmount,
    assessment_year: summary.assessmentYear,
    county_fips: summary.countyFips,
    county_name: summary.countyName,
  };

  const { data, error } = await client
    .from('property_cache')
    .upsert(payload, { onConflict: 'address_key' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert property cache: ${error.message}`);
  return data as unknown as PropertyCache;
}
