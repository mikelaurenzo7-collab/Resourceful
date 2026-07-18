import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/rate-limit';
import { screenServiceJurisdiction } from '@/lib/services/jurisdiction-eligibility';
import { apiLogger } from '@/lib/logger';

const screenSchema = z.object({
  service_type: z.enum(['tax_appeal', 'pre_purchase', 'pre_listing']),
  property_address: z.string().trim().min(3).max(500),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(2).optional().nullable(),
  zip: z.string().trim().max(20).optional().nullable(),
  county: z.string().trim().max(100).optional().nullable(),
});

function responseStatus(code: string): number {
  if (code === 'ADDRESS_VERIFICATION_FAILED' || code === 'COUNTY_FIPS_UNRESOLVED') {
    return 503;
  }
  return 409;
}

export async function POST(request: NextRequest) {
  const rateLimited = await applyRateLimit(request, {
    prefix: 'jurisdiction-screen',
    limit: 20,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json().catch(() => null);
    const parsed = screenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A complete property address is required.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await screenServiceJurisdiction({
      serviceType: parsed.data.service_type,
      propertyAddress: parsed.data.property_address,
      city: parsed.data.city,
      state: parsed.data.state,
      zip: parsed.data.zip,
      county: parsed.data.county,
    });

    if (!result.allowed) {
      apiLogger.warn(
        {
          code: result.code,
          state: parsed.data.state,
          county: parsed.data.county,
          retryable: result.retryable,
        },
        '[jurisdiction-screen] Property not cleared for tax-appeal checkout'
      );
    }

    return NextResponse.json(result, {
      status: result.allowed ? 200 : responseStatus(result.code),
    });
  } catch (error) {
    apiLogger.error(
      { err: error instanceof Error ? error.message : String(error) },
      '[jurisdiction-screen] Screening failed'
    );
    return NextResponse.json(
      {
        allowed: false,
        code: 'ADDRESS_VERIFICATION_FAILED',
        message:
          'Resourceful could not verify the jurisdiction right now. No payment was collected. Please try again.',
        jurisdiction: null,
        retryable: true,
      },
      { status: 503 }
    );
  }
}
