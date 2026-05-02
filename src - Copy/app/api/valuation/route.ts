// ─── Valuation API ──────────────────────────────────────────────────────────
// Public endpoint (no auth). Takes an address, returns ATTOM assessment data
// and estimated savings. Rate-limited to prevent abuse.

import { NextRequest, NextResponse } from 'next/server';
import { getPropertyDetail } from '@/lib/services/attom';
import { getCountyByName } from '@/lib/repository/county-rules';
import { applyRateLimit } from '@/lib/rate-limit';
import { apiLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit: 10 valuations per 15 minutes per IP ──────────────────
    const rateLimited = await applyRateLimit(request, {
      prefix: 'valuation',
      limit: 10,
      windowSeconds: 900,
    });
    if (rateLimited) return rateLimited;

    // ── Parse request ────────────────────────────────────────────────────
    const body = await request.json();
    const { address, city, state, county } = body as {
      address: string;
      city: string;
      state: string;
      county?: string;
    };

    if (!address || !city || !state) {
      return NextResponse.json(
        { error: 'Address, city, and state are required' },
        { status: 400 }
      );
    }

    // ── ATTOM property lookup ────────────────────────────────────────────
    const fullAddress = [address, city, state].filter(Boolean).join(', ');
    const { data: propertyDetail, error: attomError } =
      await getPropertyDetail(fullAddress);

    if (attomError || !propertyDetail) {
      return NextResponse.json(
        { error: 'Unable to retrieve property data for this address', details: attomError },
        { status: 502 }
      );
    }

    // ── County rules lookup ──────────────────────────────────────────────
    const countyName = county || propertyDetail.location.countyName;
    const countyRule = countyName
      ? await getCountyByName(countyName, state)
      : null;

    // ── Calculate values ─────────────────────────────────────────────────
    // IMPORTANT: We do NOT compare ATTOM assessedValue vs ATTOM marketValue.
    // Both come from county records — circular validation. If the county is
    // wrong, ATTOM inherits the same bad data. We use a statistical estimate
    // based on IAAO mass-appraisal error rates instead.
    const assessedValue = propertyDetail.assessment.assessedValue;
    const taxAmount = propertyDetail.assessment.taxAmount;

    const conservativeErrorRate = 0.08;
    const estimatedOverassessment = Math.round(assessedValue * conservativeErrorRate);

    // Use actual tax rate when available; fall back to 1% effective rate
    // estimate when ATTOM returns $0 tax amount (common for new construction,
    // exempt properties, or stale records).
    const taxRate =
      taxAmount > 0 && assessedValue > 0
        ? taxAmount / assessedValue
        : 0.01;

    const estimatedAnnualSavings = Math.max(Math.round(estimatedOverassessment * taxRate), 50);

    return NextResponse.json({
      assessedValue,
      landValue: propertyDetail.assessment.landValue,
      improvementValue: propertyDetail.assessment.improvementValue,
      assessmentYear: propertyDetail.assessment.assessmentYear,
      taxAmount,
      estimatedOverassessment,
      estimatedAnnualSavings,
      countyName: countyName || null,
      appealDeadlineRule: countyRule?.appeal_deadline_rule ?? null,
      propertySummary: {
        yearBuilt: propertyDetail.summary.yearBuilt,
        buildingSqFt: propertyDetail.summary.buildingSquareFeet,
        lotSqFt: propertyDetail.summary.lotSquareFeet,
        bedrooms: propertyDetail.summary.bedrooms,
        bathrooms: propertyDetail.summary.bathrooms,
        stories: propertyDetail.summary.stories,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message }, 'Unhandled error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
