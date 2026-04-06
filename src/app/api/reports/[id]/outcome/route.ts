// ─── POST /api/reports/[id]/outcome ──────────────────────────────────────────
// Records the user's appeal outcome for the calibration feedback loop.
//
// Auth: either authenticated user who owns the report, OR a valid
// outcome_followup_token (for unauthenticated submission via email link).
//
// After recording the outcome:
// 1. Updates report fields (appeal_outcome, actual_savings_cents, etc.)
// 2. Creates a calibration entry (predicted vs actual)
// 3. Recalculates county-level stats

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { createCalibrationEntry } from '@/lib/services/calibration';
import type { Report, PropertyData } from '@/types/database';

const VALID_OUTCOMES = ['won', 'lost', 'pending', 'withdrew', 'didnt_file'] as const;
type AppealOutcome = typeof VALID_OUTCOMES[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit: 10 outcome submissions per 15 minutes per IP
  const rateLimitResponse = await applyRateLimit(req, {
    prefix: 'outcome-submit',
    limit: 10,
    windowSeconds: 900,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const { id: reportId } = await params;

  if (!reportId) {
    return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
  }

  const body = await req.json();
  const { outcome, new_assessed_value, notes, token } = body as {
    outcome?: string;
    new_assessed_value?: number;
    notes?: string;
    token?: string;
  };

  // Validate outcome
  if (!outcome || !VALID_OUTCOMES.includes(outcome as AppealOutcome)) {
    return NextResponse.json(
      { error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(', ')}` },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // Fetch report
  const { data: reportData, error: reportError } = await adminSupabase
    .from('reports')
    .select('*, property_data(*)')
    .eq('id', reportId)
    .single();

  if (reportError || !reportData) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const report = reportData as Report & { property_data: PropertyData[] };

  // Verify report is delivered
  if (report.status !== 'delivered') {
    return NextResponse.json(
      { error: 'Can only record outcomes for delivered reports' },
      { status: 400 }
    );
  }

  // Already recorded
  if (report.outcome_reported_at) {
    return NextResponse.json(
      { error: 'Outcome already recorded for this report' },
      { status: 409 }
    );
  }

  // ── Auth: token-based or session-based ──────────────────────────────────
  let authorized = false;

  if (token && report.outcome_followup_token === token) {
    authorized = true;
  } else {
    // Check if authenticated user owns this report
    const userSupabase = await createClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (user && report.user_id === user.id) {
      authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Calculate savings ─────────────────────────────────────────────────
  const propertyData = report.property_data?.[0] ?? null;
  let actualSavingsCents: number | null = null;

  if (outcome === 'won' && new_assessed_value != null && propertyData?.assessed_value) {
    const reduction = propertyData.assessed_value - new_assessed_value;
    actualSavingsCents = Math.max(0, Math.round(reduction * 100));
  }

  // ── Update report ─────────────────────────────────────────────────────
  const { error: updateError } = await adminSupabase
    .from('reports')
    .update({
      appeal_outcome: outcome,
      actual_savings_cents: actualSavingsCents,
      outcome_notes: notes ?? null,
      outcome_reported_at: new Date().toISOString(),
      outcome_followup_token: null, // Invalidate token after use
      appeal_outcome_details: {
        new_assessed_value: new_assessed_value ?? null,
        reported_by: 'client',
        reported_via: token ? 'email_followup' : 'dashboard',
      },
    })
    .eq('id', reportId);

  if (updateError) {
    console.error(`[outcome] Failed to update report ${reportId}:`, updateError.message);
    return NextResponse.json({ error: 'Failed to record outcome' }, { status: 500 });
  }

  // ── Create calibration entry (non-blocking) ───────────────────────────
  try {
    await createCalibrationEntry(reportId, adminSupabase);
  } catch (err) {
    console.error(`[outcome] Calibration entry failed for ${reportId}:`, err);
    // Don't fail the outcome recording if calibration fails
  }

  // ── Recalculate county stats (non-blocking) ───────────────────────────
  if (report.county_fips) {
    try {
      // Count wins and total for this county
      const { data: countyOutcomes } = await adminSupabase
        .from('reports')
        .select('appeal_outcome, actual_savings_cents')
        .eq('county_fips', report.county_fips)
        .not('outcome_reported_at', 'is', null);

      if (countyOutcomes && countyOutcomes.length > 0) {
        const wins = countyOutcomes.filter(r => r.appeal_outcome === 'won');
        const winRate = wins.length / countyOutcomes.length;
        const avgSavings = wins.length > 0
          ? wins.reduce((sum, r) => sum + ((r.actual_savings_cents as number) ?? 0), 0) / wins.length / 100
          : 0;

        await adminSupabase
          .from('county_rules')
          .update({
            success_rate_pct: Math.round(winRate * 100),
            avg_savings_pct: avgSavings > 0 ? Math.round(avgSavings) : null,
            success_rate_source: 'client_reported_outcomes',
          })
          .eq('county_fips', report.county_fips);
      }
    } catch (err) {
      console.error(`[outcome] County stats update failed for ${report.county_fips}:`, err);
    }
  }

  console.log(`[outcome] Recorded ${outcome} for report ${reportId}`);

  return NextResponse.json({
    success: true,
    outcome,
    savings: actualSavingsCents != null ? actualSavingsCents / 100 : null,
  });
}
