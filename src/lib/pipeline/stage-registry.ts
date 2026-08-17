import { createAdminClient } from '@/lib/supabase/admin';
import type { PropertyType, ServiceType } from '@/types/database';

import { shouldSkipGuidanceStage, shouldSkipIncomeStage } from './stage-policy';
import { runDataCollection } from './stages/stage1-data-collection';
import { runComparables } from './stages/stage2-comparables';
import { runIncomeAnalysis } from './stages/stage3-income-analysis';
import { runPhotoAnalysis } from './stages/stage4-photo-analysis';
import { runNarratives } from './stages/stage5-narratives';
import { runFilingGuide } from './stages/stage6-filing-guide';
import { runPdfAssembly } from './stages/stage7-pdf-assembly';

export interface StageResult {
  success: boolean;
  error?: string;
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export interface PipelineStageDefinition {
  number: number;
  name: string;
  skipWhen?: (propertyType: PropertyType, serviceType: ServiceType) => boolean;
  run: (reportId: string, supabase: SupabaseAdmin) => Promise<StageResult>;
}

export const PIPELINE_STAGES: readonly PipelineStageDefinition[] = [
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
    skipWhen: shouldSkipIncomeStage,
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
    skipWhen: shouldSkipGuidanceStage,
    run: runFilingGuide,
  },
  {
    number: 7,
    name: 'stage-7-pdf',
    run: runPdfAssembly,
  },
] as const;

export function getPipelineStage(stageNumber: number): PipelineStageDefinition {
  const stage = PIPELINE_STAGES.find((candidate) => candidate.number === stageNumber);
  if (!stage) {
    throw new Error(`Unknown pipeline stage: ${stageNumber}`);
  }
  return stage;
}
