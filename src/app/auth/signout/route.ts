// ─── Sign Out Route ──────────────────────────────────────────────────────────
// POST /auth/signout — signs the user out and redirects to homepage.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppUrl } from '@/lib/utils/app-url';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL('/', getAppUrl()), { status: 303 });
}
