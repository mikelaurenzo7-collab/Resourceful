// ─── Stage 8: Client Delivery (Admin-Triggered) ─────────────────────────────
// NOT part of the automated pipeline. Called when admin clicks "Approve and
// Send." Generates a signed 7-day Supabase Storage URL, sends client email
// via Resend, records approval/delivery timestamps, and sets status to
// 'delivered'.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData, ReportNarrative } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { sendReportDeliveryEmail, type ReportDeliveryParams, type EmailResult, type ServiceResult } from '@/lib/services/resend-email';

// ─── Constants ──────────────────────────────────────────────────────────────

const SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Send delivery email with exponential backoff retry.
 * Report is already marked 'delivered' before this is called, so failure
 * is non-fatal — admin can trigger a manual resend from the dashboard.
 */
async function sendWithRetry(
  params: ReportDeliveryParams,
  maxAttempts = 3
): Promise<ServiceResult<EmailResult>> {
  const delays = [2000, 4000, 8000];
  let lastResult: ServiceResult<EmailResult> = { data: null, error: 'No attempts made' };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastResult = await sendReportDeliveryEmail(params);
    if (!lastResult.error) return lastResult;

    if (attempt < maxAttempts - 1) {
      console.warn(
        `[stage8] Email attempt ${attempt + 1}/${maxAttempts} failed (${lastResult.error}), retrying in ${delays[attempt]}ms`
      );
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }

  console.error(`[stage8] All ${maxAttempts} email attempts failed: ${lastResult.error}`);
  return lastResult;
}

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

  const deliverableStatuses = ['processing', 'pending_approval', 'approved'];
  if (!deliverableStatuses.includes(report.status)) {
    return {
      success: false,
      error: `Report status is '${report.status}' — must be processing, pending_approval, or approved to deliver`,
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

  // ── Fetch action guide narrative (content varies by service type) ─────
  // tax_appeal → pro_se_filing_guide
  // pre_purchase → buyer_action_guide
  // pre_listing → listing_strategy_guide
  const serviceType = report.service_type ?? 'tax_appeal';
  const actionGuideSectionName =
    serviceType === 'pre_purchase' ? 'buyer_action_guide' :
    serviceType === 'pre_listing' ? 'listing_strategy_guide' :
    'pro_se_filing_guide';

  const { data: filingGuideData } = await supabase
    .from('report_narratives')
    .select('content')
    .eq('report_id', reportId)
    .eq('section_name', actionGuideSectionName)
    .single();
  const filingGuide = filingGuideData as Pick<ReportNarrative, 'content'> | null;

  // ── Calculate values ──────────────────────────────────────────────────
  const assessedValue = propertyData?.assessed_value ?? 0;

  // Derive concluded value from comps (median adjusted $/sqft × GLA)
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

  // For pre_purchase: the email shows "list price vs independent value".
  // We use ATTOM's market_value_estimate_high as a proxy for the asking price
  // since we don't yet persist the client-submitted list price.
  // For tax_appeal and pre_listing: assessedValue retains its standard meaning.
  const emailAssessedValue =
    serviceType === 'pre_purchase'
      ? (propertyData?.market_value_estimate_high ?? assessedValue)
      : assessedValue;

  const potentialSavings = Math.max(0, emailAssessedValue - concludedValue);

  const propertyAddress = [
    report.property_address,
    report.city,
    report.state,
  ].filter(Boolean).join(', ');

  // ── Mark as delivered FIRST, then send email ─────────────────────────
  // Update status before sending email so that if the email step fails,
  // the report is still marked delivered and the admin can resend manually.
  // The reverse order risks sending the email but leaving status=pending_approval,
  // causing the admin to resend and the client to receive a duplicate.
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
    return { success: false, error: `Report status update failed: ${statusUpdateError.message}` };
  }

  // ── Send client email (with retry) ───────────────────────────────────
  console.log(`[stage8] Sending ${serviceType} delivery email to ${clientEmail}`);
  const emailResult = await sendWithRetry({
    to: clientEmail,
    reportId,
    serviceType,
    propertyAddress,
    concludedValue,
    assessedValue: emailAssessedValue,
    potentialSavings,
    pdfUrl: signedUrlData.signedUrl,
    filingGuide: filingGuide?.content ?? '',
  });

  if (emailResult.error) {
    // Report is already marked delivered — log the failure but don't return an error.
    // Admin can trigger a re-send from the dashboard; client can also access via direct link.
    console.error(`[stage8] Email delivery failed for report ${reportId}: ${emailResult.error}`);
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
