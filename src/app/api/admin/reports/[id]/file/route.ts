// ─── Admin File Report API ───────────────────────────────────────────────────
// POST: Record that an appeal has been filed with the county.

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

    if (report.filing_status === 'filed') {
      return NextResponse.json(
        { error: 'Report has already been filed' },
        { status: 400 }
      );
    }

    // ── Parse and validate body ──────────────────────────────────────────
    const body = await request.json();
    const { filing_method, confirmation_number, notes } = body;

    if (!filing_method || !confirmation_number) {
      return NextResponse.json(
        { error: 'filing_method and confirmation_number are required' },
        { status: 400 }
      );
    }

    // ── Update reports table ─────────────────────────────────────────────
    const admin = createAdminClient();

    const { error: reportUpdateError } = await admin
      .from('reports')
      .update({
        filing_status: 'filed',
        filed_at: new Date().toISOString(),
        filing_method,
      })
      .eq('id', reportId);

    if (reportUpdateError) {
      throw new Error(`Failed to update report: ${reportUpdateError.message}`);
    }

    // ── Update form_submissions table ────────────────────────────────────
    const { error: formUpdateError } = await admin
      .from('form_submissions')
      .update({
        submission_status: 'submitted',
        confirmation_number,
        submitted_at: new Date().toISOString(),
        notes: notes ?? null,
      })
      .eq('report_id', reportId);

    if (formUpdateError) {
      throw new Error(
        `Failed to update form submissions: ${formUpdateError.message}`
      );
    }

    // ── Record approval event ────────────────────────────────────────────
    await createApprovalEvent(
      {
        report_id: reportId,
        admin_user_id: user.id,
        action: 'edit_section',
        section_name: 'filing',
        notes: `Appeal filed via ${filing_method}. Confirmation: ${confirmation_number}${notes ? `. ${notes}` : ''}`,
      },
      admin
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/file] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
