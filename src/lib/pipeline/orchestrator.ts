// ─── Pipeline Orchestrator ───────────────────────────────────────────────────
// Runs report generation stages 1-7 sequentially, then routes to admin
// for approval. Stage 8 (delivery) is admin-triggered, not automated.
//
// Triggered by the cron job at /api/cron/photo-reminders (~14 hours after
// payment) to allow photo uploads before running. NOT triggered by the
// Stripe webhook — the webhook only marks reports as 'paid'.
//
// After each stage, writes completion to pipeline_last_completed_stage.
// On failure, writes error to pipeline_error_log JSONB and halts.
// Can be resumed from the last successful stage.

import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminNotification } from '@/lib/services/resend-email';

import type { PropertyType, Report } from '@/types/database';

// Maximum time the entire pipeline is allowed to run before being killed.
// 10 minutes accounts for Vercel cold starts + Puppeteer PDF rendering.
const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Retry configuration for transient failures (network timeouts, 5xx errors)
const MAX_STAGE_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 2000;

/** Returns true if the error is likely transient and worth retrying. */
function isTransientError(error: string): boolean {
  const transient = [
    'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND',
    'fetch failed', 'network', 'timeout', 'socket hang up',
    '502', '503', '504', '429',
  ];
  const lower = error.toLowerCase();
  return transient.some((t) => lower.includes(t.toLowerCase()));
}

/** Wait with exponential backoff: 2s, 4s */
function retryDelay(attempt: number): number {
  return RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
}

