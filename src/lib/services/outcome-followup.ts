// ─── Outcome Follow-Up Service ───────────────────────────────────────────────
// Sends outcome requests after delivery. Successful responses feed the county
// calibration loop; failed email attempts remain retryable with the same token.

import { randomUUID } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendVerifiedOutcomeFollowupEmail } from '@/lib/services/customer-notification-email';
import { calculateAssessmentGap } from '@/lib/valuation/assessment-gap';
import type { Report, PropertyData } from '@/types/database';
import { emailLogger } from '@/lib/logger';

const FOLLOWUP_DELAY_DAYS = 60;

type FollowupReport = Pick<
  Report,
  | 'id'
  | 'client_email'
  | 'client_name'
  | 'property_address'
  | 'city'
  | 'state'
  | 'outcome_followup_token'
>;

export async function sendOutcomeFollowups(): Promise<{ sent: number; errors: number }> {
  const supabase = createAdminClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - FOLLOWUP_DELAY_DAYS);

  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, client_email, client_name, property_address, city, state, outcome_followup_token')
    .eq('status', 'delivered')
    .eq('service_type', 'tax_appeal')
    .is('outcome_reported_at', null)
    .is('outcome_followup_sent_at', null)
    .lte('delivered_at', cutoffDate.toISOString())
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
    const report = rawReport as FollowupReport;
    if (!report.client_email) continue;

    try {
      const token = report.outcome_followup_token?.trim() || randomUUID();

      if (!report.outcome_followup_token) {
        const { error: tokenError } = await supabase
          .from('reports')
          .update({ outcome_followup_token: token })
          .eq('id', report.id)
          .is('outcome_reported_at', null)
          .is('outcome_followup_sent_at', null);

        if (tokenError) {
          emailLogger.error(
            { reportId: report.id, error: tokenError.message },
            '[outcome-followup] Failed to persist outcome token'
          );
          errors++;
          continue;
        }
      }

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
        emailLogger.error(
          { reportId: report.id, error: result.error },
          '[outcome-followup] Email failed and remains eligible for retry'
        );
        errors++;
        continue;
      }

      const { error: sentStampError } = await supabase
        .from('reports')
        .update({ outcome_followup_sent_at: new Date().toISOString() })
        .eq('id', report.id)
        .eq('outcome_followup_token', token)
        .is('outcome_reported_at', null)
        .is('outcome_followup_sent_at', null);

      if (sentStampError) {
        emailLogger.error(
          { reportId: report.id, error: sentStampError.message },
          '[outcome-followup] Email sent but success stamp failed'
        );
        errors++;
      } else {
        sent++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emailLogger.error(
        { reportId: report.id, message },
        '[outcome-followup] Unexpected processing error'
      );
      errors++;
    }
  }

  emailLogger.info({ sent, errors }, '[outcome-followup] Follow-up batch complete');
  return { sent, errors };
}
