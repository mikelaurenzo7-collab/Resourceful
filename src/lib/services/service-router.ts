import { isIndependentValuationPurpose } from '@/lib/assignments/routing';
import {
  analyzePhoto,
  generateFilingGuide as generateStandardFilingGuide,
  generateNarratives,
} from './narrative-router';
import {
  generateIndependentActionGuide,
  type IndependentActionGuidePayload,
} from './independent-action-guide';
import type {
  FilingGuidePayload,
  FilingGuideResponse,
  ServiceResult,
} from './anthropic';

export type * from './anthropic';
export { analyzePhoto, generateNarratives };

export async function generateFilingGuide(
  payload: FilingGuidePayload
): Promise<ServiceResult<FilingGuideResponse>> {
  const assignmentAwarePayload = payload as IndependentActionGuidePayload;

  if (isIndependentValuationPurpose(assignmentAwarePayload.assignmentPurpose)) {
    return generateIndependentActionGuide(assignmentAwarePayload);
  }

  return generateStandardFilingGuide(payload);
}
