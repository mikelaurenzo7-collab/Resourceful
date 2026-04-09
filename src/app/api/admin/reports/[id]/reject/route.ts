// ─── Admin Reject Report API ─────────────────────────────────────────────────
// POST: Verify admin, require notes in body, record approval_event with
// rejection, update report status, send internal alert.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin, createApprovalEvent } from '@/lib/repository/admin';
import { getReportById, updateReportStatus } from '@/lib/repository/reports';
import { adminRejectSchema } from '@/lib/validations/report';
import { sendReportRejectionAlert } from '@/lib/services/resend-email';
import { apiLogger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
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

    // ── Parse and validate input ───────────────────────────────────────────
    const body = await request.json();
    const parsed = adminRejectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
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
          error: `Report status is '${report.status}' — must be 'pending_approval' to reject`,
        },
        { status: 400 }
      );
    }

    // ── Record approval event with rejection ───────────────────────────────
    await createApprovalEvent({
      report_id: reportId,
      admin_user_id: user.id,
      action: 'rejected',
      section_name: null,
      notes: parsed.data.notes,
    });

    // ── Update report status ───────────────────────────────────────────────
    await updateReportStatus(reportId, 'rejected');

    // ── Send internal alert ────────────────────────────────────────────────
    const propertyAddress = [
      report.property_address,
      report.city,
      report.state,
    ]
      .filter(Boolean)
      .join(', ');

    sendReportRejectionAlert({
      reportId,
      propertyAddress,
      notes: parsed.data.notes,
    }).catch((err) => {
      apiLogger.error({ err: err }, 'Failed to send rejection alert');
    });

    return NextResponse.json(
      {
        message: 'Report rejected',
        reportId,
        status: 'rejected',
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message }, 'Unhandled error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
