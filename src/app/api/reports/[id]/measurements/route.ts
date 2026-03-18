// ─── Measurements API ───────────────────────────────────────────────────────
// POST: Validate measurement data, save to measurements table, calculate
// discrepancy vs ATTOM GBA if available. Requires authenticated user.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { measurementSchema } from '@/lib/validations/report';
import { getReportById } from '@/lib/repository/reports';
import { applyRateLimit } from '@/lib/rate-limit';
import type { MeasurementInsert } from '@/types/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Rate limit: 30 measurements per 15 minutes per IP ────────────────
    const rateLimited = await applyRateLimit(request, { prefix: 'measurement', limit: 30, windowSeconds: 900 });
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

    // ── Verify report ownership ────────────────────────────────────────────
    const report = await getReportById(reportId);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // user_id stores client_email (not Supabase UUID), so compare against user.email
    if (!user.email || report.user_id !== user.email) {
      return NextResponse.json(
        { error: 'Not authorized to add measurements to this report' },
        { status: 403 }
      );
    }

    // ── Parse and validate input ───────────────────────────────────────────
    const body = await request.json();
    const parsed = measurementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // ── Save to measurements table ─────────────────────────────────────────
    const measurementData: MeasurementInsert = {
      report_id: reportId,
      source: parsed.data.source,
      north_wall_ft: parsed.data.north_wall_ft ?? null,
      south_wall_ft: parsed.data.south_wall_ft ?? null,
      east_wall_ft: parsed.data.east_wall_ft ?? null,
      west_wall_ft: parsed.data.west_wall_ft ?? null,
      calculated_footprint_sqft: parsed.data.calculated_footprint_sqft ?? null,
      total_living_area_sqft: parsed.data.total_living_area_sqft ?? null,
      garage_sqft: parsed.data.garage_sqft ?? null,
      basement_sqft: parsed.data.basement_sqft ?? null,
      basement_finished_sqft: parsed.data.basement_finished_sqft ?? null,
      attom_gba_sqft: parsed.data.attom_gba_sqft ?? null,
      lot_dimensions_description: null,
      discrepancy_flagged: parsed.data.discrepancy_flagged ?? false,
      discrepancy_pct: parsed.data.discrepancy_pct ?? null,
      notes: parsed.data.notes ?? null,
    };

    const { data: measurement, error: insertError } = await admin
      .from('measurements')
      .insert(measurementData)
      .select()
      .single();

    if (insertError || !measurement) {
      console.error('[api/measurements] Insert error:', insertError?.message);
      return NextResponse.json(
        { error: 'Failed to save measurement' },
        { status: 500 }
      );
    }

    // ── Calculate discrepancy vs ATTOM GBA if available ────────────────────
    let discrepancy: {
      attomGba: number | null;
      measuredGba: number | null;
      differencePercent: number | null;
    } | null = null;

    if (parsed.data.total_living_area_sqft) {
      const { data: pdRow } = await admin
        .from('property_data')
        .select('building_sqft_gross')
        .eq('report_id', reportId)
        .single();
      const propertyDataRow = pdRow as { building_sqft_gross: number | null } | null;

      if (propertyDataRow?.building_sqft_gross && propertyDataRow.building_sqft_gross > 0) {
        const attomGba = propertyDataRow.building_sqft_gross;
        const measuredGba = parsed.data.total_living_area_sqft;
        const differencePercent =
          ((measuredGba - attomGba) / attomGba) * 100;

        discrepancy = {
          attomGba,
          measuredGba,
          differencePercent: Math.round(differencePercent * 100) / 100,
        };
      }
    }

    return NextResponse.json(
      {
        measurement,
        discrepancy,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/measurements] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
