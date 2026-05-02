// ─── Link Reports to Authenticated User ─────────────────────────────────────
// When a user signs up or logs in, claim any reports created with their email
// that don't yet have a user_id. This bridges the gap between the email-only
// onboarding flow and the authenticated dashboard.
//
// Called automatically from the auth callback and can be called from the client
// after account creation.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit } from '@/lib/rate-limit';
import { authLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  // Rate limit: 10 link attempts per 15 minutes per IP
  const rateLimitResponse = await applyRateLimit(request, {
    prefix: 'link-reports',
    limit: 10,
    windowSeconds: 900,
  });
  if (rateLimitResponse) return rateLimitResponse;
  try {
    // Get the authenticated user from the session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Use admin client to update reports (bypasses RLS)
    const admin = createAdminClient();

    // Find all reports matching this email that have no user_id
    const { data: unlinkedReports, error: fetchError } = await admin
      .from('reports')
      .select('id')
      .eq('client_email', user.email.toLowerCase())
      .is('user_id', null);

    if (fetchError) {
      authLogger.error({ err: fetchError.message }, 'Failed to find unlinked reports');
      return NextResponse.json(
        { error: 'Failed to link reports' },
        { status: 500 }
      );
    }

    if (!unlinkedReports || unlinkedReports.length === 0) {
      return NextResponse.json({ linked: 0 });
    }

    // Claim all unlinked reports
    const reportIds = unlinkedReports.map((r) => r.id);
    const { error: updateError } = await admin
      .from('reports')
      .update({ user_id: user.id })
      .in('id', reportIds)
      .is('user_id', null); // Safety: only claim unclaimed reports

    if (updateError) {
      authLogger.error({ err: updateError.message }, 'Failed to update reports');
      return NextResponse.json(
        { error: 'Failed to link reports' },
        { status: 500 }
      );
    }

    authLogger.info(
      { linkedCount: reportIds.length, userId: user.id, email: user.email },
      '[link-reports] Reports linked to user'
    );

    return NextResponse.json({ linked: reportIds.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    authLogger.error({ err: message }, 'Unhandled error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
