// ─── Pipeline Orchestrator ───────────────────────────────────────────────────
// Runs report generation stages 1-8 sequentially, auto-delivering the
// completed report to the client via email with a signed PDF URL.
//
// After each stage, writes completion to pipeline_last_completed_stage.
// On failure, writes error to pipeline_error_log JSONB and halts.
// Can be resumed from the last successful stage.

import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminNotification } from '@/lib/services/resend-email';

import type { PropertyType, ReviewTier, Report } from '@/types/database';
import { REPORT_STATUS } from '@/lib/utils/valuation-math';

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

// ─── Tier Labels ────────────────────────────────────────────────────────────
// Human-readable labels for admin notifications and dashboard display.

const TIER_LABELS: Record<ReviewTier, string> = {
  auto: 'Standard Review',
  expert_reviewed: 'Expert Appraiser Review Required',
  guided_filing: 'Guided Filing Session Required',
  full_representation: 'Team Files on Behalf of Client',
};

export { TIER_LABELS };

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

// ─── RPC Helper ─────────────────────────────────────────────────────────
// Supabase's generated types may not include custom RPC functions like
// acquire_pipeline_lock / release_pipeline_lock. This helper avoids
// casting to `any` by going through `unknown` to a typed callable.

type RpcFn = (
  fn: string,
  params: Record<string, unknown>
) => ReturnType<SupabaseAdmin['rpc']>;

function rpc(supabase: SupabaseAdmin): RpcFn {
  return supabase.rpc as unknown as RpcFn;
}

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
  const { data: lockAcquired } = await rpc(supabase)('acquire_pipeline_lock', {
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
    await rpc(supabase)('release_pipeline_lock', { p_report_id: reportId });
    return { success: false, error: msg };
  }

  // ── Mark pipeline start ─────────────────────────────────────────────────
  await supabase
    .from('reports')
    .update({
      status: REPORT_STATUS.PROCESSING,
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
        await rpc(supabase)('release_pipeline_lock', { p_report_id: reportId });
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
      await handleStageFailure(supabase, reportId, stage, message);
      await rpc(supabase)('release_pipeline_lock', { p_report_id: reportId });
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

  // ── Tier-aware post-pipeline routing ──────────────────────────────────
  // EVERY report routes to admin for human-in-the-loop approval. No report
  // reaches a client without explicit admin sign-off. The review_tier
  // determines what the admin needs to do beyond the standard quality check.
  //
  // Tier routing:
  //   auto             → Admin reviews AI output, approves, Stage 8 delivers
  //   expert_reviewed  → Admin + licensed appraiser review, then delivery
  //   guided_filing    → Admin + appraiser review, then delivery + scheduling
  //                      a guided filing session (screen share / call)
  //   full_representation → Admin + appraiser review, then OUR TEAM files
  //                         the appeal on behalf of the client via the
  //                         county portal, then delivers report + confirmation
  //
  const reviewTier = (report.review_tier as ReviewTier) ?? 'auto';
  const tierLabel = TIER_LABELS[reviewTier] ?? 'Standard Review';

  console.log(
    `[pipeline] Stages 1-7 complete for report ${reportId}. ` +
    `Tier: ${reviewTier} (${tierLabel}). Routing to admin for approval.`
  );

  await supabase
    .from('reports')
    .update({ status: REPORT_STATUS.PENDING_APPROVAL })
    .eq('id', reportId);

  // ── Notify admin with tier context (non-blocking) ─────────────────────
  try {
    const adminReviewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/reports/${reportId}/review`;
    await sendAdminNotification({
      reportId,
      propertyAddress: report.property_address,
      propertyType: report.property_type ?? 'residential',
      reviewUrl: adminReviewUrl,
      reviewTier,
      tierLabel,
    });
  } catch (emailErr) {
    console.error(`[pipeline] Failed to send admin notification email:`, emailErr);
  }

  // ── Release pipeline lock ───────────────────────────────────────────────
  await rpc(supabase)('release_pipeline_lock', { p_report_id: reportId });

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
      status: REPORT_STATUS.FAILED,
      pipeline_error_log: errorLog,
    })
    .eq('id', reportId);
}
