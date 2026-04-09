// ─── GET /api/reports/[id]/viewer ─────────────────────────────────────────────
// Returns report data for the in-app viewer. Includes PDF URL, filing guide,
// property data, and county filing info — everything the user needs in one call.
// No auth required — keyed by report UUID (unguessable).

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit } from '@/lib/rate-limit';
import type { Report, PropertyData, CountyRule, ReportNarrative } from '@/types/database';

const SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit: 60 requests per 15 minutes per IP
  const rateLimitResponse = await applyRateLimit(_req, {
    prefix: 'report-viewer',
    limit: 60,
    windowSeconds: 900,
  });
  if (rateLimitResponse) return rateLimitResponse;

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

  // Only show reports that have been delivered or are in the delivery pipeline
  if (!['delivered', 'approved', 'pending_approval', 'delivering'].includes(report.status)) {
    const statusMessages: Record<string, string> = {
      intake:        "Your report is being prepared. We'll email you when it's ready.",
      paid:          'Payment confirmed. Your report is being generated now.',
      data_pull:     'Collecting property records, comparable sales, and assessment data.',
      photo_pending: 'Your photos are being analyzed for condition assessment and documentation.',
      processing:    'Our team is building your report with comparable sales and market analysis.',
      failed:        'We ran into an issue generating your report. Our team has been notified and will reach out shortly.',
      rejected:      'This report was not approved for delivery. Please contact support.',
    };
    return NextResponse.json({
      status: report.status,
      ready: false,
      message: statusMessages[report.status] ?? 'Your report is being generated and reviewed by our team.',
    });
  }

  // Fetch in parallel: property data, filing guide, county rules, comps, photos
  const [propertyResult, filingGuideResult, countyResult, compsResult, photosResult] = await Promise.all([
    supabase.from('property_data').select('*').eq('report_id', reportId).single(),
    supabase.from('report_narratives').select('content').eq('report_id', reportId).eq('section_name', 'pro_se_filing_guide').single(),
    report.county_fips
      ? supabase.from('county_rules').select('*').eq('county_fips', report.county_fips).single()
      : report.county && report.state
        ? supabase.from('county_rules').select('*').eq('county_name', report.county).eq('state_abbreviation', report.state).single()
        : Promise.resolve({ data: null, error: null }),
    supabase.from('comparable_sales').select('adjusted_price_per_sqft, sale_price').eq('report_id', reportId),
    supabase.from('photos').select('id').eq('report_id', reportId),
  ]);

  const propertyData = propertyResult.data as PropertyData | null;
  const filingGuide = (filingGuideResult.data as Pick<ReportNarrative, 'content'> | null)?.content ?? null;
  const countyRule = countyResult.data as CountyRule | null;

  // Concluded value — prefer the pipeline-stored value (includes photo adjustments,
  // cost approach, income approach as applicable). Fall back to recalculating the
  // median adjusted $/sqft × GBA from comps if the stored value is missing.
  const comps = (compsResult.data ?? []) as { adjusted_price_per_sqft: number | null; sale_price: number | null }[];
  let concludedValue = propertyData?.concluded_value ?? 0;

  if (concludedValue === 0 && comps.length > 0 && propertyData?.building_sqft_gross) {
    const adjustedPrices = comps
      .map((c) => c.adjusted_price_per_sqft)
      .filter((p): p is number => p != null && p > 0)
      .sort((a, b) => a - b);
    if (adjustedPrices.length > 0) {
      const mid = Math.floor(adjustedPrices.length / 2);
      const median =
        adjustedPrices.length % 2 === 0
          ? (adjustedPrices[mid - 1] + adjustedPrices[mid]) / 2
          : adjustedPrices[mid];
      concludedValue = Math.round((median * propertyData.building_sqft_gross) / 1000) * 1000;
    }
  }

  // Generate signed PDF URL
  let pdfUrl: string | null = null;
  if (report.report_pdf_storage_path) {
    const { data: signedUrlData } = await supabase
      .storage
      .from('reports')
      .createSignedUrl(report.report_pdf_storage_path, SIGNED_URL_EXPIRY_SECONDS);
    pdfUrl = signedUrlData?.signedUrl ?? null;
  }

  // Case intelligence
  const caseStrengthScore = (report as unknown as Record<string, unknown>).case_strength_score as number | null ?? null;
  const photoCount = (photosResult.data ?? []).length;
  const compCount = comps.length;
  const photoDefectCount = propertyData?.photo_defect_count ?? null;
  const photoImpactDollars = propertyData?.photo_impact_dollars ?? null;
  const photoImpactPct = propertyData?.photo_impact_pct ?? null;
  const valuationMethod = (propertyData as unknown as Record<string, unknown>)?.valuation_method as string | null ?? null;

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
    // Case intelligence
    caseStrengthScore,
    compCount,
    photoCount,
    photoDefectCount,
    photoImpactDollars,
    photoImpactPct,
    valuationMethod,
    // County filing info
    outcomeReportedAt: report.outcome_reported_at ?? null,
    appealOutcome: report.appeal_outcome ?? null,
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
  });
}
