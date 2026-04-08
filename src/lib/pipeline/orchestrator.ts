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

  // Wrap all stage execution in try-finally to GUARANTEE lock release.
  // Without this, an uncaught exception could leave the lock held forever.
  try {
    // ── Run stages sequentially ───────────────────────────────────────────
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
    console.log(`[pipeline] Stages 1-7 complete for report ${reportId}. Routing to admin for approval.`);
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
      console.error(`[pipeline] Failed to send admin notification email:`, emailErr);
    }

    console.log(`[pipeline] Pipeline complete and delivered for report ${reportId}`);
    return { success: true };
  } finally {
    // ALWAYS release the pipeline lock, even on unexpected errors
    await (supabase.rpc as any)('release_pipeline_lock', { p_report_id: reportId });
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
  console.error(
    `[pipeline] Stage ${stage.number} (${stage.name}) failed: ${errorMessage}`
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
