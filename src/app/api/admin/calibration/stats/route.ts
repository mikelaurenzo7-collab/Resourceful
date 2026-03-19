// ─── Calibration Stats API ───────────────────────────────────────────────────
// GET: Returns calibration accuracy stats and current params.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/repository/admin';
import type { CalibrationEntry, CalibrationParams } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(request, { prefix: 'admin-calibration-stats', limit: 30, windowSeconds: 60 });
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

    const adminClient = createAdminClient();

    // Fetch all entries and params in parallel
    const [entriesRes, paramsRes, pendingRes] = await Promise.all([
      adminClient
        .from('calibration_entries')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false }),
      adminClient
        .from('calibration_params')
        .select('*')
        .order('property_type', { ascending: true }),
      adminClient
        .from('calibration_entries')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    const completed = (entriesRes.data ?? []) as CalibrationEntry[];
    const pending = (pendingRes.data ?? []) as CalibrationEntry[];
    const params = (paramsRes.data ?? []) as CalibrationParams[];

    // Compute per-property-type stats
    const propertyTypes = ['residential', 'land'] as const;
    const statsByType = propertyTypes.map(pt => {
      const ptEntries = completed.filter(e => e.property_type === pt);
      const absErrors = ptEntries
        .filter(e => e.variance_pct != null)
        .map(e => Math.abs(e.variance_pct!));
      const errors = ptEntries
        .filter(e => e.variance_pct != null)
        .map(e => e.variance_pct!);
      const sqftErrors = ptEntries
        .filter(e => e.sqft_variance_pct != null)
        .map(e => e.sqft_variance_pct!);

      const sorted = [...errors].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianErr = sorted.length === 0 ? null :
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

      return {
        propertyType: pt,
        totalCompleted: ptEntries.length,
        meanAbsoluteErrorPct: absErrors.length > 0
          ? Math.round((absErrors.reduce((s, v) => s + v, 0) / absErrors.length) * 100) / 100
          : null,
        medianErrorPct: medianErr != null ? Math.round(medianErr * 100) / 100 : null,
        biasDirection: medianErr == null ? null : medianErr > 0 ? 'undervalues' : 'overvalues',
        sqftEntries: sqftErrors.length,
        meanSqftBiasPct: sqftErrors.length > 0
          ? Math.round((sqftErrors.reduce((s, v) => s + v, 0) / sqftErrors.length) * 100) / 100
          : null,
      };
    });

    return NextResponse.json({
      totalCompleted: completed.length,
      totalPending: pending.length,
      statsByType,
      params,
      pendingEntries: pending,
      recentCompleted: completed.slice(0, 20),
    });
  } catch (error) {
    console.error('[calibration/stats] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
