// ─── Complete Calibration Entry API ──────────────────────────────────────────
// POST: Submit actual appraised value (and optional field-measured sqft) for
// a pending calibration entry. Computes variance and marks as completed.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/repository/admin';
import type { CalibrationEntry } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(request, { prefix: 'admin-calibration-complete', limit: 30, windowSeconds: 60 });
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      calibrationId,
      actualAppraisedValue,
      actualBuildingSqft,
      actualLotSqft,
      notes,
    } = body as {
      calibrationId?: string;
      actualAppraisedValue?: number;
      actualBuildingSqft?: number;
      actualLotSqft?: number;
      notes?: string;
    };

    if (!calibrationId) {
      return NextResponse.json({ error: 'calibrationId is required' }, { status: 400 });
    }
    if (!actualAppraisedValue || actualAppraisedValue <= 0) {
      return NextResponse.json({ error: 'Valid actualAppraisedValue is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch the entry
    const { data: rawEntry, error: fetchError } = await adminClient
      .from('calibration_entries')
      .select('*')
      .eq('id', calibrationId)
      .single();

    if (fetchError || !rawEntry) {
      return NextResponse.json({ error: 'Calibration entry not found' }, { status: 404 });
    }

    const entry = rawEntry as CalibrationEntry;

    // Compute variance
    const varianceDollars = actualAppraisedValue - entry.system_concluded_value;
    const variancePct = Math.round(
      ((actualAppraisedValue - entry.system_concluded_value) / actualAppraisedValue) * 10000
    ) / 100;

    // Compute sqft variance if actual sqft provided
    let sqftVariancePct: number | null = null;
    if (actualBuildingSqft && actualBuildingSqft > 0 && entry.attom_building_sqft && entry.attom_building_sqft > 0) {
      sqftVariancePct = Math.round(
        ((entry.attom_building_sqft - actualBuildingSqft) / actualBuildingSqft) * 10000
      ) / 100;
    }

    // Update entry
    const { data: updated, error: updateError } = await adminClient
      .from('calibration_entries')
      .update({
        actual_appraised_value: actualAppraisedValue,
        variance_dollars: varianceDollars,
        variance_pct: variancePct,
        actual_building_sqft: actualBuildingSqft ?? null,
        actual_lot_sqft: actualLotSqft ?? null,
        sqft_variance_pct: sqftVariancePct,
        notes: notes ?? entry.notes,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', calibrationId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update entry: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      entry: updated,
      varianceDollars,
      variancePct,
      sqftVariancePct,
    });
  } catch (error) {
    console.error('[calibration/complete] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
