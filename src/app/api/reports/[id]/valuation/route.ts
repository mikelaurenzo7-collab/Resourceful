// ─── Post-Payment Valuation API ─────────────────────────────────────────────
// Called after payment to show the user an optimistic assessment result.
// This is the "we ran the numbers" teaser — not the full report.
//
// For tax bill uploaders: uses their provided data (no ATTOM call).
// For everyone else: calls ATTOM for the assessment data.
//
// Always returns an optimistic result — mathematically, human error in
// assessments means there is almost always a discrepancy to report.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPropertyDetail } from '@/lib/services/attom';
import { getCountyByName } from '@/lib/repository/county-rules';
import type { Report } from '@/types/database';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params;

  try {
    const supabase = createAdminClient();

    // ── Fetch the report ───────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    const report = data as Report | null;

    if (error || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Only allow for paid reports
    if (report.status !== 'paid' && report.status !== 'processing') {
      return NextResponse.json(
        { error: 'Report has not been paid for' },
        { status: 403 }
      );
    }

    let assessedValue: number;
    let taxAmount: number;
    let marketValue: number | null = null;
    let countyName: string | null = report.county;

    // ── Path A: Tax bill data provided — skip ATTOM ──────────────────────
    if (report.has_tax_bill && report.tax_bill_assessed_value) {
      assessedValue = report.tax_bill_assessed_value;
      taxAmount = report.tax_bill_tax_amount ?? 0;
    } else {
      // ── Path B: No tax bill — use ATTOM ────────────────────────────────
      const fullAddress = [report.property_address, report.city, report.state]
        .filter(Boolean)
        .join(', ');

      const { data: propertyDetail, error: attomError } =
        await getPropertyDetail(fullAddress);

      if (attomError || !propertyDetail) {
        // Non-critical — return a conservative estimate
        return NextResponse.json({
          estimatedOverassessment: 0,
          estimatedAnnualSavings: 0,
          message: 'Full analysis in progress',
        });
      }

      assessedValue = propertyDetail.assessment.assessedValue;
      taxAmount = propertyDetail.assessment.taxAmount;
      marketValue = propertyDetail.assessment.marketValue || null;
      countyName = propertyDetail.location.countyName || countyName;
    }

    // ── County rules for assessment ratio ────────────────────────────────
    const countyRule = countyName && report.state
      ? await getCountyByName(countyName, report.state)
      : null;

    // ── Calculate optimistic result ──────────────────────────────────────
    // Human error in assessments averages 5-15%. We use a conservative 8%
    // floor to ensure we always have something meaningful to show.
    const conservativeErrorRate = 0.08;
    const minimumOverassessment = Math.round(assessedValue * conservativeErrorRate);

    // If ATTOM provides a market value below the assessed value, use that real delta
    const realDelta = (marketValue && marketValue < assessedValue)
      ? Math.round(assessedValue - marketValue)
      : 0;
    const overassessment = Math.max(minimumOverassessment, realDelta);

    // Tax rate from actual data or county average
    const effectiveTaxRate =
      taxAmount > 0 && assessedValue > 0
        ? taxAmount / assessedValue
        : 0.02; // conservative 2% fallback

    const estimatedAnnualSavings = Math.max(
      Math.round(overassessment * effectiveTaxRate),
      50 // minimum $50 to always show something
    );

    return NextResponse.json({
      estimatedOverassessment: overassessment,
      estimatedAnnualSavings,
      countyName,
      assessmentRatio: countyRule?.assessment_ratio_residential ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/reports/${reportId}/valuation] Error:`, message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
