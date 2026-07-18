// ─── Pipeline Orchestrator ───────────────────────────────────────────────────
// Runs report-generation stages 1-7 sequentially, then routes the immutable
// artifact to the admin approval queue. Delivery is a separate, verified action.

import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminNotification } from '@/lib/services/resend-email';
import { getAppUrl } from '@/lib/utils/app-url';

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

export interface StageResult {
  success: boolean;
  error?: string;
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

interface StageDefinition {
  number: number;
  name: string;
  skipWhen?: (propertyType: PropertyType, serviceType: string) => boolean;
  run: (reportId: string, supabase: SupabaseAdmin) => Promise<StageResult>;
}

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
    // Income analysis is later admitted to the PDF only when the deterministic
    // property-type and evidence policies classify it as supported.
    skipWhen: (propertyType) =>
      propertyType !== 'commercial' &&
      propertyType !== 'industrial' &&
      propertyType !== 'residential' &&
      propertyType !== 'agricultural',
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
    // Generates filing guidance for tax appeals and assignment-specific guidance
    // for pre-purchase and pre-listing reports.
    run: runFilingGuide,
  },
  {
    number: 7,
    name: 'stage-7-pdf',
    run: runPdfAssembly,
  },
];

export async function runPipeline(
  reportId: string,
  startFromStage: number = 1
): Promise<StageResult> {
  const supabase = createAdminClient();

  const { data: lockAcquired, error: lockError } = await acquirePipelineLock(
    supabase,
    reportId
  );

  if (lockError) {
    pipelineLogger.error(
      { reportId, error: lockError.message },
      'Failed to acquire pipeline lock'
    );
    return { success: false, error: `Failed to acquire pipeline lock: ${lockError.message}` };
  }

  if (!lockAcquired) {
    pipelineLogger.warn({ reportId }, 'Could not acquire lock — pipeline already running');
    return { success: false, error: 'Pipeline already running for this report' };
  }

  const { data, error: fetchError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();
  const report = data as Report | null;

  if (fetchError || !report) {
    const message = fetchError?.message ?? 'not found';
    pipelineLogger.error({ reportId, error: message }, 'Failed to fetch report');
    await releasePipelineLock(supabase, reportId);
    return { success: false, error: `Failed to fetch report ${reportId}: ${message}` };
  }

  await supabase
    .from('reports')
    .update({
      status: 'processing' as const,
      pipeline_started_at: new Date().toISOString(),
      pipeline_error_log: null,
    })
    .eq('id', reportId);

  pipelineLogger.info({ reportId, startFromStage }, 'Starting pipeline');

  try {
    for (const stage of STAGES) {
      if (stage.number < startFromStage) {
        pipelineLogger.info(
          { reportId, stage: stage.name, stageNumber: stage.number },
          'Skipping stage — already completed'
        );
        continue;
      }

      if (stage.skipWhen?.(report.property_type as PropertyType, report.service_type)) {
        pipelineLogger.info(
          { reportId, stage: stage.name, propertyType: report.property_type },
          'Skipping stage — not applicable'
        );
        continue;
      }

      pipelineLogger.info(
        { reportId, stage: stage.name, stageNumber: stage.number },
        'Running stage'
      );
      const stageStart = Date.now();
      const stageTimeoutMs = 10 * 60 * 1000;

      try {
        const result = await Promise.race([
          stage.run(reportId, supabase),
          new Promise<StageResult>((_, reject) =>
            setTimeout(
              () => reject(
                new Error(
                  `Stage ${stage.number} (${stage.name}) timed out after ${stageTimeoutMs / 1000}s`
                )
              ),
              stageTimeoutMs
            )
          ),
        ]);

        if (!result.success) {
          await handleStageFailure(
            supabase,
            reportId,
            stage,
            result.error ?? 'Unknown error'
          );
          return {
            success: false,
            error: `Stage ${stage.number} (${stage.name}) failed: ${result.error}`,
          };
        }

        pipelineLogger.info(
          { reportId, stage: stage.name, durationMs: Date.now() - stageStart },
          'Stage completed'
        );

        await supabase
          .from('reports')
          .update({ pipeline_last_completed_stage: stage.name })
          .eq('id', reportId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        await handleStageFailure(supabase, reportId, stage, message, stack);
        return {
          success: false,
          error: `Stage ${stage.number} (${stage.name}) threw: ${message}`,
        };
      }
    }

    await supabase
      .from('reports')
      .update({ pipeline_completed_at: new Date().toISOString() })
      .eq('id', reportId);

    pipelineLogger.info(
      { reportId },
      'Stages 1-7 complete — routing verified artifact to admin approval'
    );
    await supabase
      .from('reports')
      .update({ status: 'pending_approval' as const })
      .eq('id', reportId);

    try {
      const adminReviewUrl = `${getAppUrl()}/admin/reports/${encodeURIComponent(reportId)}/review`;
      await sendAdminNotification({
        reportId,
        propertyAddress: report.property_address,
        propertyType: report.property_type,
        reviewUrl: adminReviewUrl,
        clientEmail: report.client_email || undefined,
        county: report.county || undefined,
      });
    } catch (emailError) {
      pipelineLogger.error(
        {
          reportId,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        },
        'Failed to send admin notification email'
      );
    }

    pipelineLogger.info({ reportId }, 'Pipeline complete — pending admin approval');
    return { success: true };
  } finally {
    try {
      const { error: releaseError } = await releasePipelineLock(supabase, reportId);
      if (releaseError) throw new Error(releaseError.message);
    } catch (error) {
      pipelineLogger.error(
        { reportId, error: error instanceof Error ? error.message : String(error) },
        'CRITICAL: Failed to release pipeline lock — report may remain stuck'
      );
    }
  }
}

async function handleStageFailure(
  supabase: SupabaseAdmin,
  reportId: string,
  stage: StageDefinition,
  errorMessage: string,
  errorStack?: string
) {
  pipelineLogger.error(
    { reportId, stage: stage.name, stageNumber: stage.number, error: errorMessage },
    'Stage failed'
  );

  await supabase
    .from('reports')
    .update({
      status: 'failed' as const,
      pipeline_error_log: {
        stage: stage.name,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        stack: errorStack ?? errorMessage,
      },
    })
    .eq('id', reportId);
}
