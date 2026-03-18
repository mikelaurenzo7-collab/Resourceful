// ─── GET /api/reports/[id]/viewer ─────────────────────────────────────────────
// Returns report data for the in-app viewer. Includes PDF URL, filing guide,
// property data, and county filing info — everything the user needs in one call.
// No auth required — keyed by report UUID (unguessable).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit } from '@/lib/rate-limit';
import type { Report, PropertyData, CountyRule, ReportNarrative } from '@/types/database';
import { computeDeadlineInfo } from '@/lib/services/county-deadlines';

const SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const rateLimited = await applyRateLimit(_req, { prefix: 'report-viewer', limit: 60, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  const { id: reportId } = await params;

  if (!reportId) {
    return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch report
  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (reportError || !reportData) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const report = reportData as Report;

  // ── Optional auth: if user is logged in, verify they own this report ────
  // Non-authenticated access allowed (UUID is cryptographically unguessable),
  // but authenticated users must be the report owner to prevent cross-account access.
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (user?.email && report.client_email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Not authorized to view this report' }, { status: 403 });
  }

  // Only show reports that have been delivered or approved — never pending_approval
  // (admin must approve before client can see the report)
  if (!['delivered', 'approved'].includes(report.status)) {
    return NextResponse.json({
      status: report.status,
      ready: false,
      message: 'Your report is still being generated. Check back shortly.',
    });
  }

  // Fetch in parallel: property data, filing guide, county rules, PDF URL
  const [propertyResult, filingGuideResult, countyResult] = await Promise.all([
    supabase.from('property_data').select('*').eq('report_id', reportId).single(),
    supabase.from('report_narratives').select('content').eq('report_id', reportId).eq('section_name', 'pro_se_filing_guide').single(),
    report.county_fips
      ? supabase.from('county_rules').select('*').eq('county_fips', report.county_fips).single()
      : report.county && report.state
        ? supabase.from('county_rules').select('*').eq('county_name', report.county).eq('state_abbreviation', report.state).single()
        : Promise.resolve({ data: null, error: null }),
  ]);

  const propertyData = propertyResult.data as PropertyData | null;
  const filingGuide = (filingGuideResult.data as Pick<ReportNarrative, 'content'> | null)?.content ?? null;
  const countyRule = countyResult.data as CountyRule | null;

  const concludedValue = propertyData?.concluded_value ?? 0;

  // Generate signed PDF URL
  let pdfUrl: string | null = null;
  if (report.report_pdf_storage_path) {
    const { data: signedUrlData } = await supabase
      .storage
      .from('reports')
      .createSignedUrl(report.report_pdf_storage_path, SIGNED_URL_EXPIRY_SECONDS);
    pdfUrl = signedUrlData?.signedUrl ?? null;
  }

  return NextResponse.json({
    ready: true,
    status: report.status,
    reportId: report.id,
    propertyAddress: [report.property_address, report.city, report.state].filter(Boolean).join(', '),
    serviceType: report.service_type,
    assessedValue: propertyData?.assessed_value ?? 0,
    concludedValue,
    potentialSavings: Math.max(0, (propertyData?.assessed_value ?? 0) - concludedValue),
    pdfUrl,
    filingGuide,
    deliveredAt: report.delivered_at,
    // County filing info
    county: countyRule ? {
      name: countyRule.county_name,
      state: countyRule.state_name,
      appealBoardName: countyRule.appeal_board_name,
      appealBoardAddress: countyRule.appeal_board_address,
      appealBoardPhone: countyRule.appeal_board_phone,
      acceptsOnlineFiling: countyRule.accepts_online_filing,
      portalUrl: countyRule.portal_url,
      acceptsEmailFiling: countyRule.accepts_email_filing,
      filingEmail: countyRule.filing_email,
      requiresMailFiling: countyRule.requires_mail_filing,
      appealDeadlineRule: countyRule.appeal_deadline_rule,
      nextAppealDeadline: countyRule.next_appeal_deadline,
      currentTaxYear: countyRule.current_tax_year,
      assessmentCycle: countyRule.assessment_cycle,
      appealFormName: countyRule.appeal_form_name,
      formDownloadUrl: countyRule.form_download_url,
      filingFeeCents: countyRule.filing_fee_cents,
      filingFeeNotes: countyRule.filing_fee_notes,
      requiredDocuments: countyRule.required_documents,
      filingSteps: countyRule.filing_steps,
      hearingTypicallyRequired: countyRule.hearing_typically_required,
      hearingFormat: countyRule.hearing_format,
      hearingDurationMinutes: countyRule.hearing_duration_minutes,
      virtualHearingAvailable: countyRule.virtual_hearing_available,
      virtualHearingPlatform: countyRule.virtual_hearing_platform,
      informalReviewAvailable: countyRule.informal_review_available,
      informalReviewNotes: countyRule.informal_review_notes,
      typicalResolutionWeeksMin: countyRule.typical_resolution_weeks_min,
      typicalResolutionWeeksMax: countyRule.typical_resolution_weeks_max,
      furtherAppealBody: countyRule.further_appeal_body,
      proSeTips: countyRule.pro_se_tips,
    } : null,
    deadlineInfo: countyRule ? computeDeadlineInfo(countyRule) : null,
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/reports/viewer] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
