// ─── Public Property Record Check ─────────────────────────────────────────────
// This endpoint confirms whether usable assessment data exists for an address.
// It deliberately does not claim that a property is overassessed or estimate
// savings before independent comparable and condition analysis is complete.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPropertyDetail } from '@/lib/services/attom';
import { getCountyByName } from '@/lib/repository/county-rules';
import { applyRateLimit } from '@/lib/rate-limit';
import { apiLogger } from '@/lib/logger';

const recordCheckSchema = z.object({
  address: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(2).max(50),
  county: z.string().trim().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimited = await applyRateLimit(request, {
      prefix: 'valuation',
      limit: 10,
      windowSeconds: 900,
    });
    if (rateLimited) return rateLimited;

    const parsed = recordCheckSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A valid property address, city, and state are required.' },
        { status: 400 }
      );
    }

    const { address, city, state, county } = parsed.data;
    const fullAddress = [address, city, state].join(', ');
    const { data: propertyDetail, error: attomError } = await getPropertyDetail(fullAddress);

    if (attomError || !propertyDetail) {
      apiLogger.info(
        { city, state, providerError: attomError ?? undefined },
        'Public property record was not available during landing-page screening'
      );
      return NextResponse.json({
        recordFound: false,
        message: 'We could not confirm a complete public record yet. You can still start a case and provide the tax bill or parcel number.',
      });
    }

    const countyName = county || propertyDetail.location.countyName;
    const countyRule = countyName ? await getCountyByName(countyName, state) : null;
    const assessedValue = propertyDetail.assessment.assessedValue || null;
    const taxAmount = propertyDetail.assessment.taxAmount || null;

    return NextResponse.json({
      recordFound: true,
      assessedValue,
      taxAmount,
      assessmentYear: propertyDetail.assessment.assessmentYear || null,
      countyName: countyName || null,
      appealDeadlineRule: countyRule?.appeal_deadline_rule ?? null,
      message: 'Public assessment data found. Appeal potential requires independent comparable, condition, and jurisdiction analysis.',
      propertySummary: {
        yearBuilt: propertyDetail.summary.yearBuilt || null,
        buildingSqFt: propertyDetail.summary.buildingSquareFeet || null,
        lotSqFt: propertyDetail.summary.lotSquareFeet || null,
        bedrooms: propertyDetail.summary.bedrooms || null,
        bathrooms: propertyDetail.summary.bathrooms || null,
        stories: propertyDetail.summary.stories || null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message }, 'Public property record check failed');
    return NextResponse.json(
      { error: 'The property record check is temporarily unavailable.' },
      { status: 500 }
    );
  }
}
