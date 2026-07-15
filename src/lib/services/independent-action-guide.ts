import OpenAI from 'openai';
import { AI_MODELS, AI_REASONING, AI_TOKEN_LIMITS, type ReasoningEffort } from '@/config/ai';
import { stripIndependentValuationMarker } from '@/lib/assignments/routing';
import { apiLogger } from '@/lib/logger';
import { withRetry, isRetryableError } from '@/lib/utils/retry';
import type {
  FilingGuidePayload,
  FilingGuideResponse,
  ServiceResult,
} from './anthropic';

export type IndependentActionGuidePayload = FilingGuidePayload & {
  assignmentPurpose?: string | null;
  rawAssessedValue?: number | null;
  assessorImpliedMarketValue?: number | null;
  marketValueGap?: number | null;
};

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

function buildSystemPrompt(payload: IndependentActionGuidePayload): string {
  const purpose = stripIndependentValuationMarker(payload.assignmentPurpose)
    || 'General internal decision support';

  return `You are Resourceful's independent valuation use-and-next-step analyst operating on GPT-5.6 Sol.

ASSIGNMENT PURPOSE:
${purpose}

Create a neutral, practical Markdown guide that explains how the user should understand, document, review, and use the accompanying valuation analysis. This is not a buyer negotiation plan, seller pricing plan, property-tax appeal filing guide, legal opinion, tax opinion, or signed regulated appraisal.

NON-NEGOTIABLE RULES:
1. Use only facts and values supplied in the payload. Never invent a deadline, transaction, document, credential, jurisdiction rule, market statistic, inspection, or intended user.
2. Treat the concluded value as an AI-assisted analytical conclusion subject to the report's stated evidence, assumptions, effective-date limits, and review tier.
3. Never call the output certified, licensed, court-admissible, lender-ready, USPAP-compliant, or an appraisal unless a qualified appraiser has reviewed, signed, and assumed responsibility.
4. Do not describe marketValueGap or potentialSavings as annual tax-dollar savings. It is only a difference between assessor-implied market value and the concluded market value.
5. Do not frame the guide as advocacy for a higher or lower number. Preserve contrary evidence and uncertainty.
6. Identify where a licensed appraiser, attorney, CPA, insurance professional, lender, or agency-specific form may be required for the stated purpose.
7. Separate documents already present from documents the user should obtain or verify.
8. Do not provide legal, tax, insurance, or lending advice.

REQUIRED MARKDOWN SECTIONS:
# Valuation Use & Next-Step Guide
## Assignment Purpose
## What This Analysis Supports
## Evidence and Assumptions to Verify
## Document Checklist
## Review and Upgrade Path
## Recommended Next Actions
## Important Use Limitations

Within the guide:
- State the concluded value and the jurisdiction-normalized assessor reference only when supplied.
- Explain the market-value gap accurately when positive, without converting it into tax savings.
- Tailor the document checklist and professional-review path to the stated purpose.
- Keep next actions ordered, specific, and executable.

Property: ${payload.propertyAddress}
Jurisdiction: ${payload.countyName}, ${payload.state}`;
}

export async function generateIndependentActionGuide(
  payload: IndependentActionGuidePayload
): Promise<ServiceResult<FilingGuideResponse>> {
  const startedAt = Date.now();

  try {
    const response = await withRetry(
      () => getClient().responses.create({
        model: AI_MODELS.PRIMARY,
        store: false,
        reasoning: reasoning(AI_REASONING.APPRAISER),
        max_output_tokens: AI_TOKEN_LIMITS.FILING_GUIDE,
        input: [
          { role: 'system', content: buildSystemPrompt(payload) },
          {
            role: 'user',
            content: JSON.stringify({
              assignmentPurpose: stripIndependentValuationMarker(payload.assignmentPurpose),
              propertyAddress: payload.propertyAddress,
              countyName: payload.countyName,
              state: payload.state,
              rawAssessedValue: payload.rawAssessedValue ?? null,
              assessorImpliedMarketValue:
                payload.assessorImpliedMarketValue ?? payload.assessedValue ?? null,
              concludedValue: payload.concludedValue,
              marketValueGap: payload.marketValueGap ?? payload.potentialSavings ?? null,
              assignmentSummary: payload.appealArgumentSummary,
              requiredDocuments: payload.requiredDocuments,
              evidenceRequirements: payload.evidenceRequirements,
              reviewTier: payload.reviewTier,
            }, null, 2),
          },
        ],
      }),
      { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 30_000, retryOn: isRetryableError }
    );

    const guide = response.output_text.trim();
    if (!guide) {
      return { data: null, error: 'GPT-5.6 Sol returned no independent valuation use guide.' };
    }

    return {
      data: {
        guide,
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
      '[independent-action-guide] generation failed'
    );
    return { data: null, error: `Independent valuation use guide failed: ${message}` };
  }
}
