// ─── Outcome Follow-Up Service ───────────────────────────────────────────────
// Sends "How did your appeal go?" emails to customers ~60 days after report
// delivery. Responses feed the calibration system, which is how our platform
// learns and improves over time.
//
// This is a critical business loop:
// 1. Customer gets report → files appeal
// 2. 60 days later: "How did it go?"
// 3. Customer reports outcome → calibration entry created
// 4. Platform adjusts for that county/property type
// 5. Next customer in that county gets a more accurate report
//
// Even 20-30% response rate gives enough data to calibrate by county.

import { createAdminClient } from '@/lib/supabase/admin';
import { sendOutcomeFollowupEmail } from '@/lib/services/resend-email';
import type { Report, PropertyData } from '@/types/database';
import { randomUUID } from 'crypto';

const FOLLOWUP_DELAY_DAYS = 60;

/**
 * Find delivered tax_appeal reports that need outcome follow-up emails
 * and send them. Called by weekly cron.
 */
export async function sendOutcomeFollowups(): Promise<{ sent: number; errors: number }> {
  const supabase = createAdminClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - FOLLOWUP_DELAY_DAYS);

  // Find delivered tax_appeal reports where:
  // - Delivered more than 60 days ago
  // - No outcome recorded yet
  // - No follow-up email sent yet
  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, client_email, client_name, property_address, city, state, county, county_fips')
    .eq('status', 'delivered')
    .eq('service_type', 'tax_appeal')
    .is('outcome_reported_at', null)
    .is('outcome_followup_sent_at', null)
    .lte('delivered_at', cutoffDate.toISOString())
    .limit(50); // Process in batches to avoid timeouts

  if (error) {
    console.error('[outcome-followup] Query error:', error.message);
    return { sent: 0, errors: 1 };
  }

  if (!reports || reports.length === 0) {
    console.log('[outcome-followup] No reports due for follow-up');
    return { sent: 0, errors: 0 };
  }

  console.log(`[outcome-followup] ${reports.length} reports due for follow-up`);

  let sent = 0;
  let errors = 0;

  for (const rawReport of reports) {
    const report = rawReport as Pick<Report, 'id' | 'client_email' | 'client_name' | 'property_address' | 'city' | 'state' | 'county' | 'county_fips'>;

    if (!report.client_email) {
      continue;
    }

    try {
      // Generate unique token for unauthenticated outcome submission
      const token = randomUUID();

      // Fetch concluded value for context in the email
      const { data: pdData } = await supabase
        .from('property_data')
        .select('assessed_value, concluded_value')
        .eq('report_id', report.id)
        .single();
      const propertyData = pdData as Pick<PropertyData, 'assessed_value' | 'concluded_value'> | null;

      const potentialSavings = (propertyData?.assessed_value && propertyData?.concluded_value)
        ? Math.max(0, propertyData.assessed_value - propertyData.concluded_value)
        : 0;

      // Save token before sending email
      await supabase
        .from('reports')
        .update({
          outcome_followup_token: token,
          outcome_followup_sent_at: new Date().toISOString(),
        })
        .eq('id', report.id);

      // Send the follow-up email
      const propertyAddress = [report.property_address, report.city, report.state]
        .filter(Boolean).join(', ');

      const result = await sendOutcomeFollowupEmail({
        to: report.client_email,
        clientName: report.client_name,
        reportId: report.id,
        propertyAddress,
        potentialSavings,
        outcomeToken: token,
      });

      if (result.error) {
        errors++;
        console.error(`[outcome-followup] Email failed for ${report.id}: ${result.error}`);
      } else {
        sent++;
        console.log(`[outcome-followup] Sent follow-up to ${report.client_email} for ${report.property_address}`);
      }
    } catch (err) {
      errors++;
      console.error(`[outcome-followup] Error processing ${report.id}:`, err);
    }
  }

  console.log(`[outcome-followup] Complete: ${sent} sent, ${errors} errors`);
  return { sent, errors };
}
