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

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StageResult {
  success: boolean;
  error?: string;
  /** When true, the pipeline pauses (e.g. for human review) without failing */
  paused?: boolean;
  /** Reason for pause — maps to a report status (e.g. 'photo_review') */
  pauseReason?: string;
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
    // Only run for commercial and industrial properties
    skipWhen: (pt, _st) => pt !== 'commercial' && pt !== 'industrial',
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
  const { data: lockAcquired } = await (supabase.rpc as any)('acquire_pipeline_lock', {
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
    await (supabase.rpc as any)('release_pipeline_lock', { p_report_id: reportId });
    return { success: false, error: msg };
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

    try {
      const result = await stage.run(reportId, supabase);

      if (!result.success) {
        await handleStageFailure(supabase, reportId, stage, result.error ?? 'Unknown error');
        await (supabase.rpc as any)('release_pipeline_lock', { p_report_id: reportId });
        return { success: false, error: `Stage ${stage.number} (${stage.name}) failed: ${result.error}` };
      }

      // Handle pipeline pause (e.g. human-in-the-loop photo review)
      if (result.paused) {
        const pauseStatus = result.pauseReason ?? 'photo_review';
        console.log(
          `[pipeline] Stage ${stage.number} (${stage.name}) paused pipeline. ` +
          `Setting status to '${pauseStatus}'. Pipeline will resume when admin completes review.`
        );
        await supabase
          .from('reports')
          .update({ status: pauseStatus as any })
          .eq('id', reportId);
        await (supabase.rpc as any)('release_pipeline_lock', { p_report_id: reportId });
        return { success: true, paused: true, pauseReason: pauseStatus };
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await handleStageFailure(supabase, reportId, stage, message);
      await (supabase.rpc as any)('release_pipeline_lock', { p_report_id: reportId });
      return { success: false, error: `Stage ${stage.number} (${stage.name}) threw: ${message}` };
    }
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
  await (supabase.rpc as any)('release_pipeline_lock', { p_report_id: reportId });

  console.log(`[pipeline] Pipeline complete and delivered for report ${reportId}`);
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
