// ─── Admin Approve Report API ────────────────────────────────────────────────
// POST: Verify admin user, set status to 'approved', send "report ready" email.
// In the pay-after model, approval does NOT deliver the report — it notifies
// the client that their report is ready and they can pay to unlock it.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/repository/admin';
import { createApprovalEvent } from '@/lib/repository/admin';
import { getReportById } from '@/lib/repository/reports';
import { sendReportReadyEmail } from '@/lib/services/resend-email';

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

    // ── Verify report exists and is in the right state ───────────────────
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

    // ── Set status to approved ───────────────────────────────────────────
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('reports')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq('id', reportId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to approve report: ${updateError.message}` },
        { status: 500 }
      );
    }

    // ── Record approval event ────────────────────────────────────────────
    await createApprovalEvent({
      report_id: reportId,
      admin_user_id: user.id,
      action: 'approved',
      notes: 'Report approved — awaiting client payment',
      section_name: null,
    });

    // ── Send "report ready" email (non-blocking) ─────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    sendReportReadyEmail({
      to: report.client_email ?? '',
      reportId,
      propertyAddress: [report.property_address, report.city, report.state].filter(Boolean).join(', '),
      concludedValue: 0, // Will be calculated by the email function
      assessedValue: 0,
      potentialSavings: 0,
      reportUrl: `${appUrl}/report/${reportId}`,
      priceCents: report.amount_paid_cents ?? 0,
    }).catch((err) => {
      console.error('[api/admin/approve] Failed to send report ready email:', err);
    });

    return NextResponse.json(
      {
        message: 'Report approved — client notified to pay and unlock',
        reportId,
        status: 'approved',
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
