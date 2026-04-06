// ─── Auth Callback Route ─────────────────────────────────────────────────────
// Handles the PKCE code exchange for Supabase Auth email links
// (password reset, email confirmation, magic links).
// Supabase redirects here with ?code=... which we exchange for a session,
// then redirect the user to their intended destination.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('[auth/callback] Code exchange failed:', error.message);
  }

  // If code exchange fails or no code, redirect to login with error hint
  return NextResponse.redirect(`${origin}/login`);
}
