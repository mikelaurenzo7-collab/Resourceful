// ─── Monthly Reminder Cron Endpoint ──────────────────────────────────────────
// Called monthly by Vercel Cron to send annual assessment reminders.
// Vercel config in vercel.json: { "crons": [{ "path": "/api/cron/reminders", "schedule": "0 9 1 * *" }] }
// Runs at 9 AM on the 1st of every month.

import { NextRequest, NextResponse } from 'next/server';
import { handleReminderCron } from '@/lib/services/reminder-service';
import { cronLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await handleReminderCron();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    cronLogger.error(`[cron/reminders] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
