// ─── Stage 8: Client Delivery (Admin-Triggered) ─────────────────────────────
// Dashboard-first delivery model:
// - Report is ALWAYS accessible from the user's dashboard and /report/[id] page
// - PDF downloads generate fresh signed URLs on-demand (no expiry concerns)
// - Email is an optional NOTIFICATION (not the delivery mechanism)
// - User can opt out of email via email_delivery_preference flag
//
// This approach eliminates 7-day expiring links, creates dashboard stickiness,
// and enables outcome collection for the calibration feedback loop.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { sendReportReadyNotification } from '@/lib/services/resend-email';
import { subscribeToReminders } from '@/lib/services/reminder-service';
import { pipelineLogger } from '@/lib/logger';

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Deliver the approved report to the client. This is admin-triggered,
 * not part of the automated pipeline stages 1-7.
 *
 * With dashboard-first delivery:
 * 1. Always marks report as 'delivered' (accessible on dashboard)
 * 2. Sends email notification only if user opted in (default: yes)
 * 3. Subscribes user to annual assessment reminders
 *
 * @param reportId - UUID of the report to deliver
 * @param adminUserId - UUID of the admin approving/sending
 * @param supabase - Admin Supabase client
 */
export async function runDelivery(
  reportId: string,
  adminUserId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch report ──────────────────────────────────────────────────────
  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();
  const report = reportData as Report | null;

  if (reportError || !report) {
    return { success: false, error: `Failed to fetch report: ${reportError?.message}` };
  }

  const deliverableStatuses = ['processing', 'pending_approval', 'approved', 'delivering'];
  if (!deliverableStatuses.includes(report.status)) {
    return {
      success: false,
      error: `Report status is '${report.status}' — must be processing, pending_approval, approved, or delivering to deliver`,
    };
  }

  if (!report.report_pdf_storage_path) {
    return { success: false, error: 'No PDF storage path found on report. Run PDF assembly first.' };
  }

  // ── Get client email from report (no auth account required) ──────────
  const clientEmail = report.client_email;
  if (!clientEmail) {
    return { success: false, error: 'No client email found on report' };
  }

  // ── Record approval and update status BEFORE sending email ────────────
  // Dashboard-first: the report is now accessible regardless of email success.
  // This prevents duplicate emails: if the email sends but status update fails,
  // the report stays 'pending_approval' and admin sends again. By updating
  // status first, we guarantee idempotent delivery.
  const now = new Date().toISOString();

  const { error: statusUpdateError } = await supabase
    .from('reports')
    .update({
      status: 'delivered',
      delivered_at: now,
      approved_at: now,
      approved_by: adminUserId,
    })
    .eq('id', reportId);

  if (statusUpdateError) {
    return { success: false, error: `Failed to update report status: ${statusUpdateError.message}` };
  }

  // NOTE: Approval event is recorded by the caller (approve route), not here.
  // This prevents duplicate approval_events when delivery is triggered via
  // the admin approve API.

  // ── Subscribe to annual assessment reminders (non-blocking) ──────────
  try {
    await subscribeToReminders(reportId);
  } catch (err) {
    pipelineLogger.warn({ err: err }, `Failed to subscribe to reminders`);
  }

  // ── Send email notification (if user opted in) ────────────────────────
  // Dashboard-first: the report is already accessible on dashboard.
  // Email is a convenience notification, not the delivery mechanism.
  if (report.email_delivery_preference !== false) {
    // Fetch property data for email context
    const { data: pdData } = await supabase
      .from('property_data')
      .select('assessed_value, concluded_value')
      .eq('report_id', reportId)
      .single();
    const propertyData = pdData as Pick<PropertyData, 'assessed_value' | 'concluded_value'> | null;

    const assessedValue = propertyData?.assessed_value ?? 0;
    const concludedValue = propertyData?.concluded_value ?? 0;
    const potentialSavings = Math.max(0, assessedValue - concludedValue);

    const propertyAddress = [
      report.property_address,
      report.city,
      report.state,
    ].filter(Boolean).join(', ');

    // Fetch county name for email context
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

    pipelineLogger.info(`[stage8] Sending report-ready notification to ${clientEmail}`);
    const emailResult = await sendReportReadyNotification({
      to: clientEmail,
      reportId,
      propertyAddress,
      concludedValue,
      assessedValue,
      potentialSavings,
      countyName,
    });

    if (emailResult.error) {
      // Dashboard-first: report is already delivered and accessible.
      // Email failure is non-fatal — log it but don't roll back.
      // The notification-retry cron will pick this up (notification_sent_at stays null).
      pipelineLogger.error(
        `[stage8] Notification email failed for report ${reportId} (report still delivered via dashboard): ${emailResult.error}`
      );
    } else {
      // Stamp successful notification — prevents retry cron from re-sending
      await supabase
        .from('reports')
        .update({ notification_sent_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', reportId);
      pipelineLogger.info(
        `[stage8] Report ${reportId} delivered. Notification sent to ${clientEmail}. Email ID: ${emailResult.data?.id}`
      );
    }
  } else {
    pipelineLogger.info(`[stage8] Report ${reportId} delivered (email notification opted out by user)`);
  }

  return { success: true };
}
