// ─── Outcome Follow-Up Service ───────────────────────────────────────────────
// Sends outcome requests after delivery. Responses feed the county calibration
// loop. A short-lived database lease and a stable email idempotency key prevent
// overlapping workers from sending the same follow-up concurrently.

import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendVerifiedOutcomeFollowupEmail } from '@/lib/services/customer-notification-email';
import { calculateAssessmentGap } from '@/lib/valuation/assessment-gap';
import type { Database, Report, PropertyData } from '@/types/database';
import { emailLogger } from '@/lib/logger';

const FOLLOWUP_DELAY_DAYS = 60;
const CLAIM_LEASE_MINUTES = 15;
const FOLLOWUP_SELECT: string =
  'id, client_email, client_name, property_address, city, state, outcome_followup_token, outcome_followup_claimed_at';

type FollowupReport = Pick<
  Report,
  | 'id'
  | 'client_email'
  | 'client_name'
  | 'property_address'
  | 'city'
  | 'state'
  | 'outcome_followup_token'
> & {
  outcome_followup_claimed_at: string | null;
};

async function releaseClaim(
  supabase: SupabaseClient<Database>,
  reportId: string,
  claimedAt: string
): Promise<string | null> {
  const { error } = await supabase
    .from('reports')
    .update({ outcome_followup_claimed_at: null } as Record<string, unknown>)
    .eq('id', reportId)
    .eq('outcome_followup_claimed_at' as string, claimedAt)
    .is('outcome_followup_sent_at', null);

  return error?.message ?? null;
}

export async function sendOutcomeFollowups(): Promise<{ sent: number; errors: number }> {
  const supabase = createAdminClient();
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - FOLLOWUP_DELAY_DAYS);
  const leaseCutoff = new Date(
    now.getTime() - CLAIM_LEASE_MINUTES * 60 * 1000
  ).toISOString();
  const availableLeaseFilter =
    `outcome_followup_claimed_at.is.null,outcome_followup_claimed_at.lt.${leaseCutoff}`;

  const { data: reports, error } = await supabase
    .from('reports')
    .select(FOLLOWUP_SELECT)
    .eq('status', 'delivered')
    .eq('service_type', 'tax_appeal')
    .is('outcome_reported_at', null)
    .is('outcome_followup_sent_at', null)
    .lte('delivered_at', cutoffDate.toISOString())
    .or(availableLeaseFilter)
    .limit(50);

  if (error) {
    emailLogger.error({ error: error.message }, '[outcome-followup] Query failed');
    return { sent: 0, errors: 1 };
  }

  if (!reports || reports.length === 0) {
    return { sent: 0, errors: 0 };
  }

  emailLogger.info(
    { count: reports.length },
    '[outcome-followup] Reports are due for outcome follow-up'
  );

  let sent = 0;
  let errors = 0;

  for (const rawReport of reports) {
    const candidate = rawReport as unknown as FollowupReport;
    if (!candidate.client_email) continue;

    const token = candidate.outcome_followup_token?.trim() || randomUUID();
    const claimedAt = new Date().toISOString();
    const { data: claimedRaw, error: claimError } = await supabase
      .from('reports')
      .update({
        outcome_followup_token: token,
        outcome_followup_claimed_at: claimedAt,
      } as Record<string, unknown>)
      .eq('id', candidate.id)
      .eq('status', 'delivered')
      .is('outcome_reported_at', null)
      .is('outcome_followup_sent_at', null)
      .or(availableLeaseFilter)
      .select(FOLLOWUP_SELECT)
      .single();

    if (claimError || !claimedRaw) {
      if (claimError && claimError.code !== 'PGRST116') {
        emailLogger.error(
          { reportId: candidate.id, error: claimError.message },
          '[outcome-followup] Failed to claim follow-up'
        );
        errors++;
      }
      continue;
    }

    const report = claimedRaw as unknown as FollowupReport;

    try {
      const { data: propertyDataRaw, error: propertyError } = await supabase
        .from('property_data')
        .select('assessed_value, concluded_value, assessment_ratio')
        .eq('report_id', report.id)
        .single();

      if (propertyError) {
        emailLogger.warn(
          { reportId: report.id, error: propertyError.message },
          '[outcome-followup] Property metrics unavailable; sending follow-up without an assessment gap'
        );
      }

      const propertyData = propertyDataRaw as Pick<
        PropertyData,
        'assessed_value' | 'concluded_value' | 'assessment_ratio'
      > | null;
      const assessmentGap = calculateAssessmentGap({
        currentAssessedValue: propertyData?.assessed_value,
        concludedMarketValue: propertyData?.concluded_value,
        assessmentRatio: propertyData?.assessment_ratio,
      });
      const propertyAddress = [
        report.property_address,
        report.city,
        report.state,
      ].filter(Boolean).join(', ');

      const result = await sendVerifiedOutcomeFollowupEmail({
        to: report.client_email,
        clientName: report.client_name,
        reportId: report.id,
        propertyAddress,
        assessmentGap: assessmentGap?.assessmentGap ?? null,
        outcomeToken: token,
      });

      if (result.error) {
        const releaseError = await releaseClaim(supabase, report.id, claimedAt);
        emailLogger.error(
          { reportId: report.id, error: result.error, releaseError },
          '[outcome-followup] Email failed and remains eligible for retry'
        );
        errors++;
        continue;
      }

      const { data: stamped, error: sentStampError } = await supabase
        .from('reports')
        .update({
          outcome_followup_sent_at: new Date().toISOString(),
          outcome_followup_claimed_at: null,
        } as Record<string, unknown>)
        .eq('id', report.id)
        .eq('outcome_followup_token', token)
        .eq('outcome_followup_claimed_at' as string, claimedAt)
        .is('outcome_reported_at', null)
        .is('outcome_followup_sent_at', null)
        .select('id')
        .single();

      if (sentStampError || !stamped) {
        emailLogger.error(
          {
            reportId: report.id,
            error: sentStampError?.message ?? 'claim changed before success stamp',
          },
          '[outcome-followup] Email sent but success stamp failed; lease will expire safely'
        );
        errors++;
      } else {
        sent++;
      }
    } catch (error) {
      const releaseError = await releaseClaim(supabase, report.id, claimedAt);
      const message = error instanceof Error ? error.message : String(error);
      emailLogger.error(
        { reportId: report.id, message, releaseError },
        '[outcome-followup] Unexpected processing error'
      );
      errors++;
    }
  }

  emailLogger.info({ sent, errors }, '[outcome-followup] Follow-up batch complete');
  return { sent, errors };
}
