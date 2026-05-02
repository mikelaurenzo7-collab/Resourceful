// ─── Referral Code Validation ─────────────────────────────────────────────────
// GET /api/referral/validate?code=MIKE2026
// Returns discount percentage if valid, or error.

import { NextRequest, NextResponse } from 'next/server';
import { validateReferralCode } from '@/lib/services/referral-service';
import { applyRateLimit } from '@/lib/rate-limit';
import { apiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Rate limit: 20 validations per 5 minutes per IP (prevents enumeration)
  const rateLimited = await applyRateLimit(request, { prefix: 'referral-validate', limit: 20, windowSeconds: 300 });
  if (rateLimited) return rateLimited;

  const code = request.nextUrl.searchParams.get('code');

  if (!code || code.length > 50) {
    return NextResponse.json({ error: 'Code parameter required' }, { status: 400 });
  }

  try {
    const result = await validateReferralCode(code);

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 200 });
    }

    return NextResponse.json({
      valid: true,
      discountPct: result.discountPct,
      code: result.code?.code,
    });
  } catch (err) {
    apiLogger.error({ err: err instanceof Error ? err.message : err }, 'Validation failed');
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}
