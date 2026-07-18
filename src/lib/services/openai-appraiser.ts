// ─── OpenAI Appraiser Service ─────────────────────────────────────────────────
// GPT-5.6 Sol is the high-judgment valuation engine for narrative generation,
// filing guidance, property-condition analysis, and tax-document extraction.
//
// Important product boundary: this service creates AI-assisted valuation and
// appeal work products. It must never represent an unsigned AI output as a
// licensed or certified appraisal. A credentialed appraiser must inspect/review,
// sign, and assume responsibility before Resourceful markets a regulated appraisal.

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import {
  AI_MODELS,
  AI_REASONING,
  AI_TOKEN_LIMITS,
  type ReasoningEffort,
} from '@/config/ai';
import { apiLogger } from '@/lib/logger';
import { resolveAssignmentKind, type AssignmentKind } from '@/lib/assignments/routing';
import { withRetry, isRetryableError } from '@/lib/utils/retry';
import type {
  FilingGuidePayload,
  FilingGuideResponse,
  NarrativePayload,
  NarrativeResponse,
  NarrativeSectionName,
  PhotoAnalysisResponse,
  ServiceResult,
} from '@/lib/services/anthropic';

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
  // Keep runtime support for newly introduced levels such as "max" even when an
  // installed SDK's TypeScript union trails the API by a release.
  return { effort } as unknown as { effort: 'none' | 'low' | 'medium' | 'high' };
}

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

const PhotoSchema = z.object({
  condition_rating: z.enum(['excellent', 'good', 'average', 'fair', 'poor']),
  defects: z.array(z.object({
    type: z.string(),
    description: z.string(),
    severity: z.enum(['minor', 'moderate', 'significant']),
    value_impact: z.enum(['low', 'medium', 'high']),
    report_language: z.string(),
  })),
  inferred_direction: z.string(),
  professional_caption: z.string(),
  comparable_adjustment_note: z.string(),
});

const DeferredMaintenanceSchema = z.object({
  severity: z.enum(['none', 'minor', 'moderate', 'severe']),
  appraiserDescription: z.string(),
  estimatedCostToCure: z.number().nullable(),
  primaryDefectType: z.string().nullable(),
  justification: z.string(),
});

const TaxBillSchema = z.object({
  parcelId: z.string().nullable(),
  assessedValue: z.number().nullable(),
  marketValue: z.number().nullable(),
  taxYear: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  confidence: z.number().min(0).max(100),
});

export interface DeferredMaintenanceAnalysis {
  severity: 'none' | 'minor' | 'moderate' | 'severe';
  appraiserDescription: string;
  estimatedCostToCure: number | null;
  primaryDefectType: string | null;
  justification: string;
}

export interface ExtractedTaxBill {
  parcelId: string | null;
  assessedValue: number | null;
  marketValue: number | null;
  taxYear: string | null;
  jurisdiction: string | null;
  confidence: number;
}

function serviceInstruction(assignmentKind: AssignmentKind): string {
  switch (assignmentKind) {
    case 'pre_purchase':
      return 'Prepare a buyer-side valuation and negotiation analysis. Identify downside risk, supported value, due-diligence items, tax exposure, repair verification needs, and a defensible walk-away framework.';
    case 'pre_listing':
      return 'Prepare a seller-side valuation and market-positioning analysis. Identify credible value-enhancement actions, pricing risk, documentation priorities, and launch-positioning considerations without inflating the conclusion.';
    case 'independent_valuation':
      return 'Prepare a purpose-neutral independent property valuation analysis from the supplied workfile. Explain the supported value, evidence limits, intended-use boundary, and review needs. Do not include tax-appeal advocacy, filing instructions, hearing strategy, buyer negotiation language, or seller marketing language unless those facts are explicitly part of the stated assignment.';
    case 'tax_appeal':
      return 'Prepare a property-tax appeal valuation analysis. Build the strongest factually supportable reduction case and usable owner-facing appeal work product without inventing jurisdiction rules, representative authority, or hearing facts.';
  }
}

function disallowedSectionInstruction(assignmentKind: AssignmentKind): string {
  if (assignmentKind === 'tax_appeal') {
    return 'Tax-appeal sections may include assessment_equity, appeal_argument_summary, and hearing_script only when the workfile supports them.';
  }

  return 'Do not generate assessment_equity, appeal_argument_summary, hearing_script, or pro-se filing language for non-tax-appeal assignments. If those sections appear in stale input context, ignore them.';
}

