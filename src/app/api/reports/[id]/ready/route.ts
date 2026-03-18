// ─── Report Ready Trigger ────────────────────────────────────────────────────
// Called when the customer signals they're done uploading photos (or skips).
// Triggers the pipeline immediately instead of waiting for the 14-hour cron.
//
// Idempotent: if the pipeline has already started or the report isn't in
// 'paid' status, this is a no-op and returns success.
//
// No auth required — keyed by report UUID (unguessable), same as report viewer.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { applyRateLimit } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params;

  // Rate limit: 10 requests per 15 minutes per IP
  const rateLimited = await applyRateLimit(request, {
    prefix: 'report-ready',
    limit: 10,
    windowSeconds: 900,
  });
  if (rateLimited) return rateLimited;

  try {
    const supabase = createAdminClient();

    // ── Fetch report status ─────────────────────────────────────────────
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('id, status, pipeline_started_at')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // ── Idempotency: only trigger if paid and pipeline hasn't started ───
    if (report.status !== 'paid') {
      // Report is already processing, pending_approval, delivered, etc.
      // This is fine — return success without doing anything.
      return NextResponse.json({
        triggered: false,
        reason: `Report already in '${report.status}' status`,
      });
    }

    if (report.pipeline_started_at) {
      // Pipeline already running
      return NextResponse.json({
        triggered: false,
        reason: 'Pipeline already started',
      });
    }

    // ── Trigger the pipeline ────────────────────────────────────────────
    console.log(`[api/reports/${reportId}/ready] Customer signaled ready — triggering pipeline`);

    runPipeline(reportId).catch((err) => {
      console.error(`[api/reports/${reportId}/ready] Pipeline failed:`, err);
    });

    return NextResponse.json({
      triggered: true,
      message: 'Report generation started. You\'ll receive an email when it\'s ready.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/reports/${reportId}/ready] Error: ${message}`);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
