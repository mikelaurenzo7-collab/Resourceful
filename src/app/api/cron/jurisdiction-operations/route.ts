import { NextRequest, NextResponse } from 'next/server';
import { runJurisdictionOperationsReconciliation } from '@/lib/operations/jurisdiction-operations';
import { verifyCronAuth } from '@/lib/utils/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const result = await runJurisdictionOperationsReconciliation();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Jurisdiction reconciliation failed',
      },
      { status: 500 }
    );
  }
}