function jurisdictionLabel(payload: NarrativePayload): string {
  const jurisdiction = [payload.countyRules.countyName, payload.countyRules.state]
    .filter(Boolean)
    .join(', ')
    .trim();
  return jurisdiction || 'Unverified jurisdiction';
}

function buildNarrativeSystemPrompt(payload: NarrativePayload): string {
  const assignmentKind = resolveAssignmentKind(payload.serviceType, payload.desiredOutcome);

  return `You are Resourceful's senior AI property valuation analyst operating on GPT-5.6 Sol.

CANONICAL ASSIGNMENT KIND: ${assignmentKind}
${serviceInstruction(assignmentKind)}

NON-NEGOTIABLE PROFESSIONAL RULES:
1. Use only facts and calculations present in the supplied workfile. Never invent a sale, deadline, credential, inspection, source, market statistic, board tendency, or property condition.
2. Separate observed facts, owner statements, third-party records, calculations, assumptions, and professional judgments.
3. Reconcile the sales comparison, income, cost, assessment-equity, prior-sale, and condition evidence that actually exists. Omit an approach when the inputs are insufficient.
4. Do not call this output a certified, licensed, USPAP-compliant, or lender appraisal. Do not claim a physical inspection occurred. It is an AI-assisted valuation analysis and appeal workfile subject to human review.
5. Do not describe Resourceful as the user's lawyer or authorized representative unless the workfile explicitly confirms eligibility and an executed authorization.
6. For tax appeals, distinguish market-value evidence from uniformity/equity evidence and from factual-record corrections. Quantify every supported argument.
7. Preserve uncertainty. State when a value, deadline, cost, condition, or source requires verification.
8. The conclusion must follow the evidence; advocacy never permits directional bias, unsupported deductions, or suppression of contrary evidence.
9. Write polished, client-ready Markdown. Tables are encouraged where they improve clarity.
10. Return only the structured response. Use the exact section_name values supplied by the schema.
11. Use jurisdiction-neutral terminology unless the workfile names a verified filing authority. Do not assume every jurisdiction is county-administered.
12. ${disallowedSectionInstruction(assignmentKind)}

SECTION EXPECTATIONS:
- executive_summary: plain-English decision summary, concluded value, strongest evidence, evidence limits, and next action for the assignment kind.
- assignment_and_scope and certification_and_limiting_conditions: accurately define this as an AI-assisted valuation/appeal analysis, not a signed regulated appraisal.
- sales_comparison_narrative and adjustment_grid_narrative: explain selection, comparability, adjustments, and reconciliation; never manufacture unsupported adjustment percentages.
- condition_assessment: distinguish visible observations from owner-reported conditions and recommend qualified inspection where needed.
- appeal_argument_summary and hearing_script: allowed only for tax appeals; concise, evidence-led, respectful, and usable by a pro se owner.
- hearing_script: allowed only for tax appeals; include likely questions, short answers grounded in the workfile, and a clear requested value.

Property: ${payload.propertyAddress}
Stored service type: ${payload.serviceType}
Property type: ${payload.propertyType}
Jurisdiction: ${jurisdictionLabel(payload)}`;
}

