// ─── Monthly Reminder Cron Endpoint ──────────────────────────────────────────
// Called monthly by Vercel Cron to send annual assessment reminders.
// Vercel config in vercel.json: { "crons": [{ "path": "/api/cron/reminders", "schedule": "0 9 1 * *" }] }
// Runs at 9 AM on the 1st of every month.

import { NextRequest, NextResponse } from 'next/server';
import { handleReminderCron } from '@/lib/services/reminder-service';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { cronLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const result = await handleReminderCron();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    cronLogger.error({ message }, '[cron/reminders] Error');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
