// ─── GET /api/reports/[id]/viewer ─────────────────────────────────────────────
// Returns report data for the in-app viewer. Includes PDF URL, filing guide,
// property data, and county filing info — everything the user needs in one call.
// Auth required: user must own the report (by user_id or email match).

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/rate-limit';
import type { PropertyData, CountyRule } from '@/types/database';
import { apiLogger } from '@/lib/logger';

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

  try {
  const supabase = createAdminClient();

  // Fetch report
  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('id, status, user_id, client_email, property_address, city, state, county_fips, county, service_type, review_tier, report_pdf_storage_path, delivered_at, outcome_reported_at, appeal_outcome, case_strength_score, case_value_at_stake')
    .eq('id', reportId)
    .single();

  if (reportError || !reportData) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = reportData as any; // Dynamic field access throughout this route

  // ── Authenticate + verify ownership ────────────────────────────────────
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const isOwner = report.user_id
    ? report.user_id === user.id
    : report.client_email === user.email;

  if (!isOwner) {
    return NextResponse.json({ error: 'Not authorized to view this report' }, { status: 403 });
  }

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

  // Fetch in parallel: property data, narratives (all), county rules, comps (full), photos
  const [propertyResult, narrativesResult, countyResult, compsResult, photosResult] = await Promise.all([
    supabase.from('property_data').select('assessed_value, concluded_value, building_sqft_gross, photo_defect_count, photo_impact_dollars, photo_impact_pct, valuation_method').eq('report_id', reportId).single(),
    supabase.from('report_narratives').select('section_name, content').eq('report_id', reportId),
    report.county_fips
      ? supabase.from('county_rules').select('county_name, state_name, appeal_board_name, appeal_board_address, appeal_board_phone, accepts_online_filing, portal_url, accepts_email_filing, filing_email, requires_mail_filing, appeal_deadline_rule, next_appeal_deadline, current_tax_year, assessment_cycle, appeal_form_name, form_download_url, filing_fee_cents, filing_fee_notes, required_documents, filing_steps, hearing_typically_required, hearing_format, hearing_duration_minutes, virtual_hearing_available, virtual_hearing_platform, informal_review_available, informal_review_notes, typical_resolution_weeks_min, typical_resolution_weeks_max, further_appeal_body, pro_se_tips').eq('county_fips', report.county_fips).single()
      : report.county && report.state
        ? supabase.from('county_rules').select('county_name, state_name, appeal_board_name, appeal_board_address, appeal_board_phone, accepts_online_filing, portal_url, accepts_email_filing, filing_email, requires_mail_filing, appeal_deadline_rule, next_appeal_deadline, current_tax_year, assessment_cycle, appeal_form_name, form_download_url, filing_fee_cents, filing_fee_notes, required_documents, filing_steps, hearing_typically_required, hearing_format, hearing_duration_minutes, virtual_hearing_available, virtual_hearing_platform, informal_review_available, informal_review_notes, typical_resolution_weeks_min, typical_resolution_weeks_max, further_appeal_body, pro_se_tips').eq('county_name', report.county).eq('state_abbreviation', report.state).single()
        : Promise.resolve({ data: null, error: null }),
    supabase.from('comparable_sales')
      .select('address, sale_price, sale_date, building_sqft, adjusted_price_per_sqft, distance_miles, net_adjustment_pct, is_distressed_sale, is_weak_comparable')
      .eq('report_id', reportId)
      .order('distance_miles', { ascending: true }),
    supabase.from('photos').select('id').eq('report_id', reportId),
  ]);

  const propertyData = propertyResult.data as PropertyData | null;
  const narrativeRows = (narrativesResult.data ?? []) as { section_name: string; content: string }[];
  const filingGuide = narrativeRows.find(n => n.section_name === 'pro_se_filing_guide')?.content ?? null;
  const countyRule = countyResult.data as CountyRule | null;

  // Concluded value — prefer the pipeline-stored value (includes photo adjustments,
  // cost approach, income approach as applicable). Fall back to recalculating the
  // median adjusted $/sqft × GBA from comps if the stored value is missing.
  interface CompRow {
    address: string | null;
    sale_price: number | null;
    sale_date: string | null;
    building_sqft: number | null;
    adjusted_price_per_sqft: number | null;
    distance_miles: number | null;
    net_adjustment_pct: number | null;
    is_distressed_sale: boolean | null;
    is_weak_comparable: boolean | null;
  }
  const comps = (compsResult.data ?? []) as CompRow[];
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
  const caseStrengthScore = report.case_strength_score as number | null ?? null;
  const photoCount = (photosResult.data ?? []).length;
  const compCount = comps.length;
  const photoDefectCount = propertyData?.photo_defect_count ?? null;
  const photoImpactDollars = propertyData?.photo_impact_dollars ?? null;
  const photoImpactPct = propertyData?.photo_impact_pct ?? null;
  const valuationMethod = propertyData?.valuation_method ?? null;

  return NextResponse.json({
    ready: true,
    status: report.status,
    reportId: report.id,
    propertyAddress: [report.property_address, report.city, report.state].filter(Boolean).join(', '),
    serviceType: report.service_type,
    reviewTier: report.review_tier ?? 'auto',
    assessedValue: propertyData?.assessed_value ?? 0,
    concludedValue,
    potentialSavings: report.case_value_at_stake as number ?? Math.max(0, (propertyData?.assessed_value ?? 0) - concludedValue),
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
    // Comparable sales (full data for web viewer)
    comparableSales: comps.map(c => ({
      address: c.address,
      salePrice: c.sale_price,
      saleDate: c.sale_date,
      buildingSqft: c.building_sqft,
      adjustedPricePerSqft: c.adjusted_price_per_sqft,
      distanceMiles: c.distance_miles,
      netAdjustmentPct: c.net_adjustment_pct,
      isDistressedSale: c.is_distressed_sale,
      isWeakComparable: c.is_weak_comparable,
    })),
    // Narrative sections (all except filing guide, which is separate)
    narratives: narrativeRows
      .filter(n => n.section_name !== 'pro_se_filing_guide')
      .map(n => ({ sectionName: n.section_name, content: n.content })),
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
  } catch (err) {
    apiLogger.error({ err: err instanceof Error ? err.message : err, reportId }, 'Error fetching report viewer data');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
