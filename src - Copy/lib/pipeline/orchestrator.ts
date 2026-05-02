// ─── Pipeline Orchestrator ───────────────────────────────────────────────────
// Runs report generation stages 1-8 sequentially, auto-delivering the
// completed report to the client via email with a signed PDF URL.
//
// After each stage, writes completion to pipeline_last_completed_stage.
// On failure, writes error to pipeline_error_log JSONB and halts.
// Can be resumed from the last successful stage.

import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminNotification } from '@/lib/services/resend-email';

import type { PropertyType, Report } from '@/types/database';

import { runDataCollection } from './stages/stage1-data-collection';
import { runComparables } from './stages/stage2-comparables';
import { runIncomeAnalysis } from './stages/stage3-income-analysis';
import { runPhotoAnalysis } from './stages/stage4-photo-analysis';
import { runNarratives } from './stages/stage5-narratives';
import { runFilingGuide } from './stages/stage6-filing-guide';
import { runPdfAssembly } from './stages/stage7-pdf-assembly';
import { pipelineLogger } from '@/lib/logger';
import { acquirePipelineLock, releasePipelineLock } from '@/lib/supabase/rpc';

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
    number: 3,
    name: 'stage-3-income',
    // Run for commercial, industrial, agricultural, and multi-family residential (income-producing)
    skipWhen: (pt, _st) => pt !== 'commercial' && pt !== 'industrial' && pt !== 'residential' && pt !== 'agricultural',
    run: runIncomeAnalysis,
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
    // Generates filing guide (tax_appeal), negotiation guide (pre_purchase),
    // or pricing strategy guide (pre_listing) — every service type gets guidance
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
  const { data: lockAcquired, error: lockError } = await acquirePipelineLock(supabase, reportId);

  if (lockError) {
    pipelineLogger.error({ reportId, err: lockError.message }, 'Failed to acquire pipeline lock');
    return { success: false, error: `Failed to acquire pipeline lock: ${lockError.message}` };
  }

  if (!lockAcquired) {
    pipelineLogger.warn({ reportId }, 'Could not acquire lock — pipeline already running');
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
    const msg = fetchError?.message ?? 'not found';
    pipelineLogger.error({ reportId, err: msg }, 'Failed to fetch report');
    await releasePipelineLock(supabase, reportId);
    return { success: false, error: `Failed to fetch report ${reportId}: ${msg}` };
  }

  // ── Mark pipeline start ─────────────────────────────────────────────────
  await supabase
    .from('reports')
    .update({
      status: 'processing' as const,
      pipeline_started_at: new Date().toISOString(),
      pipeline_error_log: null,
    })
    .eq('id', reportId);

  pipelineLogger.info({ reportId, startFromStage }, 'Starting pipeline');

  // Wrap all stage execution in try-finally to GUARANTEE lock release.
  // Without this, an uncaught exception could leave the lock held forever.
  try {
    // ── Run stages sequentially ───────────────────────────────────────────
    for (const stage of STAGES) {
      // Skip stages before our resume point
      if (stage.number < startFromStage) {
        pipelineLogger.info({ reportId, stage: stage.name, stageNumber: stage.number }, 'Skipping stage — already completed');
        continue;
      }

      // Skip stages that don't apply to this property/service type
      if (stage.skipWhen?.(report.property_type as PropertyType, report.service_type ?? 'tax_appeal')) {
        pipelineLogger.info({ reportId, stage: stage.name, propertyType: report.property_type }, 'Skipping stage — not applicable');
        continue;
      }

      pipelineLogger.info({ reportId, stage: stage.name, stageNumber: stage.number }, 'Running stage');
      const stageStart = Date.now();
      const STAGE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per stage

      try {
        const result = await Promise.race([
          stage.run(reportId, supabase),
          new Promise<StageResult>((_, reject) =>
            setTimeout(() => reject(new Error(`Stage ${stage.number} (${stage.name}) timed out after ${STAGE_TIMEOUT_MS / 1000}s`)), STAGE_TIMEOUT_MS)
          ),
        ]);

        if (!result.success) {
          await handleStageFailure(supabase, reportId, stage, result.error ?? 'Unknown error');
          return { success: false, error: `Stage ${stage.number} (${stage.name}) failed: ${result.error}` };
        }

        const durationMs = Date.now() - stageStart;
        pipelineLogger.info({ reportId, stage: stage.name, durationMs }, 'Stage completed');

        // Record stage completion
        await supabase
          .from('reports')
          .update({
            pipeline_last_completed_stage: stage.name,
          })
          .eq('id', reportId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        await handleStageFailure(supabase, reportId, stage, message, stack);
        return { success: false, error: `Stage ${stage.number} (${stage.name}) threw: ${message}` };
      }
    }

    // ── Pipeline stages 1-7 complete ──────────────────────────────────────
    await supabase
      .from('reports')
      .update({
        pipeline_completed_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    // ALL reports route to admin for approval after Stage 7.
    // This is intentional during the quality-control training phase: the admin
    // reviews the AI's photo analysis and report narrative before the client
    // receives anything. Once real-appraisal training data is established,
    // high-confidence reports can be auto-delivered. Until then, every report
    // lands in the admin dashboard for a final human check.
    pipelineLogger.info({ reportId }, 'Stages 1-7 complete — routing to admin for approval');
    await supabase
      .from('reports')
      .update({ status: 'pending_approval' as const })
      .eq('id', reportId);

    // ── Notify admin (non-blocking, for monitoring) ─────────────────────
    try {
      const adminReviewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/reports/${reportId}/review`;
      // Fetch concluded value for admin context
      const { data: pdForAdmin } = await supabase
        .from('property_data')
        .select('assessed_value, concluded_value')
        .eq('report_id', reportId)
        .limit(1);
      const adminPd = pdForAdmin?.[0] as { assessed_value: number | null; concluded_value: number | null } | undefined;
      const adminSavings = (adminPd?.assessed_value && adminPd?.concluded_value)
        ? Math.max(0, adminPd.assessed_value - adminPd.concluded_value)
        : undefined;

      await sendAdminNotification({
        reportId,
        propertyAddress: report.property_address,
        propertyType: report.property_type ?? 'residential',
        reviewUrl: adminReviewUrl,
        clientEmail: report.client_email ?? undefined,
        concludedValue: adminPd?.concluded_value ?? undefined,
        assessedValue: adminPd?.assessed_value ?? undefined,
        potentialSavings: adminSavings,
        county: report.county ?? undefined,
      });
    } catch (emailErr) {
      pipelineLogger.error({ err: emailErr, reportId }, 'Failed to send admin notification email');
    }

    pipelineLogger.info({ reportId }, 'Pipeline complete — pending admin approval');
    return { success: true };
  } finally {
    // ALWAYS release the pipeline lock, even on unexpected errors
    try {
      const { error: lockError } = await releasePipelineLock(supabase, reportId);
      if (lockError) {
        throw new Error(lockError.message);
      }
    } catch (lockErr) {
      pipelineLogger.error(
        { err: lockErr, reportId },
        'CRITICAL: Failed to release pipeline lock — report may be permanently stuck'
      );
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function handleStageFailure(
  supabase: SupabaseAdmin,
  reportId: string,
  stage: StageDefinition,
  errorMessage: string,
  errorStack?: string
) {
  pipelineLogger.error(
    { reportId, stage: stage.name, stageNumber: stage.number, err: errorMessage },
    'Stage failed'
  );

  const errorLog = {
    stage: stage.name,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    stack: errorStack ?? errorMessage,
  };

  await supabase
    .from('reports')
    .update({
      status: 'failed' as const,
      pipeline_error_log: errorLog,
    })
    .eq('id', reportId);
}
