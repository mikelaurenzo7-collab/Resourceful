'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { aggregateCountyIntelligence } from '@/lib/services/filing-intelligence';
import { generateReferralCode } from '@/lib/services/referral-service';

type AppealOutcome =
  | 'won_full'
  | 'won_partial'
  | 'lost'
  | 'withdrawn'
  | 'pending_hearing'
  | 'settled_informal';

const VALID_OUTCOMES: AppealOutcome[] = [
  'won_full',
  'won_partial',
  'lost',
  'withdrawn',
  'pending_hearing',
  'settled_informal',
];

export async function recordOutcome(reportId: string, formData: FormData) {
  // Verify the caller is an authenticated admin
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: adminCheck } = await authClient
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!adminCheck) throw new Error('Not authorized — admin access required');

  const supabase = createAdminClient();

  // Parse form data
  const outcomeRaw = String(formData.get('appeal_outcome') ?? '').trim();
  if (!outcomeRaw || !VALID_OUTCOMES.includes(outcomeRaw as AppealOutcome)) {
    throw new Error('A valid appeal outcome is required.');
  }
  const appealOutcome = outcomeRaw as AppealOutcome;

  const savingsDollarsRaw = String(formData.get('actual_savings_dollars') ?? '').trim();
  let actualSavingsCents: number | null = null;
  if (savingsDollarsRaw !== '') {
    const dollars = parseFloat(savingsDollarsRaw);
    if (isNaN(dollars) || dollars < 0 || dollars > 999_999_999) {
      throw new Error('Savings must be a valid number between $0 and $999,999,999.');
    }
    actualSavingsCents = Math.round(dollars * 100);
  }

  const outcomeNotes =
    String(formData.get('outcome_notes') ?? '').trim() || null;

  // Fetch the report to get its county_fips
  const { data: rawReport, error: fetchError } = await supabase
    .from('reports')
    .select('county_fips')
    .eq('id', reportId)
    .single();

  if (fetchError || !rawReport) {
    throw new Error('Report not found.');
  }
  const report = rawReport as unknown as { county_fips: string | null };

  // Update the report with outcome data
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      appeal_outcome: appealOutcome,
      actual_savings_cents: actualSavingsCents,
      outcome_notes: outcomeNotes,
      outcome_reported_at: new Date().toISOString(),
      appeal_outcome_details: {
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
      },
    } as never)
    .eq('id', reportId);

  if (updateError) {
    throw new Error(`Failed to record outcome: ${updateError.message}`);
  }

  // Recalculate county stats + aggregate full filing intelligence
  if (report.county_fips) {
    await recalculateCountyStats(supabase, report.county_fips);
    // Full intelligence aggregation — updates winning_argument_patterns from our data
    aggregateCountyIntelligence(report.county_fips).catch(err =>
      console.error(`[outcomes] Intelligence aggregation failed: ${err}`)
    );
  }

  // Generate referral code for winning appellants
  if (['won_full', 'won_partial', 'settled_informal'].includes(appealOutcome)) {
    const { data: fullReport } = await supabase
      .from('reports')
      .select('client_email, client_name')
      .eq('id', reportId)
      .single();
    if (fullReport) {
      const r = fullReport as unknown as { client_email: string; client_name: string | null };
      if (r.client_email) {
        generateReferralCode(r.client_email, r.client_name).catch(err =>
          console.error(`[outcomes] Referral code generation failed: ${err}`)
        );
      }
    }
  }

  revalidatePath('/admin/outcomes');
}

async function recalculateCountyStats(
  supabase: ReturnType<typeof createAdminClient>,
  countyFips: string
) {
  // Fetch all reports in this county that have an outcome
  const { data: rawCountyReports } = await supabase
    .from('reports')
    .select('appeal_outcome, actual_savings_cents, amount_paid_cents')
    .eq('county_fips', countyFips)
    .not('appeal_outcome', 'is', null);

  const countyReports = rawCountyReports as unknown as Array<{
    appeal_outcome: string;
    actual_savings_cents: number | null;
    amount_paid_cents: number | null;
  }> | null;

  if (!countyReports || countyReports.length === 0) return;

  // Filter out pending_hearing for win rate calculation
  const resolved = countyReports.filter(
    (r) => r.appeal_outcome !== 'pending_hearing'
  );

  let successRatePct: number | null = null;
  if (resolved.length > 0) {
    const wins = resolved.filter((r) =>
      ['won_full', 'won_partial', 'settled_informal'].includes(r.appeal_outcome)
    );
    successRatePct = (wins.length / resolved.length) * 100;
  }

  // Average savings from reports with positive savings
  const withSavings = countyReports.filter(
    (r) => r.actual_savings_cents != null && r.actual_savings_cents > 0
  );

  let avgSavingsPct: number | null = null;
  if (withSavings.length > 0) {
    // Calculate avg_savings_pct as average percentage savings relative to amount paid
    // If amount_paid_cents is available, compute savings as % of paid; otherwise just store raw average
    const pctValues = withSavings
      .filter((r) => r.amount_paid_cents && r.amount_paid_cents > 0)
      .map((r) => ((r.actual_savings_cents ?? 0) / (r.amount_paid_cents ?? 1)) * 100);

    if (pctValues.length > 0) {
      avgSavingsPct =
        pctValues.reduce((sum, v) => sum + v, 0) / pctValues.length;
    }
  }

  await supabase
    .from('county_rules')
    .update({
      success_rate_pct: successRatePct,
      avg_savings_pct: avgSavingsPct,
    } as never)
    .eq('county_fips', countyFips);
}
