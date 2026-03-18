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
 * Resolve county rules for a report, using the most reliable identifier available.
 * Priority: county_fips > county name + state abbreviation.
 */
export async function getCountyForReport(
  report: { county_fips: string | null; county: string | null; state: string | null },
  supabase?: SupabaseAdmin
): Promise<CountyRule | null> {
  if (report.county_fips) {
    const byFips = await getCountyByFips(report.county_fips, supabase);
    if (byFips) return byFips;
  }
  if (report.county && report.state) {
    return getCountyByName(report.county, report.state, supabase);
  }
  return null;
}

export async function getCountiesByState(
  stateAbbreviation: string,
  supabase?: SupabaseAdmin
): Promise<CountyRule[]> {
  const client = getClient(supabase);
  const { data, error } = await client
    .from('county_rules')
    .select('*')
    .eq('state_abbreviation', stateAbbreviation.toUpperCase())
    .eq('is_active', true)
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
