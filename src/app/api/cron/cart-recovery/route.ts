// ─── GET /api/cron/cart-recovery ──────────────────────────────────────────────
// Hourly cron job that sends recovery emails to users who started checkout
// but never completed payment (2-48 hour window).
// Scheduled: Hourly at :30 (see vercel.json)

import { NextRequest, NextResponse } from 'next/server';
import { sendCartRecoveryEmails } from '@/lib/services/cart-recovery';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendCartRecoveryEmails();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/cart-recovery] Failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
