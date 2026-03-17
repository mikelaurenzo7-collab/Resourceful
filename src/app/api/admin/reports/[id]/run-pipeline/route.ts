// ─── Admin Run Pipeline API ──────────────────────────────────────────────────
// POST: Trigger the report generation pipeline for a submitted report.
// Admin-only — allows controlling when and which reports get processed.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/repository/admin';
import { getReportById } from '@/lib/repository/reports';
import { runPipeline } from '@/lib/pipeline/orchestrator';

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

    if (report.status !== 'submitted') {
      return NextResponse.json(
        {
          error: `Report status is '${report.status}' — must be 'submitted' to start pipeline`,
        },
        { status: 400 }
      );
    }

    // ── Kick off pipeline (non-blocking) ───────────────────────────────────
    // Run in background — don't await. The pipeline updates status as it goes.
    runPipeline(reportId).catch((err) => {
      console.error(`[api/admin/run-pipeline] Pipeline error for ${reportId}:`, err);
    });

    return NextResponse.json(
      {
        message: 'Pipeline started',
        reportId,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/run-pipeline] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
