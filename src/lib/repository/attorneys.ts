// ─── Attorney Network Repository ──────────────────────────────────────────────
// CRUD operations for the attorney referral network. Attorneys are routed cases
// when case_strength_score ≥ 75 AND case_value_at_stake ≥ $5,000 AND the county
// allows authorized representation (county_rules.authorized_rep_allowed = true).
//
// Revenue share: revenue_share_cents = savings_amount_cents × contingency_fee_pct

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Attorney, AttorneyReferral, AttorneyReferralInsert } from '@/types/database';

export type { Attorney, AttorneyReferral };

// ─── Find Attorney for Referral ──────────────────────────────────────────────
// Finds the best-matching active attorney for a case. Criteria:
//   - Licensed in the property's state
//   - Handles the property type (residential/commercial/industrial)
//   - Handles tax_appeal service type
//   - min_case_value_dollars ≤ the case value at stake
//   - If counties_fips is set, the property county must be in the list
// Ordered by lowest contingency fee (best deal for the client).

export async function findAttorneyForReferral(
  stateAbbreviation: string | null,
  countyFips: string | null,
  propertyType: string,
  caseValueDollars: number,
  supabase: SupabaseClient<Database>
): Promise<Attorney | null> {
  if (!stateAbbreviation) return null;

  const { data, error } = await supabase
    .from('attorneys')
    .select('*')
    .eq('is_active', true)
    .contains('states', [stateAbbreviation])
    .contains('service_types', ['tax_appeal'])
    .contains('property_types', [propertyType])
    .lte('min_case_value_dollars', caseValueDollars)
    .order('contingency_fee_pct', { ascending: true })
    .limit(20); // fetch a batch so we can filter by county below

  if (error || !data || data.length === 0) return null;

  // Filter by county restriction if the attorney has one
  for (const row of data) {
    const attorney = row as Attorney;
    if (
      !attorney.counties_fips ||
      attorney.counties_fips.length === 0 ||
      !countyFips ||
      attorney.counties_fips.includes(countyFips)
    ) {
      return attorney;
    }
  }

  return null;
}

// ─── Create Attorney Referral ────────────────────────────────────────────────

export async function createAttorneyReferral(
  data: AttorneyReferralInsert,
  supabase: SupabaseClient<Database>
): Promise<AttorneyReferral | null> {
  const { data: result, error } = await supabase
    .from('attorney_referrals')
    .insert({
      report_id: data.report_id,
      attorney_id: data.attorney_id,
      case_strength_score: data.case_strength_score,
      case_value_at_stake: data.case_value_at_stake,
      referral_status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.warn(`[attorneys] createAttorneyReferral failed: ${error.message}`);
    return null;
  }

  return result as AttorneyReferral;
}

// ─── Get Referrals for a Report ──────────────────────────────────────────────

export async function getAttorneyReferrals(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<AttorneyReferral[]> {
  const { data } = await supabase
    .from('attorney_referrals')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false });

  return (data ?? []) as AttorneyReferral[];
}

// ─── Update Referral Outcome ─────────────────────────────────────────────────
// Called when an appeal resolves. Computes revenue_share from the actual
// savings × contingency_fee_pct. This is the feedback loop for the network.

export async function updateReferralOutcome(
  referralId: string,
  outcome: 'settled' | 'won_at_hearing' | 'lost' | 'withdrawn',
  savingsAmountCents: number,
  contingencyFeePct: number,
  supabase: SupabaseClient<Database>
): Promise<void> {
  const revenueShareCents = Math.round(savingsAmountCents * (contingencyFeePct / 100));

  await supabase
    .from('attorney_referrals')
    .update({
      outcome,
      savings_amount_cents: savingsAmountCents,
      revenue_share_cents: revenueShareCents,
      referral_status: 'resolved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', referralId);
}
