// ─── Stage 8: Client Delivery (Admin-Triggered) ─────────────────────────────
// Dashboard-first delivery model:
// - Report is always accessible from the user's dashboard and /report/[id] page
// - PDF downloads generate fresh signed URLs on-demand
// - Email is an optional notification, not the delivery mechanism
// - Delivery requires a verified immutable PDF/manifest pair

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData } from '@/types/database';
import type { StageResult } from '../orchestrator';
import {
  manifestPathForPdf,
  verifyReportArtifact,
} from '@/lib/pdf/report-artifact-verification';
import { sendReportReadyNotification } from '@/lib/services/resend-email';
import { subscribeToReminders } from '@/lib/services/reminder-service';
import { calculateAssessmentGap } from '@/lib/valuation/assessment-gap';
import { pipelineLogger } from '@/lib/logger';

const DELIVERABLE_STATUSES: Report['status'][] = ['approved', 'delivering'];

async function verifyStoredReportArtifact(
  report: Report,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  const pdfPath = report.report_pdf_storage_path;
  if (!pdfPath) {
    return { success: false, error: 'No PDF storage path found on report. Run PDF assembly first.' };
  }

  let manifestPath: string;
  try {
    manifestPath = manifestPathForPdf(pdfPath);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const [pdfDownload, manifestDownload] = await Promise.all([
    supabase.storage.from('reports').download(pdfPath),
    supabase.storage.from('reports').download(manifestPath),
  ]);

  if (pdfDownload.error || !pdfDownload.data) {
    return {
      success: false,
      error: `Approved PDF artifact is unavailable: ${pdfDownload.error?.message ?? 'missing object'}`,
    };
  }
  if (manifestDownload.error || !manifestDownload.data) {
    return {
      success: false,
      error: `Approved PDF manifest is unavailable: ${manifestDownload.error?.message ?? 'missing object'}`,
    };
  }

  const pdfBuffer = Buffer.from(await pdfDownload.data.arrayBuffer());
  const manifestJson = await manifestDownload.data.text();
  const verification = verifyReportArtifact({
    reportId: report.id,
    serviceType: report.service_type,
    propertyType: report.property_type,
    reviewTier: report.review_tier,
    pdfPath,
    pdfBuffer,
    manifestJson,
  });

  if (!verification.verified) {
    return {
      success: false,
      error: `Approved report artifact verification failed (${verification.code}): ${verification.message}`,
    };
  }

  return { success: true };
}

/**
 * Deliver an approved report to the client. The approval route atomically claims
 * pending_approval reports as delivering before calling this function.
 */
export async function runDelivery(
  reportId: string,
  adminUserId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();
  const report = reportData as Report | null;

  if (reportError || !report) {
    return { success: false, error: `Failed to fetch report: ${reportError?.message ?? 'not found'}` };
  }

  if (!DELIVERABLE_STATUSES.includes(report.status)) {
    return {
      success: false,
      error: `Report status is '${report.status}' — must be approved or delivering to deliver`,
    };
  }

  const artifactVerification = await verifyStoredReportArtifact(report, supabase);
  if (!artifactVerification.success) return artifactVerification;

  if (!report.client_email) {
    return { success: false, error: 'No client email found on report' };
  }

  const now = new Date().toISOString();
  const { data: deliveredReport, error: statusUpdateError } = await supabase
    .from('reports')
    .update({
      status: 'delivered',
      delivered_at: now,
      approved_at: now,
      approved_by: adminUserId,
    })
    .eq('id', reportId)
    .in('status', DELIVERABLE_STATUSES)
    .select('id')
    .single();

  if (statusUpdateError || !deliveredReport) {
    return {
      success: false,
      error: `Failed to atomically mark report delivered: ${statusUpdateError?.message ?? 'status changed concurrently'}`,
    };
  }

  if (report.service_type === 'tax_appeal') {
    try {
      await subscribeToReminders(reportId);
    } catch (error) {
      pipelineLogger.warn(
        { reportId, error: error instanceof Error ? error.message : String(error) },
        '[stage8] Failed to subscribe tax-appeal report to reminders'
      );
    }
  }

  if (report.email_delivery_preference !== false) {
    const { data: propertyDataRaw } = await supabase
      .from('property_data')
      .select('assessed_value, concluded_value, assessment_ratio')
      .eq('report_id', reportId)
      .single();
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

    const emailResult = await sendReportReadyNotification({
      to: report.client_email,
      reportId,
      serviceType: report.service_type,
      propertyAddress,
      concludedMarketValue: propertyData?.concluded_value ?? null,
      currentAssessedValue: assessmentGap?.currentAssessedValue ?? null,
      indicatedAssessedValue: assessmentGap?.indicatedAssessedValue ?? null,
      assessmentGap: assessmentGap?.assessmentGap ?? null,
      countyName,
    });

    if (emailResult.error) {
      pipelineLogger.error(
        { reportId, error: emailResult.error },
        '[stage8] Notification email failed; dashboard delivery remains available'
      );
    } else {
      const { error: notificationStampError } = await supabase
        .from('reports')
        .update({ notification_sent_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', reportId)
        .eq('status', 'delivered');

      if (notificationStampError) {
        pipelineLogger.error(
          { reportId, error: notificationStampError.message },
          '[stage8] Notification sent but success stamp failed'
        );
      } else {
        pipelineLogger.info(
          { reportId, emailId: emailResult.data?.id },
          '[stage8] Report delivered with notification'
        );
      }
    }
  } else {
    pipelineLogger.info(
      { reportId },
      '[stage8] Report delivered; email notification was declined by the customer'
    );
  }

  return { success: true };
}
