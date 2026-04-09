// ─── Notification Retry Service ──────────────────────────────────────────────
// Retries delivery notification emails that failed during Stage 8.
//
// The dashboard-first model means the report is always accessible, but
// if the email fails, the user may not know it's ready. This service
// catches those cases and retries within a 3-day window.
//
// Called by hourly cron — fast, lightweight, idempotent.

import { createAdminClient } from '@/lib/supabase/admin';
import { sendReportReadyNotification } from '@/lib/services/resend-email';
import type { Report, PropertyData } from '@/types/database';
import { emailLogger } from '@/lib/logger';

/** Only retry within 3 days of delivery — after that, assume user found it via dashboard */
const RETRY_WINDOW_DAYS = 3;

/**
 * Find delivered reports that were never successfully notified and retry.
 */
export async function retryFailedNotifications(): Promise<{ sent: number; errors: number }> {
  const supabase = createAdminClient();

  // Only retry recent deliveries (within window)
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - RETRY_WINDOW_DAYS);

  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, client_email, property_address, city, state, county, county_fips')
    .eq('status', 'delivered')
    .eq('email_delivery_preference', true)
    .is('notification_sent_at' as string, null)
    .gte('delivered_at', windowStart.toISOString())
    .limit(20);

  if (error) {
    emailLogger.error({ err: error.message }, 'Query error');
    return { sent: 0, errors: 1 };
  }

  if (!reports || reports.length === 0) {
    return { sent: 0, errors: 0 };
  }

  emailLogger.info(`[notification-retry] Found ${reports.length} reports needing notification retry`);

  let sent = 0;
  let errors = 0;

  for (const report of reports as Report[]) {
    try {
      // Fetch property data for email context
      const { data: pd } = await supabase
        .from('property_data')
        .select('assessed_value, concluded_value')
        .eq('report_id', report.id)
        .single();

      const propertyData = pd as Pick<PropertyData, 'assessed_value' | 'concluded_value'> | null;
      const assessedValue = propertyData?.assessed_value ?? 0;
      const concludedValue = propertyData?.concluded_value ?? 0;
      const potentialSavings = Math.max(0, assessedValue - concludedValue);

      const propertyAddress = [
        report.property_address,
        report.city,
        report.state,
      ].filter(Boolean).join(', ');

      // Fetch county name
      let countyName: string | null = report.county ?? null;
      if (report.county_fips) {
        const { data: cr } = await supabase
          .from('county_rules')
          .select('county_name')
          .eq('county_fips', report.county_fips)
          .limit(1);
        if (cr?.[0]) {
          countyName = (cr[0] as { county_name: string }).county_name ?? countyName;
        }
      }

      const result = await sendReportReadyNotification({
        to: report.client_email!,
        reportId: report.id,
        propertyAddress,
        concludedValue,
        assessedValue,
        potentialSavings,
        countyName,
      });

      if (result.error) {
        emailLogger.error(`[notification-retry] Failed for ${report.id}: ${result.error}`);
        errors++;
      } else {
        // Stamp success — won't be retried again
        await supabase
          .from('reports')
          .update({ notification_sent_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('id', report.id);

        emailLogger.info(`[notification-retry] Sent for report ${report.id}`);
        sent++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emailLogger.error(`[notification-retry] Error for ${report.id}: ${message}`);
      errors++;
    }
  }

  emailLogger.info(`[notification-retry] Complete: ${sent} sent, ${errors} errors`);
  return { sent, errors };
}
