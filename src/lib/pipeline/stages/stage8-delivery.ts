// ─── Stage 8: Client Delivery (Admin-Triggered) ─────────────────────────────
// NOT part of the automated pipeline. Called when admin clicks "Approve and
// Send." Generates a signed 7-day Supabase Storage URL, sends client email
// via Resend, records approval/delivery timestamps, and sets status to
// 'delivered'.
//
// Tier-aware delivery:
//   auto             → Report + filing guide email
//   expert_reviewed  → Same (expert review happened pre-approval)
//   guided_filing    → Report + filing guide + guided session booking prompt
//   full_representation → Report + confirmation that team filed on their behalf

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData, ReportNarrative, ReviewTier } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { sendReportDeliveryEmail } from '@/lib/services/resend-email';
import { calculateConcludedValue, buildPropertyAddress, DELIVERABLE_STATUSES } from '@/lib/utils/valuation-math';

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

  if (!DELIVERABLE_STATUSES.includes(report.status)) {
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

  // ── Fetch filing guide and hearing prep for email ─────────────────────
  const [filingGuideRes, hearingPrepRes] = await Promise.all([
    supabase
      .from('report_narratives')
      .select('content')
      .eq('report_id', reportId)
      .eq('section_name', 'pro_se_filing_guide')
      .single(),
    supabase
      .from('report_narratives')
      .select('content')
      .eq('report_id', reportId)
      .eq('section_name', 'hearing_prep_guide')
      .single(),
  ]);
  const filingGuide = filingGuideRes.data as Pick<ReportNarrative, 'content'> | null;
  const hearingPrep = hearingPrepRes.data as Pick<ReportNarrative, 'content'> | null;

  // ── Calculate values (shared utility) ─────────────────────────────────
  const assessedValue = propertyData?.assessed_value ?? 0;

  const { data: compsData } = await supabase
    .from('comparable_sales')
    .select('adjusted_price_per_sqft, sale_price')
    .eq('report_id', reportId);
  const comps = (compsData ?? []) as Pick<import('@/types/database').ComparableSale, 'adjusted_price_per_sqft' | 'sale_price'>[];

  const concludedValue = calculateConcludedValue({
    comps,
    buildingSqft: propertyData?.building_sqft_gross ?? null,
  });

  const potentialSavings = Math.max(0, assessedValue - concludedValue);
  const propertyAddress = buildPropertyAddress(report.property_address, report.city, report.state);

  // ── Send client email ─────────────────────────────────────────────────
  const reviewTier = (report.review_tier as ReviewTier) ?? 'auto';
  console.log(`[stage8] Sending report delivery email to ${clientEmail} (tier: ${reviewTier})`);
  const emailResult = await sendReportDeliveryEmail({
    to: clientEmail,
    reportId,
    propertyAddress,
    concludedValue,
    assessedValue,
    potentialSavings,
    pdfUrl: signedUrlData.signedUrl,
    filingGuide: filingGuide?.content ?? '',
    reviewTier,
    hasHearingPrep: !!hearingPrep?.content,
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
