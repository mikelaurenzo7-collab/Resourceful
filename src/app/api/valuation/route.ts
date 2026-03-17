// ─── Free Valuation API ──────────────────────────────────────────────────────
// Public endpoint (no auth). Takes an address, returns ATTOM assessment data
// and estimated savings. Rate-limited to prevent abuse.

import { NextRequest, NextResponse } from 'next/server';
import { getPropertyDetail } from '@/lib/services/attom';
import { getCountyByName } from '@/lib/repository/county-rules';
import { applyRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit: 10 free valuations per 15 minutes per IP ─────────────
    const rateLimited = await applyRateLimit(request, {
      prefix: 'free-valuation',
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
    const assessedValue = propertyDetail.assessment.assessedValue;
    const marketValue = propertyDetail.assessment.marketValue;
    const taxAmount = propertyDetail.assessment.taxAmount;

    // Effective tax rate from actual data
    const taxRate =
      taxAmount > 0 && assessedValue > 0 ? taxAmount / assessedValue : null;

    const overassessment = Math.max(0, assessedValue - marketValue);
    const estimatedAnnualSavings = taxRate
      ? Math.round(overassessment * taxRate)
      : null;

    return NextResponse.json({
      assessedValue,
      marketValue,
      landValue: propertyDetail.assessment.landValue,
      improvementValue: propertyDetail.assessment.improvementValue,
      assessmentYear: propertyDetail.assessment.assessmentYear,
      taxAmount,
      overassessment,
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
    console.error('[api/valuation] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
