// ─── Admin Resolve Appeal API ────────────────────────────────────────────────
// POST: Record the final outcome of an appeal (win, loss, or partial).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/repository/admin';
import { createApprovalEvent } from '@/lib/repository/admin';
import { getReportById } from '@/lib/repository/reports';

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

    // ── Verify report exists ─────────────────────────────────────────────
    const report = await getReportById(reportId);
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    if (
      report.filing_status !== 'filed' &&
      report.filing_status !== 'hearing_scheduled'
    ) {
      return NextResponse.json(
        {
          error: `Report filing_status is '${report.filing_status}' — must be 'filed' or 'hearing_scheduled' to resolve`,
        },
        { status: 400 }
      );
    }

    // ── Parse and validate body ──────────────────────────────────────────
    const body = await request.json();
    const { outcome, savings_amount_cents, notes } = body;

    if (!outcome || !['win', 'loss', 'partial'].includes(outcome)) {
      return NextResponse.json(
        { error: "outcome is required and must be 'win', 'loss', or 'partial'" },
        { status: 400 }
      );
    }

    // ── Update reports table ─────────────────────────────────────────────
    const admin = createAdminClient();

    const { error: updateError } = await admin
      .from('reports')
      .update({
        filing_status: outcome === 'loss' ? 'resolved_loss' : 'resolved_win',
        appeal_outcome: outcome,
        savings_amount_cents: savings_amount_cents ?? null,
      })
      .eq('id', reportId);

    if (updateError) {
      throw new Error(`Failed to update report: ${updateError.message}`);
    }

    // ── Record approval event ────────────────────────────────────────────
    await createApprovalEvent(
      {
        report_id: reportId,
        admin_user_id: user.id,
        action: 'edit_section',
        section_name: 'resolution',
        notes: `Appeal resolved: ${outcome}${savings_amount_cents ? `. Savings: ${savings_amount_cents} cents` : ''}${notes ? `. ${notes}` : ''}`,
      },
      admin
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/resolve] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
