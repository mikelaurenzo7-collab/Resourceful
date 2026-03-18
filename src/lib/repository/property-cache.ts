// ─── Property Cache Repository ──────────────────────────────────────────────
// Caches ATTOM property lookups to avoid redundant API calls across the
// wizard → instant preview → pipeline lifecycle. Keyed by normalized address.

import { createAdminClient } from '@/lib/supabase/admin';
import type { PropertyCache, PropertyCacheInsert } from '@/types/database';
import type { AttomPropertyDetail } from '@/lib/services/attom';
import type { PropertyType } from '@/types/database';

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

// ─── ATTOM Property Type → Our Property Type ───────────────────────────────

export function mapAttomPropertyType(attomType: string): PropertyType | null {
  const lower = attomType.toLowerCase();
  if (
    lower.includes('single family') ||
    lower.includes('condominium') ||
    lower.includes('townhouse') ||
    lower.includes('duplex') ||
    lower.includes('triplex') ||
    lower.includes('residential') ||
    lower.includes('mobile home') ||
    lower.includes('manufactured')
  ) {
    return 'residential';
  }
  if (
    lower.includes('commercial') ||
    lower.includes('office') ||
    lower.includes('retail') ||
    lower.includes('mixed use')
  ) {
    return 'commercial';
  }
  if (
    lower.includes('industrial') ||
    lower.includes('warehouse') ||
    lower.includes('manufacturing')
  ) {
    return 'industrial';
  }
  if (
    lower.includes('vacant') ||
    lower.includes('land') ||
    lower.includes('agricultural')
  ) {
    return 'land';
  }
  return null;
}

// ─── Lookup ─────────────────────────────────────────────────────────────────

export async function getCachedProperty(
  addressKey: string,
  supabase?: SupabaseAdmin
): Promise<PropertyCache | null> {
  const client = supabase ?? createAdminClient();
  const { data, error } = await client
    .from('property_cache')
    .select('*')
    .eq('address_key', addressKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  return data as unknown as PropertyCache;
}

export async function getCachedPropertyById(
  id: string,
  supabase?: SupabaseAdmin
): Promise<PropertyCache | null> {
  const client = supabase ?? createAdminClient();
  const { data, error } = await client
    .from('property_cache')
    .select('*')
    .eq('id', id)
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

  const payload: PropertyCacheInsert = {
    address_key: addressKey,
    attom_raw: attomDetail as unknown as Record<string, unknown>,
    property_type: mapAttomPropertyType(attomDetail.summary.propertyType),
    year_built: attomDetail.summary.yearBuilt || null,
    bedrooms: attomDetail.summary.bedrooms || null,
    bathrooms: attomDetail.summary.bathrooms || null,
    building_sqft: attomDetail.summary.buildingSquareFeet || null,
    lot_sqft: attomDetail.summary.lotSquareFeet || null,
    stories: attomDetail.summary.stories || null,
    assessed_value: attomDetail.assessment.assessedValue || null,
    tax_amount: attomDetail.assessment.taxAmount || null,
    assessment_year: attomDetail.assessment.assessmentYear || null,
    county_fips: attomDetail.location.countyFips || null,
    county_name: attomDetail.location.countyName || null,
  };

  const { data, error } = await client
    .from('property_cache')
    .upsert(payload, { onConflict: 'address_key' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert property cache: ${error.message}`);
  return data as unknown as PropertyCache;
}
