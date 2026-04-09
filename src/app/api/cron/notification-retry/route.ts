// ─── GET /api/cron/notification-retry ────────────────────────────────────────
// Hourly cron that retries delivery notification emails that failed in Stage 8.
// If email fails, the report is still accessible via dashboard (dashboard-first),
// but the user doesn't know it's ready. This catches those cases.
// Scheduled: every hour (see vercel.json)

import { NextRequest, NextResponse } from 'next/server';
import { retryFailedNotifications } from '@/lib/services/notification-retry';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { cronLogger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  try {
    const result = await retryFailedNotifications();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    cronLogger.error({ err: message }, 'Failed');
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
