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

  // Validate new_assessed_value if provided
  if (new_assessed_value !== undefined && new_assessed_value !== null) {
    if (typeof new_assessed_value !== 'number' || !isFinite(new_assessed_value) || new_assessed_value < 0 || new_assessed_value > 100_000_000_00) {
      return NextResponse.json(
        { error: 'Invalid assessed value. Must be a positive number.' },
        { status: 400 }
      );
    }
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
    // Token-based auth: verify token hasn't expired (30 days after followup email)
    const TOKEN_EXPIRY_DAYS = 30;
    if (report.outcome_followup_sent_at) {
      const sentAt = new Date(report.outcome_followup_sent_at).getTime();
      const expiresAt = sentAt + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() > expiresAt) {
        return NextResponse.json(
          { error: 'This link has expired. Please log in to report your outcome.' },
          { status: 401 }
        );
      }
    }
    authorized = true;
  } else {
    // Check if authenticated user owns this report
    const userSupabase = await createClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (user) {
      const isOwner = report.user_id
        ? report.user_id === user.id
        : report.client_email === user.email;
      if (isOwner) authorized = true;
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
      // Count wins and total for this county.
      // Join property_data to get assessed_value for percentage calculations.
      const { data: countyOutcomes } = await adminSupabase
        .from('reports')
        .select('appeal_outcome, actual_savings_cents, property_data(assessed_value)')
        .eq('county_fips', report.county_fips)
        .not('outcome_reported_at', 'is', null);

      type OutcomeRow = {
        appeal_outcome: string | null;
        actual_savings_cents: number | null;
        property_data: { assessed_value: number | null }[] | { assessed_value: number | null } | null;
      };
      const outcomes = (countyOutcomes ?? []) as unknown as OutcomeRow[];

      if (outcomes.length > 0) {
        const wins = outcomes.filter(r => r.appeal_outcome === 'won');
        const winRate = wins.length / outcomes.length;

        // Compute avg_savings_pct as the mean percentage reduction in assessed value
        // across winning appeals. actual_savings_cents is the assessment reduction in cents.
        let avgSavingsPct: number | null = null;
        if (wins.length > 0) {
          const savingsPcts = wins
            .map((r) => {
              const savingsCents = (r.actual_savings_cents as number) ?? 0;
              const pd = Array.isArray(r.property_data) ? r.property_data[0] : r.property_data;
              const assessed = (pd as { assessed_value: number | null } | null)?.assessed_value ?? 0;
              if (savingsCents > 0 && assessed > 0) {
                // savings in dollars / assessed value = percentage
                return ((savingsCents / 100) / assessed) * 100;
              }
              return null;
            })
            .filter((p): p is number => p != null);

          if (savingsPcts.length > 0) {
            avgSavingsPct = Math.round(
              savingsPcts.reduce((sum, p) => sum + p, 0) / savingsPcts.length * 10
            ) / 10;
          }
        }

        await adminSupabase
          .from('county_rules')
          .update({
            success_rate_pct: Math.round(winRate * 100),
            avg_savings_pct: avgSavingsPct,
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
