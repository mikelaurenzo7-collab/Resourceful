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
