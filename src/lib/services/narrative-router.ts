import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AI_MODELS, AI_REASONING, AI_TOKEN_LIMITS, type ReasoningEffort } from '@/config/ai';
import { apiLogger } from '@/lib/logger';
import { withRetry, isRetryableError } from '@/lib/utils/retry';
import {
  analyzePhoto,
  generateFilingGuide,
  generateNarratives as generateStandardNarratives,
} from './openai-appraiser';
import type {
  NarrativePayload,
  NarrativeResponse,
  NarrativeSectionName,
  ServiceResult,
} from './anthropic';

export type * from './anthropic';
export { analyzePhoto, generateFilingGuide };

const INDEPENDENT_VALUATION_MARKER = '[INDEPENDENT_VALUATION]';

const NARRATIVE_SECTIONS = [
  'assignment_and_scope',
  'summary_of_salient_facts',
  'property_history',
  'assessment_data',
  'executive_summary',
  'property_description',
  'site_description_narrative',
  'improvement_description_narrative',
  'condition_assessment',
  'area_analysis_county',
  'area_analysis_city',
  'area_analysis_neighborhood',
  'market_analysis',
  'hbu_as_vacant',
  'hbu_as_improved',
  'sales_comparison_narrative',
  'adjustment_grid_narrative',
  'income_approach_narrative',
  'cost_approach_narrative',
  'assessment_equity',
  'reconciliation_narrative',
  'certification_and_limiting_conditions',
  'appeal_argument_summary',
  'hearing_script',
] as const satisfies readonly NarrativeSectionName[];

const NarrativeSchema = z.object({
  sections: z.array(z.object({
    section_name: z.enum(NARRATIVE_SECTIONS),
    content: z.string().min(1),
  })).min(1),
});

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set. AI features will not work.');
    }
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 300_000,
      maxRetries: 0,
    });
  }
  return client;
}

function reasoning(effort: ReasoningEffort) {
  return { effort } as unknown as { effort: 'none' | 'low' | 'medium' | 'high' };
}

function isIndependentValuation(payload: NarrativePayload): boolean {
  return payload.desiredOutcome?.trim().startsWith(INDEPENDENT_VALUATION_MARKER) ?? false;
}

function independentSystemPrompt(payload: NarrativePayload): string {
  const purpose = payload.desiredOutcome
    ?.trim()
    .slice(INDEPENDENT_VALUATION_MARKER.length)
    .trim() || 'General internal decision support';

  return `You are Resourceful's senior neutral property valuation analyst operating on GPT-5.6 Sol.

ASSIGNMENT PURPOSE:
${purpose}

Prepare a comprehensive, evidence-rich independent valuation analysis for the stated purpose. This is not a buyer advocacy report, seller advocacy report, property-tax appeal, or signed regulated appraisal.

NON-NEGOTIABLE PROFESSIONAL RULES:
1. Use only the supplied workfile facts, calculations, records, photos, documents, and clearly labeled assumptions.
2. Never invent a sale, source, inspection, credential, market statistic, effective date, legal standard, or property condition.
3. Separate observations, owner statements, public records, third-party data, calculations, assumptions, and analytical judgments.
4. Reconcile only the valuation approaches supported by sufficient data. Explain why an approach is omitted or given limited weight.
5. State the intended use, intended user, valuation date when supplied, scope limitations, and data gaps.
6. Do not call the output certified, licensed, lender-ready, court-admissible, USPAP-compliant, or an appraisal unless a properly licensed appraiser reviews, signs, and assumes responsibility.
7. For estate, divorce, insurance, tax-basis, litigation, or agency use, identify where credentialed appraisal or legal review may be required.
8. User photos are material evidence. Distinguish visible facts from allegations or concealed-condition inferences and identify verification needed.
9. Do not bias the conclusion toward a desired number. Preserve contrary evidence and uncertainty.
10. Write polished, client-ready Markdown using the exact structured section names.

REPORT EXPECTATIONS:
- executive_summary: purpose, value conclusion or range, effective date status, strongest evidence, uncertainty, and next action.
- assignment_and_scope: intended use/user, property interest assumed, effective date, scope, sources, inspection status, and exclusions.
- condition_assessment: photo-led evidence table, owner statements, visible defects, verification status, and cost-to-cure limitations.
- sales_comparison_narrative and adjustment_grid_narrative: comp selection, adjustments, data quality, and reconciliation without manufactured percentages.
- income_approach_narrative and cost_approach_narrative: include only when supported.
- reconciliation_narrative: reasoned weighting, sensitivity, confidence, and final conclusion.
- certification_and_limiting_conditions: accurately describe an AI-assisted valuation workfile and licensed-appraiser upgrade path.
- appeal_argument_summary: repurpose as a concise purpose-and-use summary; do not frame it as an appeal.
- hearing_script: repurpose as a reviewer briefing and document checklist; do not frame it as testimony unless the purpose requires it.

Property: ${payload.propertyAddress}
Property type: ${payload.propertyType}
Jurisdiction: ${payload.countyRules.countyName}, ${payload.countyRules.state}`;
}

async function generateIndependentNarratives(
  payload: NarrativePayload
): Promise<ServiceResult<NarrativeResponse>> {
  const startedAt = Date.now();

  try {
    const response = await withRetry(
      () => getClient().responses.parse({
        model: AI_MODELS.PRIMARY,
        store: false,
        reasoning: reasoning(AI_REASONING.APPRAISER),
        max_output_tokens: AI_TOKEN_LIMITS.REPORT_NARRATIVES,
        input: [
          { role: 'system', content: independentSystemPrompt(payload) },
          {
            role: 'user',
            content: `Create the complete independent valuation work product from this structured workfile:\n\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
        text: {
          format: zodTextFormat(NarrativeSchema, 'resourceful_independent_valuation_report'),
        },
      }),
      { maxAttempts: 3, baseDelayMs: 2500, maxDelayMs: 30_000, retryOn: isRetryableError }
    );

    if (!response.output_parsed) {
      return { data: null, error: 'GPT-5.6 Sol returned no structured independent valuation output.' };
    }

    return {
      data: {
        sections: response.output_parsed.sections,
        prompt_tokens: response.usage?.input_tokens ?? 0,
        completion_tokens: response.usage?.output_tokens ?? 0,
        generation_duration_ms: Date.now() - startedAt,
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    apiLogger.error(
      { message, model: AI_MODELS.PRIMARY },
      '[narrative-router] independent valuation generation failed'
    );
    return { data: null, error: `Independent valuation generation failed: ${message}` };
  }
}

export async function generateNarratives(
  payload: NarrativePayload
): Promise<ServiceResult<NarrativeResponse>> {
  if (isIndependentValuation(payload)) {
    return generateIndependentNarratives(payload);
  }
  return generateStandardNarratives(payload);
}
