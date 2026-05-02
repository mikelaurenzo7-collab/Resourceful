// ─── GET /api/cron/calibration ────────────────────────────────────────────────
// Weekly cron job that aggregates calibration entries into learned params.
// This is the feedback loop that makes valuations increasingly accurate.
// Scheduled: Sundays at 4 AM UTC (see vercel.json)
//
// After this runs, the pipeline's getCalibrationParams() will return
// real learned multipliers instead of neutral 1.0 defaults.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runCalibrationBatch } from '@/lib/services/calibration-batch';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { cronLogger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();
    const result = await runCalibrationBatch(supabase);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    cronLogger.error({ err: message }, 'Failed');
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
