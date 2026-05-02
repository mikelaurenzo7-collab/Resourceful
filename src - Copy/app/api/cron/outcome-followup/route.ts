// ─── GET /api/cron/outcome-followup ──────────────────────────────────────────
// Weekly cron job that sends "How did your appeal go?" follow-up emails
// to customers whose reports were delivered 60+ days ago.
// Scheduled: Mondays at 10 AM UTC (see vercel.json)

import { NextRequest, NextResponse } from 'next/server';
import { sendOutcomeFollowups } from '@/lib/services/outcome-followup';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { cronLogger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  try {
    const result = await sendOutcomeFollowups();
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
