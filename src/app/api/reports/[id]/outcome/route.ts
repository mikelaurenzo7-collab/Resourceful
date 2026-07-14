// ─── POST /api/reports/[id]/outcome ──────────────────────────────────────────
// Records the user's appeal outcome for the calibration feedback loop.
//
// Auth: either authenticated user who owns the report, OR a valid
// outcome_followup_token (for unauthenticated submission via email link).
//
// After recording the outcome:
// 1. Updates report fields (including the legacy actual_savings_cents field,
//    which stores assessed-value reduction rather than annual tax savings)
// 2. Creates a calibration entry (predicted vs actual)
// 3. Recalculates county-level stats

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { createCalibrationEntry } from '@/lib/services/calibration';
import {
  calculateAssessmentReductionCents,
  validateOutcomeSubmission,
  validateWinningAssessmentReduction,
} from '@/lib/outcomes/validation';
import type { Report, PropertyData } from '@/types/database';
import { apiLogger } from '@/lib/logger';

/** Timing-safe token comparison to prevent enumeration via response-time analysis. */
function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

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

  const body = await req.json().catch(() => null) as {
    outcome?: unknown;
    new_assessed_value?: unknown;
    notes?: unknown;
    token?: unknown;
  } | null;

  if (!body) {
    return NextResponse.json({ error: 'A valid JSON request body is required.' }, { status: 400 });
  }

  const validation = validateOutcomeSubmission({
    outcome: body.outcome,
    newAssessedValue: body.new_assessed_value,
    notes: body.notes,
  });

  if (!validation.valid || !validation.outcome) {
    return NextResponse.json(
      { error: validation.error ?? 'Invalid outcome submission.' },
      { status: 400 }
    );
  }

  const outcome = validation.outcome;
  const newAssessedValue = validation.newAssessedValue ?? null;
  const notes = validation.notes ?? null;
  const token = typeof body.token === 'string' ? body.token : null;

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

  if (token && report.outcome_followup_token && tokensMatch(token, report.outcome_followup_token)) {
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

  const propertyData = report.property_data?.[0] ?? null;
  let assessmentReductionCents: number | null = null;

  if (outcome === 'won') {
    const reductionValidation = validateWinningAssessmentReduction(
      propertyData?.assessed_value,
      newAssessedValue
    );

    if (!reductionValidation.valid || newAssessedValue == null || propertyData?.assessed_value == null) {
      return NextResponse.json(
        { error: reductionValidation.error ?? 'Winning appeal reduction could not be validated.' },
        { status: 400 }
      );
    }

    assessmentReductionCents = calculateAssessmentReductionCents(
      propertyData.assessed_value,
      newAssessedValue
    );
  }

  // ── Update report ─────────────────────────────────────────────────────
  const { error: updateError } = await adminSupabase
    .from('reports')
    .update({
      appeal_outcome: outcome,
      // Legacy column name retained for compatibility. The stored value is the
      // assessment-base reduction in cents, not annual tax-dollar savings.
      actual_savings_cents: assessmentReductionCents,
      outcome_notes: notes,
      outcome_reported_at: new Date().toISOString(),
      outcome_followup_token: null, // Invalidate token after use
      appeal_outcome_details: {
        new_assessed_value: newAssessedValue,
        metric: 'assessment_value_reduction',
        reported_by: 'client',
        reported_via: token ? 'email_followup' : 'dashboard',
      },
    })
    .eq('id', reportId);

  if (updateError) {
    apiLogger.error({ err: updateError.message, reportId }, 'Failed to update report outcome');
    return NextResponse.json({ error: 'Failed to record outcome' }, { status: 500 });
  }

  // ── Create calibration entry (non-blocking) ───────────────────────────
  try {
    await createCalibrationEntry(reportId, adminSupabase);
  } catch (err) {
    apiLogger.error({ err, reportId }, 'Calibration entry failed');
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
        const wins = outcomes.filter((row) => row.appeal_outcome === 'won');
        const winRate = wins.length / outcomes.length;

        // Legacy avg_savings_pct stores the mean percentage reduction in assessed
        // value across winning appeals, not a tax-bill savings percentage.
        let averageAssessmentReductionPct: number | null = null;
        if (wins.length > 0) {
          const reductionPcts = wins
            .map((row) => {
              const reductionCents = row.actual_savings_cents ?? 0;
              const property = Array.isArray(row.property_data)
                ? row.property_data[0]
                : row.property_data;
              const assessed = property?.assessed_value ?? 0;
              if (reductionCents > 0 && assessed > 0) {
                return ((reductionCents / 100) / assessed) * 100;
              }
              return null;
            })
            .filter((percentage): percentage is number => percentage != null);

          if (reductionPcts.length > 0) {
            averageAssessmentReductionPct = Math.round(
              (reductionPcts.reduce((sum, percentage) => sum + percentage, 0) /
                reductionPcts.length) * 10
            ) / 10;
          }
        }

        await adminSupabase
          .from('county_rules')
          .update({
            success_rate_pct: Math.round(winRate * 100),
            avg_savings_pct: averageAssessmentReductionPct,
            success_rate_source: 'client_reported_outcomes',
          })
          .eq('county_fips', report.county_fips);
      }
    } catch (err) {
      apiLogger.error({ err, countyFips: report.county_fips }, 'County stats update failed');
    }
  }

  const assessmentReduction = assessmentReductionCents != null
    ? assessmentReductionCents / 100
    : null;

  apiLogger.info(
    { outcome, reportId, assessmentReduction },
    '[outcome] Recorded appeal outcome'
  );

  return NextResponse.json({
    success: true,
    outcome,
    assessment_reduction: assessmentReduction,
    assessment_reduction_metric: 'assessed_value',
    // Deprecated compatibility alias. This is not annual tax savings.
    savings: assessmentReduction,
  });
}
