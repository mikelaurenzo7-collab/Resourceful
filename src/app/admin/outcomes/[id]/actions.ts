'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isAdminWithEmailMatch } from '@/lib/repository/admin';
import { revalidatePath } from 'next/cache';
import { aggregateCountyIntelligence } from '@/lib/services/filing-intelligence';
import { generateReferralCode } from '@/lib/services/referral-service';
import { adminLogger } from '@/lib/logger';

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
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user?.email) throw new Error('Not authenticated');
  if (!(await isAdminWithEmailMatch(user.id, user.email))) {
    throw new Error('Not authorized — admin access required');
  }

  const supabase = createAdminClient();

  const outcomeRaw = String(formData.get('appeal_outcome') ?? '').trim();
  if (!outcomeRaw || !VALID_OUTCOMES.includes(outcomeRaw as AppealOutcome)) {
    throw new Error('A valid appeal outcome is required.');
  }
  const appealOutcome = outcomeRaw as AppealOutcome;

  const savingsDollarsRaw = String(formData.get('actual_savings_dollars') ?? '').trim();
  let actualSavingsCents: number | null = null;
  if (savingsDollarsRaw !== '') {
    const dollars = parseFloat(savingsDollarsRaw);
    if (isNaN(dollars) || dollars < 0) {
      throw new Error('Savings must be a valid non-negative number.');
    }
    actualSavingsCents = Math.round(dollars * 100);
  }

  const outcomeNotes =
    String(formData.get('outcome_notes') ?? '').trim() || null;

  const { data: rawReport, error: fetchError } = await supabase
    .from('reports')
    .select('county_fips')
    .eq('id', reportId)
    .single();

  if (fetchError || !rawReport) {
    throw new Error('Report not found.');
  }
  const report = rawReport as unknown as { county_fips: string | null };

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

  if (report.county_fips) {
    await recalculateCountyStats(supabase, report.county_fips);
    try {
      await aggregateCountyIntelligence(report.county_fips);
    } catch (err) {
      adminLogger.error(
        { reportId, countyFips: report.county_fips, err: String(err) },
        '[outcomes] Intelligence aggregation failed'
      );
    }
  }

  if (['won_full', 'won_partial', 'settled_informal'].includes(appealOutcome)) {
    const { data: fullReport } = await supabase
      .from('reports')
      .select('client_email, client_name')
      .eq('id', reportId)
      .single();
    if (fullReport) {
      const r = fullReport as unknown as {
        client_email: string;
        client_name: string | null;
      };
      if (r.client_email) {
        try {
          await generateReferralCode(r.client_email, r.client_name);
        } catch (err) {
          adminLogger.error(
            { reportId, err: String(err) },
            '[outcomes] Referral code generation failed'
          );
        }
      }
    }
  }

  revalidatePath('/admin/outcomes');
}

async function recalculateCountyStats(
  supabase: ReturnType<typeof createAdminClient>,
  countyFips: string
) {
  const { data: rawCountyReports } = await supabase
    .from('reports')
    .select('appeal_outcome, actual_savings_cents, tax_bill_tax_amount')
    .eq('county_fips', countyFips)
    .not('appeal_outcome', 'is', null);

  const countyReports = rawCountyReports as unknown as Array<{
    appeal_outcome: string;
    actual_savings_cents: number | null;
    tax_bill_tax_amount: number | null;
  }> | null;

  if (!countyReports || countyReports.length === 0) return;

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

  // Savings percentage must use a tax basis, not Resourceful's service fee.
  // tax_bill_tax_amount is stored in dollars; actual_savings_cents is cents.
  // Only comparable annual values (savings <= recorded annual tax) are used so
  // multi-year refunds or malformed inputs do not corrupt county intelligence.
  const pctValues = countyReports
    .filter((r) => {
      if (!r.actual_savings_cents || r.actual_savings_cents <= 0) return false;
      if (!r.tax_bill_tax_amount || r.tax_bill_tax_amount <= 0) return false;
      return r.actual_savings_cents / 100 <= r.tax_bill_tax_amount;
    })
    .map(
      (r) =>
        ((r.actual_savings_cents ?? 0) / 100 / (r.tax_bill_tax_amount ?? 1)) *
        100
    );

  const avgSavingsPct =
    pctValues.length > 0
      ? pctValues.reduce((sum, value) => sum + value, 0) / pctValues.length
      : null;

  const { error } = await supabase
    .from('county_rules')
    .update({
      success_rate_pct: successRatePct,
      avg_savings_pct: avgSavingsPct,
    } as never)
    .eq('county_fips', countyFips);

  if (error) {
    throw new Error(`Failed to update county outcome statistics: ${error.message}`);
  }
}
