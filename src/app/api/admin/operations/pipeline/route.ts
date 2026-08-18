import { NextResponse } from 'next/server';

import { getPipelineQueueHealth } from '@/lib/pipeline/queue';
import { isAdminWithEmailMatch } from '@/lib/repository/admin';
import { createClient } from '@/lib/supabase/server';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const admin = await isAdminWithEmailMatch(user.id, user.email);
  if (!admin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const health = await getPipelineQueueHealth();
    return NextResponse.json(
      {
        healthy:
          health.expired_lease_count === 0 &&
          (health.oldest_due_age_seconds ?? 0) < 10 * 60,
        queue: health,
        generatedAt: new Date().toISOString(),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
        generatedAt: new Date().toISOString(),
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
