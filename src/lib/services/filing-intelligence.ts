// ─── Filing Intelligence Aggregation ──────────────────────────────────────────
// Tracks what works from our own filings and feeds it back into county rules.
// As we file more appeals, we learn:
//   - Which arguments win in which counties
//   - Average time to resolution
//   - Informal vs formal success rates from OUR data
//   - Optimal filing methods per county
//
// This compounds — after 100+ filings in a county, we know EXACTLY what works.

import { createAdminClient } from '@/lib/supabase/admin';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CountyFilingIntelligence {
  countyFips: string;
  countyName: string;
  state: string;
  totalFiled: number;
  totalWon: number;
  totalLost: number;
  winRate: number;                    // 0-100
  avgSavingsDollars: number;
  avgDaysToResolution: number | null;
  informalSuccessRate: number | null;  // % that succeeded at informal stage
  bestFilingMethod: string | null;    // most successful method
  topWinningArguments: string[];      // from outcome_notes analysis
  commonLossReasons: string[];        // from outcome_notes when lost
}

// ─── Intelligence Aggregation ────────────────────────────────────────────────

/**
 * Aggregate filing intelligence for a specific county from our own data.
 * Called after recording an outcome to update county_rules with fresh stats.
 */
export async function aggregateCountyIntelligence(
  countyFips: string
): Promise<CountyFilingIntelligence | null> {
  const supabase = createAdminClient();

  // Fetch all reports with outcomes for this county
  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .eq('county_fips', countyFips)
    .not('appeal_outcome', 'is', null);

  if (!reports || reports.length === 0) return null;

  const outcomes = reports as Array<Record<string, unknown>>;

  let totalWon = 0;
  let totalLost = 0;
  let totalSavings = 0;
  let savingsCount = 0;
  let informalWins = 0;
  let totalDays = 0;
  let daysCount = 0;
  const filingMethods: Record<string, number> = {};
  const winNotes: string[] = [];
  const lossNotes: string[] = [];

  for (const r of outcomes) {
    const outcome = r.appeal_outcome as string;
    const savings = Number(r.actual_savings_cents) || 0;
    const method = r.filing_method as string;
    const notes = r.outcome_notes as string;

    // Win/loss tracking
    if (['won_full', 'won_partial', 'settled_informal'].includes(outcome)) {
      totalWon++;
      if (outcome === 'settled_informal') informalWins++;
      if (notes) winNotes.push(notes);
    } else if (['lost', 'withdrawn'].includes(outcome)) {
      totalLost++;
      if (notes) lossNotes.push(notes);
    }

    // Savings tracking
    if (savings > 0) {
      totalSavings += savings;
      savingsCount++;
    }

    // Filing method tracking
    if (method) {
      filingMethods[method] = (filingMethods[method] ?? 0) + 1;
    }

    // Resolution time
    const filedAt = r.filed_at as string;
    const outcomeAt = r.outcome_reported_at as string;
    if (filedAt && outcomeAt) {
      const days = Math.round(
        (new Date(outcomeAt).getTime() - new Date(filedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days > 0) {
        totalDays += days;
        daysCount++;
      }
    }
  }

  const totalDecided = totalWon + totalLost;
  const winRate = totalDecided > 0 ? Math.round((totalWon / totalDecided) * 100) : 0;
  const avgSavings = savingsCount > 0 ? Math.round(totalSavings / savingsCount / 100) : 0;
  const avgDays = daysCount > 0 ? Math.round(totalDays / daysCount) : null;
  const informalRate = totalWon > 0 ? Math.round((informalWins / totalWon) * 100) : null;

  // Best filing method
  const bestMethod = Object.entries(filingMethods)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Fetch county info
  const { data: county } = await supabase
    .from('county_rules')
    .select('county_name, state_abbreviation')
    .eq('county_fips', countyFips)
    .single();

  const intel: CountyFilingIntelligence = {
    countyFips,
    countyName: (county as Record<string, string>)?.county_name ?? '',
    state: (county as Record<string, string>)?.state_abbreviation ?? '',
    totalFiled: outcomes.length,
    totalWon,
    totalLost,
    winRate,
    avgSavingsDollars: avgSavings,
    avgDaysToResolution: avgDays,
    informalSuccessRate: informalRate,
    bestFilingMethod: bestMethod,
    topWinningArguments: winNotes.slice(0, 5),
    commonLossReasons: lossNotes.slice(0, 3),
  };

  // Update county_rules with our aggregated intelligence
  const updates: Record<string, unknown> = {
    success_rate_pct: winRate,
    success_rate_source: `REsourceful data (${totalDecided} outcomes)`,
    avg_savings_pct: avgSavings > 0 && savingsCount > 0
      ? Math.round((totalSavings / savingsCount) / (Number(outcomes[0]?.amount_paid_cents) || 4900) * 100)
      : null,
  };

  // Build winning argument patterns from our own outcome data
  if (winNotes.length >= 3) {
    updates.winning_argument_patterns =
      `From our ${totalWon} successful appeals: ${winNotes.slice(0, 3).join('; ')}`;
  }

  await supabase
    .from('county_rules')
    .update(updates as never)
    .eq('county_fips', countyFips);

  console.log(
    `[filing-intel] Updated ${countyFips}: ${winRate}% win rate, ` +
    `$${avgSavings} avg savings, ${totalDecided} outcomes`
  );

  return intel;
}

/**
 * Get filing intelligence summary for the admin dashboard.
 */
export async function getFilingIntelligenceSummary(): Promise<{
  totalOutcomesRecorded: number;
  overallWinRate: number;
  avgSavingsDollars: number;
  countiesWithData: number;
}> {
  const supabase = createAdminClient();

  const { data: outcomes } = await supabase
    .from('reports')
    .select('appeal_outcome, actual_savings_cents, county_fips')
    .not('appeal_outcome', 'is', null);

  if (!outcomes || outcomes.length === 0) {
    return { totalOutcomesRecorded: 0, overallWinRate: 0, avgSavingsDollars: 0, countiesWithData: 0 };
  }

  const wins = outcomes.filter((o: Record<string, unknown>) =>
    ['won_full', 'won_partial', 'settled_informal'].includes(o.appeal_outcome as string)
  ).length;

  const decided = outcomes.filter((o: Record<string, unknown>) =>
    !['pending_hearing'].includes(o.appeal_outcome as string)
  ).length;

  const totalSavings = outcomes.reduce((sum: number, o: Record<string, unknown>) =>
    sum + (Number(o.actual_savings_cents) || 0), 0
  );

  const savingsCount = outcomes.filter((o: Record<string, unknown>) =>
    Number(o.actual_savings_cents) > 0
  ).length;

  const counties = new Set(outcomes.map((o: Record<string, unknown>) => o.county_fips).filter(Boolean));

  return {
    totalOutcomesRecorded: outcomes.length,
    overallWinRate: decided > 0 ? Math.round((wins / decided) * 100) : 0,
    avgSavingsDollars: savingsCount > 0 ? Math.round(totalSavings / savingsCount / 100) : 0,
    countiesWithData: counties.size,
  };
}
