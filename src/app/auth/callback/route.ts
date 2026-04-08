// ─── Auth Callback Route ─────────────────────────────────────────────────────
// Handles the PKCE code exchange for Supabase Auth email links
// (password reset, email confirmation, magic links).
// Supabase redirects here with ?code=... which we exchange for a session,
// then redirect the user to their intended destination.
// After successful auth, links any email-only reports to the new account.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
            console.log(`[auth/callback] Linked ${linked.length} reports to user ${user.id} (${user.email})`);
          }
        }
      } catch (linkErr) {
        // Non-fatal — reports can still be linked later via dashboard
        console.warn('[auth/callback] Report linking failed (non-fatal):', linkErr);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('[auth/callback] Code exchange failed:', error.message);
  }

  // If code exchange fails or no code, redirect to login with error hint
  return NextResponse.redirect(`${origin}/login`);
}
