// ─── Quick Assessment Lookup API ─────────────────────────────────────────────
// GET: Given report ID (which has address), do a quick ATTOM/county lookup.
// Returns assessed value, market value range, assessment ratio, and estimated
// savings. Used by the frontend assessment card on Screen 2.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getReportById } from '@/lib/repository/reports';
import { getPropertyDetail } from '@/lib/services/attom';
import { getCountyByName } from '@/lib/repository/county-rules';
import { applyRateLimit } from '@/lib/rate-limit';
import { calculateOptimisticEstimate, buildPropertyAddress } from '@/lib/utils/valuation-math';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Rate limit: 30 assessment lookups per 15 minutes per IP ──────────
    const rateLimited = await applyRateLimit(_request, { prefix: 'assessment', limit: 30, windowSeconds: 900 });
    if (rateLimited) return rateLimited;

    const { id: reportId } = await params;

    // ── Authenticate user ──────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ── Fetch report ───────────────────────────────────────────────────────
    const report = await getReportById(reportId);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const ownsReport = report.user_id === user.id || report.client_email === user.email;
    if (!ownsReport) {
      return NextResponse.json(
        { error: 'Not authorized to view this report' },
        { status: 403 }
      );
    }

    // ── ATTOM property lookup ──────────────────────────────────────────────
    const fullAddress = buildPropertyAddress(report.property_address, report.city, report.state);

    const { data: propertyDetail, error: attomError } =
      await getPropertyDetail(fullAddress);

    if (attomError || !propertyDetail) {
      console.error('[api/assessment] ATTOM error:', attomError);
      return NextResponse.json(
        { error: 'Unable to retrieve property assessment data' },
        { status: 502 }
      );
    }

    // ── County rules lookup ────────────────────────────────────────────────
    const countyRule = report.county && report.state
      ? await getCountyByName(report.county, report.state)
      : null;

    const assessmentRatioResidential = countyRule?.assessment_ratio_residential ?? null;

    // ── Calculate values ───────────────────────────────────────────────────
    // IMPORTANT: We do NOT use ATTOM's marketValue for overassessment or
    // savings estimates. ATTOM sources from county records — if the county's
    // data is inflated or corrupt, ATTOM inherits that error. Comparing
    // assessedValue vs marketValue from the same source is circular validation.
    // The real independent analysis happens in the pipeline (comparable sales,
    // user photos, our own measurements).
    const assessedValue = propertyDetail.assessment.assessedValue;

    // Statistical estimate: IAAO mass-appraisal error rates average 5-15%.
    // Use shared optimistic estimate (IAAO-standard 8% error rate)
    const { overassessment: estimatedOverassessment, estimatedAnnualSavings: estimatedSavings } =
      calculateOptimisticEstimate(assessedValue, propertyDetail.assessment.taxAmount);

    return NextResponse.json(
      {
        assessedValue,
        landValue: propertyDetail.assessment.landValue,
        improvementValue: propertyDetail.assessment.improvementValue,
        assessmentYear: propertyDetail.assessment.assessmentYear,
        taxAmount: propertyDetail.assessment.taxAmount,
        countyAssessmentRatioResidential: assessmentRatioResidential,
        estimatedOverassessment,
        estimatedAnnualSavings: estimatedSavings,
        appealDeadlineRule: countyRule?.appeal_deadline_rule ?? null,
        taxYearAppealWindow: countyRule?.tax_year_appeal_window ?? null,
        propertySummary: {
          yearBuilt: propertyDetail.summary.yearBuilt,
          buildingSqFt: propertyDetail.summary.buildingSquareFeet,
          lotSqFt: propertyDetail.summary.lotSquareFeet,
          bedrooms: propertyDetail.summary.bedrooms,
          bathrooms: propertyDetail.summary.bathrooms,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/assessment] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