import { runDataCollection } from './stages/stage1-data-collection';
import { runComparables } from './stages/stage2-comparables';
import { runPhotoAnalysis } from './stages/stage4-photo-analysis';
import { runNarratives } from './stages/stage5-narratives';
import { runFilingGuide } from './stages/stage6-filing-guide';
import { runPdfAssembly } from './stages/stage7-pdf-assembly';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StageResult {
  success: boolean;
  error?: string;
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

interface StageDefinition {
  number: number;
  name: string;
  /** Return true to skip this stage for the given property/service type */
  skipWhen?: (propertyType: PropertyType, serviceType: string) => boolean;
  run: (reportId: string, supabase: SupabaseAdmin) => Promise<StageResult>;
}

// ─── Stage Registry ─────────────────────────────────────────────────────────

// Stage keys stored in pipeline_last_completed_stage (text column).
// These match the spec's naming convention exactly.
const STAGES: StageDefinition[] = [
  {
    number: 1,
    name: 'stage-1-data',
    run: runDataCollection,
  },
  {
    number: 2,
    name: 'stage-2-comps',
    run: runComparables,
  },
  {
    number: 4,
    name: 'stage-4-photos',
    run: runPhotoAnalysis,
  },
  {
    number: 5,
    name: 'stage-5-narratives',
    run: runNarratives,
  },
  {
    number: 6,
    name: 'stage-6-filing',
    // Filing guide is only relevant for tax appeals
    skipWhen: (_pt, st) => st !== 'tax_appeal',
    run: runFilingGuide,
  },
  {
    number: 7,
    name: 'stage-7-pdf',
    run: runPdfAssembly,
  },
];

// ─── Orchestrator ───────────────────────────────────────────────────────────

/**
 * Run the full report generation pipeline, or resume from a given stage.
 *
 * @param reportId       UUID of the report to process
 * @param startFromStage 1-indexed stage number to resume from (default: 1)
 */
export async function runPipeline(
  reportId: string,
  startFromStage: number = 1
): Promise<StageResult> {
  const supabase = createAdminClient();

  // ── Acquire pipeline lock (prevents concurrent runs for same report) ──
  // Uses row-level locking (v2) instead of advisory locks, which are
  // session-scoped and unreliable with connection poolers (Supabase/Vercel).
  // The lock auto-expires after 15 minutes to prevent stale locks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lockAcquired } = await (supabase.rpc as any)('acquire_pipeline_lock_v2', {
    p_report_id: reportId,
  });

  if (!lockAcquired) {
    console.warn(`[pipeline] Could not acquire lock for report ${reportId} — pipeline already running`);
    return { success: false, error: 'Pipeline already running for this report' };
  }

  // ── Fetch report ────────────────────────────────────────────────────────
  const { data, error: fetchError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();

  const report = data as Report | null;

  if (fetchError || !report) {
    const msg = `Failed to fetch report ${reportId}: ${fetchError?.message ?? 'not found'}`;
    console.error(`[pipeline] ${msg}`);
    await (supabase.rpc as any)('release_pipeline_lock_v2', { p_report_id: reportId });
    return { success: false, error: msg };
  }

  // ── Run the pipeline with a timeout ──────────────────────────────────
  const timeoutPromise = new Promise<StageResult>((_, reject) => {
    setTimeout(() => reject(new Error(`Pipeline timed out after ${PIPELINE_TIMEOUT_MS / 1000}s`)), PIPELINE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      runPipelineStages(reportId, report, supabase, startFromStage),
      timeoutPromise,
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] Pipeline timeout or fatal error for report ${reportId}: ${message}`);

    // Mark report as failed with timeout error
    await supabase
      .from('reports')
      .update({
        status: 'failed' as const,
        pipeline_error_log: {
          stage: 'timeout',
          error: message,
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', reportId);

    await (supabase.rpc as any)('release_pipeline_lock_v2', { p_report_id: reportId });
    return { success: false, error: message };
  }
}

/**
 * Internal: run all pipeline stages sequentially. Wrapped by runPipeline
 * which enforces the overall timeout.
 */
async function runPipelineStages(
  reportId: string,
  report: Report,
  supabase: ReturnType<typeof createAdminClient>,
  startFromStage: number
): Promise<StageResult> {
  // ── Mark pipeline start ─────────────────────────────────────────────────
  await supabase
    .from('reports')
    .update({
      status: 'processing' as const,
      pipeline_started_at: new Date().toISOString(),
      pipeline_error_log: null,
    })
    .eq('id', reportId);

  console.log(
    `[pipeline] Starting pipeline for report ${reportId} from stage ${startFromStage}`
  );

  // ── Run stages sequentially ─────────────────────────────────────────────
  for (const stage of STAGES) {
    // Skip stages before our resume point
    if (stage.number < startFromStage) {
      console.log(`[pipeline] Skipping stage ${stage.number} (${stage.name}) — already completed`);
      continue;
    }

    // Skip stages that don't apply to this property/service type
    if (stage.skipWhen?.(report.property_type as PropertyType, report.service_type ?? 'tax_appeal')) {
      console.log(
        `[pipeline] Skipping stage ${stage.number} (${stage.name}) — not applicable for ${report.property_type}`
      );
      continue;
    }

    console.log(`[pipeline] Running stage ${stage.number}: ${stage.name}`);
    const stageStart = Date.now();

    let lastError = '';
    let stageSucceeded = false;

    for (let attempt = 0; attempt <= MAX_STAGE_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = retryDelay(attempt - 1);
          console.log(`[pipeline] Retrying stage ${stage.number} (attempt ${attempt + 1}/${MAX_STAGE_RETRIES + 1}) after ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
        }

        const result = await stage.run(reportId, supabase);

        if (result.success) {
          stageSucceeded = true;
          break;
        }

        lastError = result.error ?? 'Unknown error';

        // Only retry transient errors
        if (!isTransientError(lastError)) {
          break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);

        // Only retry transient errors
        if (!isTransientError(lastError)) {
          break;
        }
      }
    }

    if (!stageSucceeded) {
      await handleStageFailure(supabase, reportId, stage, lastError);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.rpc as any)('release_pipeline_lock_v2', { p_report_id: reportId });
      return { success: false, error: `Stage ${stage.number} (${stage.name}) failed: ${lastError}` };
    }

    const durationMs = Date.now() - stageStart;
    console.log(
      `[pipeline] Stage ${stage.number} (${stage.name}) completed in ${durationMs}ms`
    );

    // Record stage completion
    await supabase
      .from('reports')
      .update({
        pipeline_last_completed_stage: stage.name,
      })
      .eq('id', reportId);
  }

  // ── Pipeline stages 1-7 complete ────────────────────────────────────────
  await supabase
    .from('reports')
    .update({
      pipeline_completed_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  // ALL reports route to admin for approval — no auto-delivery.
  // Admin must review and approve every report before it reaches the client.
  console.log(`[pipeline] Stages 1-7 complete for report ${reportId}. Routing to admin for approval (review_tier: ${report.review_tier}).`);
  await supabase
    .from('reports')
    .update({ status: 'pending_approval' as const })
    .eq('id', reportId);

  // ── Notify admin (non-blocking, for monitoring) ───────────────────────
  try {
    const adminReviewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/reports/${reportId}/review`;
    await sendAdminNotification({
      reportId,
      propertyAddress: report.property_address,
      propertyType: report.property_type ?? 'residential',
      reviewUrl: adminReviewUrl,
    });
  } catch (emailErr) {
    console.error(`[pipeline] Failed to send admin notification email:`, emailErr);
  }

  // ── Release pipeline lock ───────────────────────────────────────────────
  await (supabase.rpc as any)('release_pipeline_lock_v2', { p_report_id: reportId });

  console.log(`[pipeline] Pipeline complete for report ${reportId}. Awaiting admin approval.`);
  return { success: true };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function handleStageFailure(
  supabase: SupabaseAdmin,
  reportId: string,
  stage: StageDefinition,
  errorMessage: string
) {
  console.error(
    `[pipeline] Stage ${stage.number} (${stage.name}) failed: ${errorMessage}`
  );

  const errorLog = {
    stage: stage.name,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    stack: errorMessage,
  };

  await supabase
    .from('reports')
    .update({
      status: 'failed' as const,
      pipeline_error_log: errorLog,
    })
    .eq('id', reportId);
}
