// ─── Referral Code Generation ─────────────────────────────────────────────────
// POST /api/referral/generate
// Generates a unique referral code for authenticated users.
// Returns existing code if one already exists for this email.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReferralCode } from '@/lib/services/referral-service';
import { applyRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit: 5 generations per hour per IP
  const rateLimited = await applyRateLimit(request, { prefix: 'referral-generate', limit: 5, windowSeconds: 3600 });
  if (rateLimited) return rateLimited;

  // Must be authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Check if user already has a referral code
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('referral_codes')
    .select('code')
    .eq('referrer_email', user.email.toLowerCase())
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ code: (existing as { code: string }).code });
  }

  // Parse body for optional name
  let name: string | null = null;
  try {
    const body = await request.json();
    if (body.name && typeof body.name === 'string') {
      name = body.name.slice(0, 100);
    }
  } catch {
    // No body or invalid JSON — fine, name is optional
  }

  const code = await generateReferralCode(user.email, name);

  return NextResponse.json({ code });
}
