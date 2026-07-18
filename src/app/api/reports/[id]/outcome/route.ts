// ─── POST /api/reports/[id]/outcome ──────────────────────────────────────────
// Records the user's appeal outcome for the calibration feedback loop.
//
// Auth: either authenticated user who owns the report, OR a valid
// outcome_followup_token (for unauthenticated submission via email link).

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
import {
  filingStatusForOutcome,
  isAdjudicatedAppealOutcome,
  isFinalAppealOutcome,
  validateOutcomeFilingContext,
  validateOutcomeTransition,
} from '@/lib/outcomes/lifecycle';
import type { Report, PropertyData } from '@/types/database';
import { apiLogger } from '@/lib/logger';

function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { data: reportData, error: reportError } = await adminSupabase
    .from('reports')
    .select('*, property_data(*)')
    .eq('id', reportId)
    .single();

  if (reportError || !reportData) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const report = reportData as Report & { property_data: PropertyData[] };

  // Authenticate before returning case-specific lifecycle information.
  let authorized = false;
  let authorizationChannel: 'email_followup' | 'dashboard' = 'dashboard';

  if (token && report.outcome_followup_token && tokensMatch(token, report.outcome_followup_token)) {
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
    authorizationChannel = 'email_followup';
  } else {
    const userSupabase = await createClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (user) {
      const isOwner = report.user_id
        ? report.user_id === user.id
        : normalizeEmail(report.client_email) === normalizeEmail(user.email);
      if (isOwner) authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (report.status !== 'delivered') {
    return NextResponse.json(
      { error: 'Can only record outcomes for delivered reports' },
      { status: 400 }
    );
  }

  if (report.service_type !== 'tax_appeal') {
    return NextResponse.json(
      { error: 'Appeal outcomes are available only for tax appeal assignments.' },
      { status: 400 }
    );
  }

  const transitionValidation = validateOutcomeTransition(report.appeal_outcome, outcome);
  if (!transitionValidation.valid) {
    return NextResponse.json(
      { error: transitionValidation.error ?? 'Invalid appeal outcome transition.' },
      { status: 409 }
    );
  }

  const filingContextValidation = validateOutcomeFilingContext({
    outcome,
    filingStatus: report.filing_status,
    filedAt: report.filed_at,
    filingMethod: report.filing_method,
  });
  if (!filingContextValidation.valid) {
    return NextResponse.json(
      { error: filingContextValidation.error ?? 'Filing details are incomplete.' },
      { status: 409 }
    );
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

  const now = new Date().toISOString();
  const finalOutcome = isFinalAppealOutcome(outcome);
  const nextFilingStatus = filingStatusForOutcome(outcome, report.filing_status);

  const { error: updateError } = await adminSupabase
    .from('reports')
    .update({
      appeal_outcome: outcome,
      actual_savings_cents: assessmentReductionCents,
      outcome_notes: notes,
      // `outcome_reported_at` is reserved for a final decision. Pending is a
      // lifecycle state, not a completed result, and may later be updated.
      outcome_reported_at: finalOutcome ? now : null,
      outcome_followup_token: finalOutcome ? null : report.outcome_followup_token,
      filing_status: nextFilingStatus,
      appeal_outcome_details: {
        new_assessed_value: newAssessedValue,
        metric: 'assessment_value_reduction',
        status: finalOutcome ? 'final' : 'pending',
        reported_at: now,
        reported_by: 'client',
        reported_via: authorizationChannel,
        previous_outcome: report.appeal_outcome,
      },
    })
    .eq('id', reportId);

  if (updateError) {
    apiLogger.error({ err: updateError.message, reportId }, 'Failed to update report outcome');
    return NextResponse.json({ error: 'Failed to record outcome' }, { status: 500 });
  }

  // Only adjudicated final decisions should train valuation calibration.
  if (isAdjudicatedAppealOutcome(outcome)) {
    try {
      await createCalibrationEntry(reportId, adminSupabase);
    } catch (err) {
      apiLogger.error({ err, reportId }, 'Calibration entry failed');
    }
  }

  // County success rates use adjudicated wins and losses only. Pending,
  // withdrawn, and unfiled cases are operational outcomes, not decisions on merit.
  if (report.county_fips && isAdjudicatedAppealOutcome(outcome)) {
    try {
      const { data: countyOutcomes } = await adminSupabase
        .from('reports')
        .select('appeal_outcome, actual_savings_cents, property_data(assessed_value)')
        .eq('county_fips', report.county_fips)
        .in('appeal_outcome', ['won', 'lost'])
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
            success_rate_source: 'client_reported_adjudicated_outcomes',
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
    { outcome, finalOutcome, reportId, assessmentReduction, nextFilingStatus },
    '[outcome] Recorded appeal lifecycle update'
  );

  return NextResponse.json({
    success: true,
    outcome,
    final: finalOutcome,
    filing_status: nextFilingStatus,
    assessment_reduction: assessmentReduction,
    assessment_reduction_metric: 'assessed_value',
    savings: assessmentReduction,
  });
}