export async function generateNarratives(
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
          { role: 'system', content: buildNarrativeSystemPrompt(payload) },
          {
            role: 'user',
            content: `Create the complete valuation work product from this structured workfile:\n\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
        text: {
          format: zodTextFormat(NarrativeSchema, 'resourceful_valuation_report'),
        },
      }),
      { maxAttempts: 3, baseDelayMs: 2500, maxDelayMs: 30_000, retryOn: isRetryableError }
    );

    if (!response.output_parsed) {
      return { data: null, error: 'GPT-5.6 Sol returned no structured valuation output.' };
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
    apiLogger.error({ message, model: AI_MODELS.PRIMARY }, '[openai-appraiser] narrative generation failed');
    return { data: null, error: `AI valuation generation failed: ${message}` };
  }
}

function filingSystemPrompt(payload: FilingGuidePayload): string {
  const assignmentKind = resolveAssignmentKind(payload.serviceType ?? 'tax_appeal');
  const tier = payload.reviewTier ?? 'auto';
  const jurisdiction = [payload.countyName, payload.state].filter(Boolean).join(', ') || 'the verified jurisdiction';

  if (assignmentKind === 'pre_purchase') {
    return `Create a buyer action plan for ${payload.propertyAddress}. Explain supported value, negotiation range, due diligence, tax exposure, repair verification, and a walk-away framework. Do not provide legal or lending advice and do not invent current market facts.`;
  }

  if (assignmentKind === 'pre_listing') {
    return `Create a seller value-maximization plan for ${payload.propertyAddress}. Prioritize repairs by likely ROI, pricing strategy, documentation, staging, disclosure questions for licensed counsel/agent, and tax-positioning. Do not promise an increase in value or invent market facts.`;
  }

  return `You are Resourceful's property-tax appeal filing coach. Produce an exact, calm, jurisdiction-specific action plan for ${jurisdiction} from the supplied data.

TIER: ${tier}
- auto/expert_reviewed: owner files pro se; provide a complete checklist and submission script.
- guided_filing: owner still files pro se; provide meeting agenda, screen-share workflow, mock-hearing plan, and completion checklist.
- full_representation: only describe representative filing when authorizedRepAllowed is explicitly true and an executed jurisdiction-accepted authorization will be obtained. Otherwise route to guided pro se filing. Never claim the appeal has been filed until a confirmation number, timestamp, or accepted-mail record exists.

REQUIRED CONTENT:
1. Eligibility and deadline verification, with unknown fields clearly marked.
2. Exact filing channel options and links supplied in the workfile.
3. Required forms, documents, copies, fee, signature, notarization, and authorization requirements.
4. A field-by-field filing worksheet using the assessed and requested values.
5. Submission checklist and proof-of-filing retention.
6. Informal review strategy when available.
7. Hearing timeline, evidence order, five-minute opening, likely questions, concise answers, and closing request.
8. Further-appeal route and verification warning.
9. Clear disclaimer: informational support, not legal advice.

Do not invent jurisdiction rules, deadlines, portal behavior, or representative authority. Do not assume the filing authority is a county board unless the workfile says so. If the workfile is incomplete, say exactly what must be confirmed before submission.`;
}

export async function generateFilingGuide(
  payload: FilingGuidePayload
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
          { role: 'system', content: filingSystemPrompt(payload) },
          { role: 'user', content: JSON.stringify(payload, null, 2) },
        ],
      }),
      { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 30_000, retryOn: isRetryableError }
    );

    return {
      data: {
        guide: response.output_text.trim(),
        prompt_tokens: response.usage?.input_tokens ?? 0,
        completion_tokens: response.usage?.output_tokens ?? 0,
        generation_duration_ms: Date.now() - startedAt,
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    apiLogger.error({ message, model: AI_MODELS.PRIMARY }, '[openai-appraiser] filing guide failed');
    return { data: null, error: `AI filing guide generation failed: ${message}` };
  }
}

function imageContent(image: string | { data: string; mimeType: string }) {
  return {
    type: 'input_image' as const,
    image_url: typeof image === 'string'
      ? image
      : `data:${image.mimeType};base64,${image.data}`,
  };
}

export async function analyzePhoto(
  image: string | { data: string; mimeType: string },
  sourcePrompt: string,
  userContext?: string
): Promise<ServiceResult<PhotoAnalysisResponse>> {
  const startedAt = Date.now();
  const ownerContext = userContext?.trim() || 'No owner description supplied.';

  const systemPrompt = `You are Resourceful's GPT-5.6 Sol property-condition analyst.

EVIDENCE RULES THAT OVERRIDE ANY ADVOCACY LANGUAGE BELOW:
- Report only visible, supportable observations. Do not diagnose mold, asbestos, structural failure, code violations, roof failure, or system age from appearance alone.
- Treat the owner's caption as a claim to corroborate, not as proven fact.
- Distinguish cosmetic wear, deferred maintenance, possible defect, and confirmed defect.
- Never infer a value adjustment percentage from a photo alone. Explain the direction of possible market impact and the need for cost/market support.
- Use "not visible," "cannot determine," and "recommend qualified inspection" whenever appropriate.
- Do not claim an on-site inspection occurred.

TASK-SPECIFIC CONTEXT:
${sourcePrompt}`;

  try {
    const response = await withRetry(
      () => getClient().responses.parse({
        model: AI_MODELS.VISION,
        store: false,
        reasoning: reasoning(AI_REASONING.VISION),
        max_output_tokens: AI_TOKEN_LIMITS.VISION_ANALYSIS,
        input: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              imageContent(image),
              {
                type: 'input_text',
                text: `Analyze this property image for valuation-relevant condition evidence. Owner description: ${ownerContext}`,
              },
            ],
          },
        ],
        text: {
          format: zodTextFormat(PhotoSchema, 'property_photo_analysis'),
        },
      }),
      { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 30_000, retryOn: isRetryableError }
    );

    if (!response.output_parsed) {
      return { data: null, error: 'GPT-5.6 Sol returned no structured photo analysis.' };
    }

    return {
      data: {
        analysis: response.output_parsed,
        prompt_tokens: response.usage?.input_tokens ?? 0,
        completion_tokens: response.usage?.output_tokens ?? 0,
        generation_duration_ms: Date.now() - startedAt,
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    apiLogger.error({ message, model: AI_MODELS.VISION }, '[openai-appraiser] photo analysis failed');
    return { data: null, error: `AI photo analysis failed: ${message}` };
  }
}

export async function analyzeDeferredMaintenance(
  base64Images: { data: string; mimeType: string }[],
  userCaption: string,
  propertyType: string = 'residential'
): Promise<DeferredMaintenanceAnalysis | null> {
  if (base64Images.length === 0) return null;

  try {
    const response = await withRetry(
      () => getClient().responses.parse({
        model: AI_MODELS.VISION,
        store: false,
        reasoning: reasoning(AI_REASONING.VISION),
        max_output_tokens: AI_TOKEN_LIMITS.DEFERRED_MAINTENANCE,
        input: [
          {
            role: 'system',
            content: `You are a GPT-5.6 Sol property-condition analyst reviewing multiple images of a ${propertyType} property. Synthesize only visible, corroborated condition evidence. Do not diagnose concealed conditions or claim a physical inspection. Treat owner captions as unverified context. Provide a cost-to-cure number only when the visible scope is sufficiently clear; otherwise return null and recommend a contractor estimate.`,
          },
          {
            role: 'user',
            content: [
              ...base64Images.slice(0, 10).map(imageContent),
              { type: 'input_text', text: `Owner context: ${userCaption}\nAssess aggregate deferred maintenance and explain the evidence.` },
            ],
          },
        ],
        text: {
          format: zodTextFormat(DeferredMaintenanceSchema, 'deferred_maintenance_analysis'),
        },
      }),
      { maxAttempts: 2, baseDelayMs: 2500, maxDelayMs: 30_000, retryOn: isRetryableError }
    );

    return response.output_parsed;
  } catch (error) {
    apiLogger.warn(
      { message: error instanceof Error ? error.message : String(error), model: AI_MODELS.VISION },
      '[openai-appraiser] aggregate condition analysis failed'
    );
    return null;
  }
}

export async function parseTaxBill(
  mimeType: string,
  base64Data: string
): Promise<ExtractedTaxBill | null> {
  const supportedImages = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  if (mimeType !== 'application/pdf' && !supportedImages.has(mimeType)) {
    apiLogger.warn({ mimeType }, '[openai-appraiser] unsupported tax document image type');
    return null;
  }

  const media = mimeType === 'application/pdf'
    ? {
        type: 'input_file' as const,
        filename: 'property-tax-document.pdf',
        file_data: `data:application/pdf;base64,${base64Data}`,
        detail: 'high' as const,
      }
    : {
        type: 'input_image' as const,
        image_url: `data:${mimeType};base64,${base64Data}`,
      };

  try {
    const response = await withRetry(
      () => getClient().responses.parse({
        model: AI_MODELS.DOCUMENT,
        store: false,
        reasoning: reasoning(AI_REASONING.DOCUMENT),
        max_output_tokens: AI_TOKEN_LIMITS.DOCUMENT_EXTRACTION,
        input: [
          {
            role: 'system',
            content: `Extract property-tax fields from the supplied county assessment notice or tax bill. Distinguish assessed value, equalized/taxable value, market value, land value, improvement value, and tax amount. Return the most recent applicable year. Never add land and improvement values when the document already shows a total. Use null for unreadable or absent fields and lower confidence when labels or years are ambiguous.`,
          },
          {
            role: 'user',
            content: [
              media,
              { type: 'input_text', text: 'Extract the parcel identifier, assessed value, market value, tax year, jurisdiction, and confidence.' },
            ],
          },
        ],
        text: {
          format: zodTextFormat(TaxBillSchema, 'property_tax_document'),
        },
      }),
      { maxAttempts: 2, baseDelayMs: 2500, maxDelayMs: 30_000, retryOn: isRetryableError }
    );

    return response.output_parsed;
  } catch (error) {
    apiLogger.error(
      { message: error instanceof Error ? error.message : String(error), model: AI_MODELS.DOCUMENT },
      '[openai-appraiser] tax document extraction failed'
    );
    return null;
  }
}
