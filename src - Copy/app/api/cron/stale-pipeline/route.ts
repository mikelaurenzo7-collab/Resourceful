// ─── Stale Pipeline Detector ─────────────────────────────────────────────────
// Hourly cron that detects reports stuck in 'paid' or 'processing' status
// for longer than expected. If a pipeline crashes without setting 'failed',
// the report is permanently stuck — this cron catches those cases.
//
// Actions:
// - Reports stuck in 'paid' for >1 hour: pipeline never started → auto-retry
// - Reports stuck in 'processing' for >2 hours: pipeline hung → mark failed
// - Sends admin alert for any stuck reports found
//
// Vercel cron: "15 * * * *" (every hour at :15)

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { sendAdminNotification } from '@/lib/services/resend-email';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { cronLogger } from '@/lib/logger';
import { releasePipelineLock } from '@/lib/supabase/rpc';

const PAID_STALE_THRESHOLD_MS = 60 * 60 * 1000;       // 1 hour
const PROCESSING_STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_AUTO_RETRIES = 2;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const supabase = createAdminClient();
  const now = Date.now();

  const paidCutoff = new Date(now - PAID_STALE_THRESHOLD_MS).toISOString();
  const processingCutoff = new Date(now - PROCESSING_STALE_THRESHOLD_MS).toISOString();

  try {
    // ── Find reports stuck in 'paid' (pipeline never started) ──────────
    const { data: stalePaid } = await supabase
      .from('reports')
      .select('id, property_address, city, state, client_email, created_at, pipeline_error_log')
      .eq('status', 'paid')
      .lt('created_at', paidCutoff)
      .limit(20);

    let paidRetried = 0;
    let paidFailed = 0;

    for (const report of (stalePaid ?? []) as { id: string; property_address: string; city: string | null; state: string | null; client_email: string; created_at: string; pipeline_error_log: Record<string, unknown> | null }[]) {
      // Check if this report has already been auto-retried too many times
      const errorLog = report.pipeline_error_log;
      const retryCount = (errorLog as Record<string, unknown> & { auto_retry_count?: number })?.auto_retry_count ?? 0;

      if (retryCount >= MAX_AUTO_RETRIES) {
        // Too many retries — mark as failed for manual investigation
        cronLogger.warn({ reportId: report.id, retryCount }, '[stale-pipeline] Max auto-retries reached, marking failed');
        await supabase
          .from('reports')
          .update({
            status: 'failed' as const,
            pipeline_error_log: {
              stage: 'stale_pipeline_detector',
              error: `Report stuck in paid status after ${retryCount} auto-retry attempts`,
              timestamp: new Date().toISOString(),
              auto_retry_count: retryCount,
            },
          })
          .eq('id', report.id);
        paidFailed++;
        continue;
      }

      // Auto-retry: kick the pipeline
      cronLogger.info({ reportId: report.id, retryCount: retryCount + 1 }, '[stale-pipeline] Auto-retrying stuck paid report');

      // Record the retry attempt
      await supabase
        .from('reports')
        .update({
          pipeline_error_log: {
            stage: 'stale_pipeline_detector',
            error: 'Auto-retry: report was stuck in paid status',
            timestamp: new Date().toISOString(),
            auto_retry_count: retryCount + 1,
          },
        })
        .eq('id', report.id);

      // Fire and forget — the pipeline handles its own error recording
      runPipeline(report.id).catch((err) => {
        cronLogger.error({ reportId: report.id, err: String(err) }, '[stale-pipeline] Auto-retry pipeline failed');
      });

      paidRetried++;
    }

    // ── Find reports stuck in 'processing' (pipeline hung) ────────────
    const { data: staleProcessing } = await supabase
      .from('reports')
      .select('id, property_address, city, state, client_email, pipeline_started_at, pipeline_last_completed_stage')
      .eq('status', 'processing')
      .lt('pipeline_started_at', processingCutoff)
      .limit(20);

    let processingMarkedFailed = 0;

    for (const report of (staleProcessing ?? []) as { id: string; property_address: string; city: string | null; state: string | null; client_email: string; pipeline_started_at: string | null; pipeline_last_completed_stage: string | null }[]) {
      const stuckDurationMs = now - new Date(report.pipeline_started_at!).getTime();
      const stuckHours = (stuckDurationMs / 3_600_000).toFixed(1);

      cronLogger.warn(
        { reportId: report.id, stuckHours, lastStage: report.pipeline_last_completed_stage },
        '[stale-pipeline] Report stuck in processing — marking failed'
      );

      await supabase
        .from('reports')
        .update({
          status: 'failed' as const,
          pipeline_error_log: {
            stage: report.pipeline_last_completed_stage ?? 'unknown',
            error: `Pipeline hung for ${stuckHours}h — auto-marked as failed by stale detector`,
            timestamp: new Date().toISOString(),
          },
        })
        .eq('id', report.id);

      // Release any held pipeline lock
      try {
        const { error: lockError } = await releasePipelineLock(supabase, report.id);
        if (lockError) {
          throw new Error(lockError.message);
        }
      } catch {
        // Lock may not exist — that's fine
      }

      processingMarkedFailed++;
    }

    // ── Alert admin if any stuck reports were found ────────────────────
    const totalStuck = (stalePaid?.length ?? 0) + (staleProcessing?.length ?? 0);
    if (totalStuck > 0) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
        await sendAdminNotification({
          reportId: 'stale-pipeline-summary',
          propertyAddress: `${totalStuck} stuck report(s) detected`,
          propertyType: 'residential',
          reviewUrl: `${appUrl}/admin/reports?status=failed`,
          clientEmail: undefined,
          county: undefined,
        });
      } catch (emailErr) {
        cronLogger.error({ err: emailErr }, '[stale-pipeline] Failed to send admin alert');
      }
    }

    cronLogger.info(
      { stalePaid: stalePaid?.length ?? 0, paidRetried, paidFailed, staleProcessing: staleProcessing?.length ?? 0, processingMarkedFailed },
      '[stale-pipeline] Check complete'
    );

    return NextResponse.json({
      success: true,
      stalePaidFound: stalePaid?.length ?? 0,
      paidRetried,
      paidFailed,
      staleProcessingFound: staleProcessing?.length ?? 0,
      processingMarkedFailed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    cronLogger.error({ err: message }, '[stale-pipeline] Cron failed');
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
