// ─── Blind Valuation API ─────────────────────────────────────────────────────
// POST: Run a lightweight valuation (ATTOM data + comps only) for calibration.
// Creates a calibration_entries row with status='pending'.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/repository/admin';
import { runBlindValuation } from '@/lib/calibration/run-blind-valuation';
import type { PropertyType } from '@/types/database';

const VALID_TYPES: PropertyType[] = ['residential', 'commercial', 'industrial', 'land'];

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const { address, propertyType } = body as { address?: string; propertyType?: string };

    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      return NextResponse.json({ error: 'Valid address is required' }, { status: 400 });
    }
    if (!propertyType || !VALID_TYPES.includes(propertyType as PropertyType)) {
      return NextResponse.json({ error: 'Valid property type is required' }, { status: 400 });
    }

    // Run blind valuation
    const result = await runBlindValuation(address.trim(), propertyType as PropertyType);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    // Store calibration entry
    const adminClient = createAdminClient();
    const { data: entry, error: insertError } = await adminClient
      .from('calibration_entries')
      .insert({
        property_address: address.trim(),
        city: result.city,
        state: result.state,
        county: result.county,
        county_fips: result.countyFips,
        property_type: propertyType as PropertyType,
        building_sqft: result.attomBuildingSqft,
        lot_size_sqft: result.attomLotSqft,
        year_built: result.yearBuilt,
        system_concluded_value: result.concludedValue,
        comp_count: result.compCount,
        median_adjusted_psf: result.medianAdjustedPsf,
        actual_appraised_value: null,
        variance_dollars: null,
        variance_pct: null,
        avg_adj_size: result.avgAdjSize,
        avg_adj_condition: result.avgAdjCondition,
        avg_adj_market_trends: result.avgAdjMarketTrends,
        avg_adj_land_ratio: result.avgAdjLandRatio,
        avg_net_adjustment: result.avgNetAdjustment,
        attom_building_sqft: result.attomBuildingSqft,
        attom_lot_sqft: result.attomLotSqft,
        actual_building_sqft: null,
        actual_lot_sqft: null,
        sqft_variance_pct: null,
        source_report_id: null,
        status: 'pending',
        notes: null,
        submitted_by: user.id,
        completed_at: null,
      })
      .select()
      .single();

    if (insertError || !entry) {
      return NextResponse.json(
        { error: `Failed to store calibration entry: ${insertError?.message ?? 'unknown'}` },
        { status: 500 }
      );
    }

    const calibrationEntry = entry as { id: string };

    return NextResponse.json({
      calibrationId: calibrationEntry.id,
      concludedValue: result.concludedValue,
      compCount: result.compCount,
      medianAdjustedPsf: result.medianAdjustedPsf,
      attomBuildingSqft: result.attomBuildingSqft,
      attomLotSqft: result.attomLotSqft,
      yearBuilt: result.yearBuilt,
      county: result.county,
      adjustmentBreakdown: {
        avgSize: result.avgAdjSize,
        avgCondition: result.avgAdjCondition,
        avgMarketTrends: result.avgAdjMarketTrends,
        avgLandRatio: result.avgAdjLandRatio,
        avgNet: result.avgNetAdjustment,
      },
      comps: result.comps,
    });
  } catch (error) {
    console.error('[calibration/run] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
