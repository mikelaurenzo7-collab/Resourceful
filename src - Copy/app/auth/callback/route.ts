// ─── Auth Callback Route ─────────────────────────────────────────────────────
// Handles the PKCE code exchange for Supabase Auth email links
// (password reset, email confirmation, magic links).
// Supabase redirects here with ?code=... which we exchange for a session,
// then redirect the user to their intended destination.
// After successful auth, links any email-only reports to the new account.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Link email-only reports to the authenticated user
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const admin = createAdminClient();
          const { data: linked } = await admin
            .from('reports')
            .update({ user_id: user.id })
            .eq('client_email', user.email.toLowerCase())
            .is('user_id', null)
            .select('id');

          if (linked && linked.length > 0) {
            authLogger.info({ count: linked.length, userId: user.id }, '[auth/callback] Linked reports to user');
          }
        }
      } catch (linkErr) {
        // Non-fatal — reports can still be linked later via dashboard
        authLogger.warn({ err: String(linkErr) }, '[auth/callback] Report linking failed (non-fatal)');
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    authLogger.error({ err: error.message }, '[auth/callback] Code exchange failed');
  }

  // If code exchange fails or no code, redirect to login with error hint
  const errorParam = code ? 'error=link_expired' : 'error=missing_code';
  return NextResponse.redirect(`${origin}/login?${errorParam}`);
}
