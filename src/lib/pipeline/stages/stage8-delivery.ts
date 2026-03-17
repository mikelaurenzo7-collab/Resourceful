// ─── Stage 8: Client Delivery (Admin-Triggered) ─────────────────────────────
// NOT part of the automated pipeline. Called when admin clicks "Approve and
// Send." Generates a signed 7-day Supabase Storage URL, sends client email
// via Resend, records approval/delivery timestamps, and sets status to
// 'delivered'.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData, ReportNarrative } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { sendReportDeliveryEmail } from '@/lib/services/resend-email';

// ─── Constants ──────────────────────────────────────────────────────────────

const SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Deliver the approved report to the client. This is admin-triggered,
 * not part of the automated pipeline stages 1-7.
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

  const deliverableStatuses = ['pending_approval', 'approved'];
  if (!deliverableStatuses.includes(report.status)) {
    return {
      success: false,
      error: `Report status is '${report.status}' — must be pending_approval or approved to deliver`,
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

  // ── Generate signed URL (7-day expiry) ────────────────────────────────
  const { data: signedUrlData, error: signedUrlError } = await supabase
    .storage
    .from('reports')
    .createSignedUrl(report.report_pdf_storage_path, SIGNED_URL_EXPIRY_SECONDS);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return {
      success: false,
      error: `Failed to create signed URL: ${signedUrlError?.message ?? 'unknown'}`,
    };
  }

  // ── Fetch property data for values ────────────────────────────────────
  const { data: pdData } = await supabase
    .from('property_data')
    .select('*')
    .eq('report_id', reportId)
    .single();
  const propertyData = pdData as PropertyData | null;

  // ── Fetch filing guide for email ──────────────────────────────────────
  const { data: filingGuideData } = await supabase
    .from('report_narratives')
    .select('content')
    .eq('report_id', reportId)
    .eq('section_name', 'pro_se_filing_guide')
    .single();
  const filingGuide = filingGuideData as Pick<ReportNarrative, 'content'> | null;

  // ── Calculate values ──────────────────────────────────────────────────
  const assessedValue = propertyData?.assessed_value ?? 0;

  // Derive concluded value from comps
  const { data: compsData } = await supabase
    .from('comparable_sales')
    .select('adjusted_price_per_sqft, sale_price')
    .eq('report_id', reportId);
  const comps = (compsData ?? []) as Pick<import('@/types/database').ComparableSale, 'adjusted_price_per_sqft' | 'sale_price'>[];

  let concludedValue = 0;
  if (comps.length > 0 && propertyData?.building_sqft_gross) {
    const adjustedPrices = comps
      .map((c) => c.adjusted_price_per_sqft)
      .filter((p): p is number => p != null && p > 0)
      .sort((a, b) => a - b);

    if (adjustedPrices.length > 0) {
      const mid = Math.floor(adjustedPrices.length / 2);
      const median = adjustedPrices.length % 2 === 0
        ? (adjustedPrices[mid - 1] + adjustedPrices[mid]) / 2
        : adjustedPrices[mid];
      concludedValue = Math.round((median * propertyData.building_sqft_gross) / 1000) * 1000;
    }
  }

  const potentialSavings = Math.max(0, assessedValue - concludedValue);

  const propertyAddress = [
    report.property_address,
    report.city,
    report.state,
  ].filter(Boolean).join(', ');

  // ── Send client email ─────────────────────────────────────────────────
  console.log(`[stage8] Sending report delivery email to ${clientEmail}`);
  const emailResult = await sendReportDeliveryEmail({
    to: clientEmail,
    reportId,
    propertyAddress,
    concludedValue,
    assessedValue,
    potentialSavings,
    pdfUrl: signedUrlData.signedUrl,
    filingGuide: filingGuide?.content ?? '',
  });

  if (emailResult.error) {
    return { success: false, error: `Email delivery failed: ${emailResult.error}` };
  }

  // ── Record approval and delivery ──────────────────────────────────────
  const now = new Date().toISOString();

  // Update report status
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
    // Email was already sent — log but report as failure so admin can investigate
    console.error(`[stage8] CRITICAL: Email sent but report status update failed: ${statusUpdateError.message}`);
    return { success: false, error: `Report status update failed after email delivery: ${statusUpdateError.message}` };
  }

  // Record approval event (non-fatal — audit trail entry)
  const { error: approvalInsertError } = await supabase
    .from('approval_events')
    .insert({
      report_id: reportId,
      admin_user_id: adminUserId,
      action: 'approved',
      section_name: null,
      notes: 'Report approved and delivered to client',
    });

  if (approvalInsertError) {
    console.warn(`[stage8] Failed to record approval event: ${approvalInsertError.message}`);
  }

  console.log(
    `[stage8] Report ${reportId} delivered to ${clientEmail}. Email ID: ${emailResult.data?.id}`
  );

  return { success: true };
}
