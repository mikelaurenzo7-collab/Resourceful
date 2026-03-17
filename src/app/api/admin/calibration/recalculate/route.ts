// ─── Recalculate Calibration Params API ──────────────────────────────────────
// POST: Triggers recalculation of adjustment multipliers and bias corrections
// from all completed calibration entries.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/repository/admin';
import { recalculateCalibrationParams } from '@/lib/calibration/recalculate';

export async function POST() {
  try {
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
    const result = await recalculateCalibrationParams(adminClient);

    return NextResponse.json({
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[calibration/recalculate] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
