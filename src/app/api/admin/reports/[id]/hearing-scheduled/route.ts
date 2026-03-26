// ─── Admin Schedule Hearing API ──────────────────────────────────────────────
// POST: Record that a hearing has been scheduled for an appeal.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/repository/admin';
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

    if (report.filing_status !== 'filed') {
      return NextResponse.json(
        {
          error: `Report filing_status is '${report.filing_status}' — must be 'filed' to schedule a hearing`,
        },
        { status: 400 }
      );
    }

    // ── Parse and validate body ──────────────────────────────────────────
    const body = await request.json();
    const { hearing_date, hearing_notes } = body;

    if (!hearing_date) {
      return NextResponse.json(
        { error: 'hearing_date is required' },
        { status: 400 }
      );
    }

    // ── Update reports table ─────────────────────────────────────────────
    const admin = createAdminClient();

    const { error: updateError } = await admin
      .from('reports')
      .update({
        filing_status: 'hearing_scheduled',
        hearing_date,
        hearing_notes: hearing_notes ?? null,
      })
      .eq('id', reportId);

    if (updateError) {
      throw new Error(`Failed to update report: ${updateError.message}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/hearing-scheduled] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
