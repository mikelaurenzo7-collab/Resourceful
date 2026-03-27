// ─── Referral Code Validation ─────────────────────────────────────────────────
// GET /api/referral/validate?code=MIKE2026
// Returns discount percentage if valid, or error.

import { NextRequest, NextResponse } from 'next/server';
import { validateReferralCode } from '@/lib/services/referral-service';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Code parameter required' }, { status: 400 });
  }

  const result = await validateReferralCode(code);

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 200 });
  }

  return NextResponse.json({
    valid: true,
    discountPct: result.discountPct,
    code: result.code?.code,
  });
}
