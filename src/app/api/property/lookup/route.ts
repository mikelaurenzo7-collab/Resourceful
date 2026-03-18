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

import { NextRequest, NextResponse } from 'next/server';
import { getPropertyDetail } from '@/lib/services/attom';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  normalizeAddressKey,
  getCachedProperty,
  upsertPropertyCache,
  mapAttomPropertyType,
} from '@/lib/repository/property-cache';

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit: 30 lookups per 15 minutes per IP ──────────────────────
    const rateLimited = await applyRateLimit(request, {
      prefix: 'property-lookup',
      limit: 30,
      windowSeconds: 900,
    });
    if (rateLimited) return rateLimited;

    // ── Parse request ────────────────────────────────────────────────────
    const body = await request.json();
    const { line1, city, state } = body as {
      line1: string;
      city: string;
      state: string;
    };

    if (!line1 || !city || !state) {
      return NextResponse.json(
        { error: 'line1, city, and state are required' },
        { status: 400 }
      );
    }

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
        source: 'cache',
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

    return NextResponse.json({
      cacheId: cacheEntry.id,
      propertyType: mapAttomPropertyType(attomDetail.summary.propertyType),
      propertyTypeRaw: attomDetail.summary.propertyType,
      yearBuilt: attomDetail.summary.yearBuilt || null,
      bedrooms: attomDetail.summary.bedrooms || null,
      bathrooms: attomDetail.summary.bathrooms || null,
      buildingSqFt: attomDetail.summary.buildingSquareFeet || null,
      lotSqFt: attomDetail.summary.lotSquareFeet || null,
      stories: attomDetail.summary.stories || null,
      assessedValue: attomDetail.assessment.assessedValue || null,
      taxAmount: attomDetail.assessment.taxAmount || null,
      assessmentYear: attomDetail.assessment.assessmentYear || null,
      countyFips: attomDetail.location.countyFips || null,
      countyName: attomDetail.location.countyName || null,
      source: 'attom',
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
