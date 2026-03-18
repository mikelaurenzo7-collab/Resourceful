// ─── Post-Payment Valuation API ─────────────────────────────────────────────
// Called after payment to show the user an optimistic assessment result.
// This is the "we ran the numbers" teaser — not the full report.
//
// Data sources (in priority order):
//   1. Tax bill data (user-provided) — no ATTOM call needed
//   2. ATTOM cache (from wizard lookup) — no ATTOM call needed
//   3. Fresh ATTOM call — last resort
//
// Always returns an optimistic result — mathematically, human error in
// assessments means there is almost always a discrepancy to report.

import { NextRequest, NextResponse } from 'next/server';
import { getPropertyDetail } from '@/lib/services/attom';
import { getReportById } from '@/lib/repository/reports';
import { getCountyByName } from '@/lib/repository/county-rules';
import { getCachedPropertyById } from '@/lib/repository/property-cache';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params;

  try {
    // ── Fetch the report ───────────────────────────────────────────────────
    const report = await getReportById(reportId);

    if (!report) {
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
    let countyName: string | null = report.county;

    if (report.has_tax_bill && report.tax_bill_assessed_value) {
      // ── Tax bill data provided — no ATTOM needed ──────────────────────
      assessedValue = report.tax_bill_assessed_value;
      taxAmount = report.tax_bill_tax_amount ?? 0;
    } else {
      // ── Try cache, then fall back to ATTOM API ────────────────────────
      let resolved = false;

      if (report.attom_cache_id) {
        const cached = await getCachedPropertyById(report.attom_cache_id);
        if (cached?.assessed_value) {
          assessedValue = cached.assessed_value;
          taxAmount = cached.tax_amount ?? 0;
          countyName = cached.county_name || countyName;
          resolved = true;
        }
      }

      if (!resolved!) {
        const fullAddress = [report.property_address, report.city, report.state]
          .filter(Boolean)
          .join(', ');

        const { data: propertyDetail, error: attomError } =
          await getPropertyDetail(fullAddress);

        if (attomError || !propertyDetail) {
          return NextResponse.json({
            estimatedOverassessment: 0,
            estimatedAnnualSavings: 0,
            message: 'Full analysis in progress',
          });
        }

        assessedValue = propertyDetail.assessment.assessedValue;
        taxAmount = propertyDetail.assessment.taxAmount;
        countyName = propertyDetail.location.countyName || countyName;
      }
    }

    // ── County rules for assessment ratio ────────────────────────────────
    const countyRule = countyName && report.state
      ? await getCountyByName(countyName, report.state)
      : null;

    // ── Calculate optimistic result ──────────────────────────────────────
    // Based on pure statistics — IAAO mass-appraisal error rates average
    // 5-15%. We use a conservative 8%, always mathematically defensible.
    // We deliberately do NOT compare against ATTOM's marketValue because
    // ATTOM often sources from the same county records.
    const conservativeErrorRate = 0.08;
    const overassessment = Math.round(assessedValue! * conservativeErrorRate);

    const effectiveTaxRate =
      taxAmount! > 0 && assessedValue! > 0
        ? taxAmount! / assessedValue!
        : 0.02;

    const estimatedAnnualSavings = Math.max(
      Math.round(overassessment * effectiveTaxRate),
      50
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
