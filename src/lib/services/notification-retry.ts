// ─── Notification Retry Service ──────────────────────────────────────────────
// Retries delivery notification emails that failed during Stage 8.

import { releaseKeyForPdfPath } from '@/lib/pdf/report-artifact-verification';
import { sendVerifiedReportReadyNotification } from '@/lib/services/customer-notification-email';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateAssessmentGap } from '@/lib/valuation/assessment-gap';
import type { Report, PropertyData } from '@/types/database';
import { emailLogger } from '@/lib/logger';

const RETRY_WINDOW_DAYS = 3;

type RetryReport = Pick<
  Report,
  | 'id'
  | 'client_email'
  | 'service_type'
  | 'property_address'
  | 'city'
  | 'state'
  | 'county'
  | 'county_fips'
  | 'report_pdf_storage_path'
>;

export async function retryFailedNotifications(): Promise<{ sent: number; errors: number }> {
  const supabase = createAdminClient();
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - RETRY_WINDOW_DAYS);

  const { data: reports, error } = await supabase
    .from('reports')
    .select(
      'id, client_email, service_type, property_address, city, state, county, county_fips, report_pdf_storage_path'
    )
    .eq('status', 'delivered')
    .eq('email_delivery_preference', true)
    .is('notification_sent_at' as string, null)
    .gte('delivered_at', windowStart.toISOString())
    .limit(20);

  if (error) {
    emailLogger.error({ error: error.message }, '[notification-retry] Query failed');
    return { sent: 0, errors: 1 };
  }

  if (!reports || reports.length === 0) {
    return { sent: 0, errors: 0 };
  }

  emailLogger.info(
    { count: reports.length },
    '[notification-retry] Found reports needing notification retry'
  );

  let sent = 0;
  let errors = 0;

  for (const rawReport of reports) {
    const report = rawReport as RetryReport;
    if (!report.client_email) continue;

    let artifactReleaseKey: string;
    try {
      if (!report.report_pdf_storage_path) {
        throw new Error('Delivered report has no immutable PDF storage path');
      }
      artifactReleaseKey = releaseKeyForPdfPath(report.report_pdf_storage_path);
    } catch (artifactError) {
      emailLogger.error(
        {
          reportId: report.id,
          error: artifactError instanceof Error ? artifactError.message : String(artifactError),
        },
        '[notification-retry] Cannot identify the delivered artifact release'
      );
      errors++;
      continue;
    }

    try {
      const { data: propertyDataRaw, error: propertyError } = await supabase
        .from('property_data')
        .select('assessed_value, concluded_value, assessment_ratio')
        .eq('report_id', report.id)
        .single();

      if (propertyError) {
        emailLogger.warn(
          { reportId: report.id, error: propertyError.message },
          '[notification-retry] Property metrics unavailable; sending report-ready notice without valuation rows'
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

      let countyName: string | null = report.county ?? null;
      if (report.county_fips) {
        const { data: countyRules } = await supabase
          .from('county_rules')
          .select('county_name')
          .eq('county_fips', report.county_fips)
          .limit(1);
        if (countyRules?.[0]) {
          countyName = (countyRules[0] as { county_name: string }).county_name ?? countyName;
        }
      }

      const result = await sendVerifiedReportReadyNotification({
        to: report.client_email,
        reportId: report.id,
        artifactReleaseKey,
        serviceType: report.service_type,
        propertyAddress,
        concludedMarketValue: propertyData?.concluded_value ?? null,
        currentAssessedValue: assessmentGap?.currentAssessedValue ?? null,
        indicatedAssessedValue: assessmentGap?.indicatedAssessedValue ?? null,
        assessmentGap: assessmentGap?.assessmentGap ?? null,
        countyName,
      });

      if (result.error) {
        emailLogger.error(
          { reportId: report.id, artifactReleaseKey, error: result.error },
          '[notification-retry] Notification retry failed'
        );
        errors++;
        continue;
      }

      const { error: stampError } = await supabase
        .from('reports')
        .update({ notification_sent_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', report.id)
        .eq('status', 'delivered')
        .is('notification_sent_at' as string, null);

      if (stampError) {
        emailLogger.error(
          { reportId: report.id, artifactReleaseKey, error: stampError.message },
          '[notification-retry] Email sent but success stamp failed'
        );
        errors++;
      } else {
        sent++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emailLogger.error(
        { reportId: report.id, artifactReleaseKey, message },
        '[notification-retry] Unexpected retry error'
      );
      errors++;
    }
  }

  emailLogger.info({ sent, errors }, '[notification-retry] Retry batch complete');
  return { sent, errors };
}
