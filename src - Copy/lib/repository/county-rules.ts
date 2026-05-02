// ─── County Rules Repository ─────────────────────────────────────────────────
// Typed data access for county_rules table.
// PK is county_fips (not id).

import { createAdminClient } from '@/lib/supabase/admin';
import type { CountyRule, CountyRuleInsert } from '@/types/database';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function getClient(supabase?: SupabaseAdmin): SupabaseAdmin {
  return supabase ?? createAdminClient();
}

export async function getCountyByFips(
  fips: string,
  supabase?: SupabaseAdmin
): Promise<CountyRule | null> {
  const client = getClient(supabase);
  const { data, error } = await client
    .from('county_rules')
    .select('*')
    .eq('county_fips', fips)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch county by FIPS: ${error.message}`);
  }
  return data as unknown as CountyRule;
}

export async function getCountyByName(
  county: string,
  state: string,
  supabase?: SupabaseAdmin
): Promise<CountyRule | null> {
  const client = getClient(supabase);
  const { data, error } = await client
    .from('county_rules')
    .select('*')
    .ilike('county_name', county)
    .eq('state_abbreviation', state.toUpperCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch county by name: ${error.message}`);
  }
  return data as unknown as CountyRule;
}

export async function getActiveCounties(
  supabase?: SupabaseAdmin
): Promise<CountyRule[]> {
  const client = getClient(supabase);
  const { data, error } = await client
    .from('county_rules')
    .select('*')
    .eq('is_active', true)
    .order('state_abbreviation', { ascending: true })
    .order('county_name', { ascending: true });

  if (error) throw new Error(`Failed to fetch active counties: ${error.message}`);
  return (data ?? []) as unknown as CountyRule[];
}

/**
 * Get distinct states that have active counties.
 * Returns array of { state_name, state_abbreviation } sorted alphabetically.
 */
export async function getActiveStates(
  supabase?: SupabaseAdmin
): Promise<{ state_name: string; state_abbreviation: string }[]> {
  const client = getClient(supabase);
  const { data, error } = await client
    .from('county_rules')
    .select('state_name, state_abbreviation')
    .eq('is_active', true)
    .order('state_name', { ascending: true });

  if (error) throw new Error(`Failed to fetch active states: ${error.message}`);

  // Deduplicate by state_abbreviation
  const seen = new Set<string>();
  const states: { state_name: string; state_abbreviation: string }[] = [];
  for (const row of (data ?? [])) {
    if (!seen.has(row.state_abbreviation)) {
      seen.add(row.state_abbreviation);
      states.push({ state_name: row.state_name, state_abbreviation: row.state_abbreviation });
    }
  }
  return states;
}

/**
 * Get all active counties in a specific state.
 */
export async function getActiveCountiesByState(
  stateName: string,
  supabase?: SupabaseAdmin
): Promise<CountyRule[]> {
  const client = getClient(supabase);
  const { data, error } = await client
    .from('county_rules')
    .select('*')
    .eq('is_active', true)
    .ilike('state_name', stateName)
    .order('county_name', { ascending: true });

  if (error) throw new Error(`Failed to fetch counties by state: ${error.message}`);
  return (data ?? []) as unknown as CountyRule[];
}

export async function upsertCountyRule(
  data: CountyRuleInsert,
  supabase?: SupabaseAdmin
): Promise<CountyRule> {
  const client = getClient(supabase);
  const { data: rule, error } = await client
    .from('county_rules')
    .upsert(data, { onConflict: 'county_fips' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert county rule: ${error.message}`);
  return rule as unknown as CountyRule;
}
