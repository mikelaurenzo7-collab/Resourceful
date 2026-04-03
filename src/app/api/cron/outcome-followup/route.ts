// ─── GET /api/cron/outcome-followup ──────────────────────────────────────────
// Weekly cron job that sends "How did your appeal go?" follow-up emails
// to customers whose reports were delivered 60+ days ago.
// Scheduled: Mondays at 10 AM UTC (see vercel.json)

import { NextRequest, NextResponse } from 'next/server';
import { sendOutcomeFollowups } from '@/lib/services/outcome-followup';

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron endpoints)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendOutcomeFollowups();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/outcome-followup] Failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
