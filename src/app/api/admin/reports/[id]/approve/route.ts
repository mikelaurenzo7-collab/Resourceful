// ─── Admin Approve Report API ────────────────────────────────────────────────
// POST: Verify admin user, call stage 8 delivery, record approval_event,
// update report status.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/repository/admin';
import { getReportById } from '@/lib/repository/reports';
import { runDelivery } from '@/lib/pipeline/stages/stage8-delivery';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    // ── Authenticate user ──────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ── Verify admin ───────────────────────────────────────────────────────
    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // ── Verify report exists ───────────────────────────────────────────────
    const report = await getReportById(reportId);
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    if (report.status !== 'pending_approval') {
      return NextResponse.json(
        {
          error: `Report status is '${report.status}' — must be 'pending_approval' to approve`,
        },
        { status: 400 }
      );
    }

    // ── Run delivery (stage 8) ─────────────────────────────────────────────
    const admin = createAdminClient();
    const deliveryResult = await runDelivery(reportId, user.id, admin);

    if (!deliveryResult.success) {
      return NextResponse.json(
        { error: `Delivery failed: ${deliveryResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Report approved and delivered',
        reportId,
        status: 'delivered',
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/approve] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
