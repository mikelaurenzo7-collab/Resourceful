// ─── Property Lookup API ────────────────────────────────────────────────────
// Called during the wizard (Step 2) when the user selects an address.
// Returns ATTOM property details (type, year built, beds/baths, sqft, etc.)
// so we can auto-populate the form and show expertise.
//
// Caches the ATTOM response in property_cache for reuse by:
//   - POST /api/reports/[id]/valuation (instant preview)
//   - Pipeline Stage 1 (data collection)
//
// This eliminates redundant ATTOM calls — one lookup serves the entire lifecycle.

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getPropertyDetail, extractPropertySummary } from '@/lib/services/attom';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  normalizeAddressKey,
  getCachedProperty,
  upsertPropertyCache,
} from '@/lib/repository/property-cache';

const lookupSchema = z.object({
  line1: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
});

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit: 30 lookups per 15 minutes per IP ──────────────────────
    const rateLimited = await applyRateLimit(request, {
      prefix: 'property-lookup',
      limit: 30,
      windowSeconds: 900,
    });
    if (rateLimited) return rateLimited;

    // ── Parse and validate request ──────────────────────────────────────
    const body = await request.json();
    const parsed = lookupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { line1, city, state } = parsed.data;

    // ── Check cache first ──────────────────────────────────────────────────
    const addressKey = normalizeAddressKey(line1, city, state);
    const cached = await getCachedProperty(addressKey);

    if (cached) {
      return NextResponse.json({
        cacheId: cached.id,
        propertyType: cached.property_type,
        yearBuilt: cached.year_built,
        bedrooms: cached.bedrooms,
        bathrooms: cached.bathrooms,
        buildingSqFt: cached.building_sqft,
        lotSqFt: cached.lot_sqft,
        stories: cached.stories,
        assessedValue: cached.assessed_value,
        taxAmount: cached.tax_amount,
        assessmentYear: cached.assessment_year,
        countyFips: cached.county_fips,
        countyName: cached.county_name,
        source: 'cache' as const,
      });
    }

    // ── ATTOM lookup ───────────────────────────────────────────────────────
    const fullAddress = [line1, city, state].filter(Boolean).join(', ');
    const { data: attomDetail, error: attomError } =
      await getPropertyDetail(fullAddress);

    if (attomError || !attomDetail) {
      return NextResponse.json(
        { error: 'Unable to retrieve property data for this address', details: attomError },
        { status: 502 }
      );
    }

    // ── Cache the response ─────────────────────────────────────────────────
    const cacheEntry = await upsertPropertyCache(addressKey, attomDetail);
    const summary = extractPropertySummary(attomDetail);

    return NextResponse.json({
      cacheId: cacheEntry.id,
      ...summary,
      source: 'attom' as const,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/property/lookup] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
