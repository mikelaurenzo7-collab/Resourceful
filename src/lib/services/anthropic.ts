// ─── Anthropic AI Service ─────────────────────────────────────────────────────
// Generates report narratives, filing guides, and photo analyses via Claude.

import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS, AI_CONFIG } from '@/config/ai';
import type { PhotoAiAnalysis, PhotoDefect } from '@/types/database';

// ─── Client ──────────────────────────────────────────────────────────────────

// Lazy-initialize to avoid build-time errors when env vars aren't set
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 120_000, // 2 minute timeout for AI calls
    });
  }
  return _client;
}

// ─── Payload Types ───────────────────────────────────────────────────────────

export interface NarrativePayload {
  reportId: string;
  serviceType: string;
  propertyType: string;
  propertyAddress: string;
  propertyData: {
    year_built: number | null;
    building_sqft_gross: number | null;
    building_sqft_living_area: number | null;
    lot_size_sqft: number | null;
    assessed_value: number | null;
    market_value_estimate_low: number | null;
    market_value_estimate_high: number | null;
    property_class: string | null;
    zoning_designation: string | null;
    flood_zone_designation: string | null;
  };
  comparableSales: Array<{
    address: string;
    sale_price: number;
    sale_date: string;
    building_sqft: number | null;
    price_per_sqft: number | null;
    distance_miles: number | null;
    adjusted_price_per_sqft: number | null;
  }>;
  comparableRentals?: Array<{
    address: string;
    rent_per_sqft_yr: number | null;
    building_sqft_leased: number | null;
    lease_type: string | null;
    effective_net_rent_per_sqft: number | null;
  }>;
  incomeAnalysis?: {
    net_operating_income: number | null;
    concluded_cap_rate: number | null;
    concluded_value_income_approach: number | null;
  };
  countyRules: {
    countyName: string;
    state: string;
    assessmentMethodology: string;
    assessmentRatioResidential?: number | null;
    assessmentRatioCommercial?: number | null;
    assessmentRatio?: number | null;
    appealBoardName?: string | null;
  };
  concludedValue: number;
  photoAnalyses?: Array<{
    photo_type: string;
    condition_rating: string;
    defects: PhotoDefect[];
    professional_caption: string;
  }>;
  floodZone?: string | null;
  // Pre-computed overvaluation analysis — every angle the assessor may have missed
  overvaluationAnalysis?: {
    assessedValuePerSqft: number | null;
    medianCompPricePerSqft: number | null;
    overvaluationPct: number | null; // positive = over-assessed
    assessmentRatioImplied: number | null; // assessed / concluded — what ratio would justify the assessment
    assessmentRatioExpected: number | null; // from county_rules — what the ratio should be
    assessmentRatioMismatch: boolean; // true if implied ratio is materially higher than expected
    attomMarketRangeLow: number | null;
    attomMarketRangeHigh: number | null;
    assessedExceedsAttomRange: boolean; // true if assessed > ATTOM high estimate
    marketTrendPct: number | null; // negative = declining market
    effectiveAge: number | null;
    buildingSqftFromAssessor: number | null;
    dataAnomalies: string[]; // human-readable flags like "Assessor records show 2,400 sqft but comps average 1,800 sqft"
  };
  calibrationContext?: {
    sampleSize: number;
    meanAbsoluteErrorPct: number | null;
    valueBiasPct: number;
  };
}

export interface FilingGuidePayload {
  propertyAddress: string;
  countyName: string;
  state: string;
  assessedValue: number;
  concludedValue: number;
  potentialSavings: number;
  appealDeadline: string | null;
  appealBoardName: string | null;
  appealBoardAddress: string | null;
  appealBoardPhone: string | null;
  portalUrl: string | null;
  filingEmail: string | null;
  acceptsOnlineFiling: boolean;
  acceptsEmailFiling: boolean;
  requiresMailFiling: boolean;
  appealFormName: string | null;
  formDownloadUrl: string | null;
  evidenceRequirements: string[] | null;
  hearingFormat: string | null;
  filingFeeCents: number | null;
  proSeTips: string | null;
  appealArgumentSummary: string | null;
  filingFeeNotes: string | null;
  hearingTypicallyRequired: boolean;
  typicalResolutionWeeksMin: number | null;
  typicalResolutionWeeksMax: number | null;
  stateAppealBoardName: string | null;
  stateAppealBoardUrl: string | null;
  filingInstructions?: string | null;
  requiredForms?: string[] | null;
  onlineFilingUrl?: string | null;
  assessorPhone?: string | null;
  appealFeeCents?: number | null;
  // Enhanced filing schedule fields
  assessmentCycle?: string | null;
  assessmentNoticesMailed?: string | null;
  appealWindowDays?: number | null;
  nextAppealDeadline?: string | null;
  currentTaxYear?: number | null;
  filingSteps?: { step_number: number; title: string; description: string; url?: string; form_name?: string }[] | null;
  requiredDocuments?: string[] | null;
  informalReviewAvailable?: boolean;
  informalReviewNotes?: string | null;
  hearingDurationMinutes?: number | null;
  hearingSchedulingNotes?: string | null;
  virtualHearingAvailable?: boolean;
  virtualHearingPlatform?: string | null;
  authorizedRepAllowed?: boolean | null;
  authorizedRepTypes?: string[] | null;
  furtherAppealBody?: string | null;
  furtherAppealDeadlineRule?: string | null;
  furtherAppealUrl?: string | null;
}

// ─── Section Names ──────────────────────────────────────────────────────────
// These must match the section_name values stored in the report_narratives table.

const NARRATIVE_SECTION_NAMES = [
  'executive_summary',
  'property_description',
  'site_description_narrative',
  'improvement_description_narrative',
  'area_analysis_county',
  'area_analysis_city',
  'area_analysis_neighborhood',
  'market_analysis',
  'hbu_as_vacant',
  'hbu_as_improved',
  'sales_comparison_narrative',
  'adjustment_grid_narrative',
  'income_approach_narrative',
  'reconciliation_narrative',
  'appeal_argument_summary',
] as const;

export type NarrativeSectionName = typeof NARRATIVE_SECTION_NAMES[number];

// ─── Response Types ──────────────────────────────────────────────────────────

export interface NarrativeSection {
  section_name: NarrativeSectionName;
  content: string;
}

export interface NarrativeResponse {
  sections: NarrativeSection[];
  prompt_tokens: number;
  completion_tokens: number;
  generation_duration_ms: number;
}

export interface FilingGuideResponse {
  guide: string;
  prompt_tokens: number;
  completion_tokens: number;
  generation_duration_ms: number;
}

export interface PhotoAnalysisResponse {
  analysis: PhotoAiAnalysis;
  prompt_tokens: number;
  completion_tokens: number;
  generation_duration_ms: number;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate all report narrative sections in a single API call.
 * Returns parsed JSON with section_name values matching the database.
 */
export async function generateNarratives(
  payload: NarrativePayload
): Promise<ServiceResult<NarrativeResponse>> {
  const systemPrompt = buildNarrativeSystemPrompt(payload);
  const userMessage = buildNarrativeUserMessage(payload);

  const startMs = Date.now();

  try {
    const response = await getClient().messages.create({
      model: AI_MODELS.PRIMARY,
      max_tokens: AI_CONFIG.maxTokens.narrative,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const durationMs = Date.now() - startMs;
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const parsed = parseNarrativeJson(textContent);
    if (!parsed) {
      return {
        data: null,
        error: 'Failed to parse narrative JSON from AI response',
      };
    }

    return {
      data: {
        sections: parsed,
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        generation_duration_ms: durationMs,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[anthropic] generateNarratives error: ${message}`);
    return { data: null, error: `AI narrative generation failed: ${message}` };
  }
}

/**
 * Generate a pro se filing guide for property tax appeals.
 */
export async function generateFilingGuide(
  payload: FilingGuidePayload
): Promise<ServiceResult<FilingGuideResponse>> {
  const systemPrompt = `You are a property tax appeal advisor generating a county-specific pro se filing guide. The homeowner will use this guide to file their own appeal — make it so thorough and clear that they feel fully prepared with zero guesswork.

REQUIRED SECTIONS (use these exact Markdown headings):

## Your Filing Window
- State the exact deadline or window (from the data provided). If a specific next_appeal_deadline date is given, use it.
- Explain assessment cycle (annual/biennial/triennial) so they understand when they can file again.
- Warn about the consequence of missing the deadline.

## How to File: Step-by-Step
- Number each step clearly (1, 2, 3...). Use the filing_steps data if provided, otherwise construct logical steps.
- If the county accepts online filing, lead with that and provide the portal URL prominently.
- If email or mail filing, explain exactly what to send and where.
- Include the appeal form name and download URL if available.
- State the filing fee and how to pay it.

## What to Include With Your Appeal
- List every required document. Include our report, the appeal form, photos, and any county-specific requirements.
- Explain how to organize the packet.

## Informal Review (if available)
- If the county offers informal review before formal hearing, explain how to request it and why it's recommended.

## What to Expect at Your Hearing
- Hearing format (in-person, virtual, written review). If virtual, name the platform.
- How long the hearing typically lasts.
- How hearings are scheduled after filing.
- What to say, what to bring, how to present evidence.
- Specific tips for making a strong case in the allotted time.

## Your Three Strongest Arguments
- Based on the appeal_argument_summary, distill the 3 most persuasive points to make at the hearing.
- Frame each as a clear, quotable statement the homeowner can say to the board.

## If You Disagree With the Decision
- Explain the further appeal process (state-level board, court) with deadlines and costs.

## Important Reminders
- Filing deadline reiterated
- Keep copies of everything
- Disclaimer: this is informational guidance, not legal advice

Write in plain English. Be specific, not generic. Use the county name and state throughout. If data fields are null, omit that section rather than guessing.`;

  const userMessage = JSON.stringify(payload, null, 2);
  const startMs = Date.now();

  try {
    const response = await getClient().messages.create({
      model: AI_MODELS.FAST, // Filing guide is formulaic — doesn't need the primary model
      max_tokens: AI_CONFIG.maxTokens.filingGuide,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const durationMs = Date.now() - startMs;
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      data: {
        guide: textContent,
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        generation_duration_ms: durationMs,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[anthropic] generateFilingGuide error: ${message}`);
    return { data: null, error: `AI filing guide generation failed: ${message}` };
  }
}

/**
 * Analyze a property photo using Claude's vision capabilities.
 * Returns structured PhotoAiAnalysis matching the database interface:
 *   condition_rating, defects[], inferred_direction, professional_caption, comparable_adjustment_note
 */
export async function analyzePhoto(
  imageUrl: string,
  systemPrompt: string
): Promise<ServiceResult<PhotoAnalysisResponse>> {
  const startMs = Date.now();

  try {
    const response = await getClient().messages.create({
      model: AI_MODELS.FAST,
      max_tokens: AI_CONFIG.maxTokens.photoAnalysis,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: imageUrl },
            },
            {
              type: 'text',
              text: `Analyze this property photo. Return a JSON object with:
- "condition_rating": one of "excellent", "good", "average", "fair", "poor"
- "defects": array of objects, each with { "type": string, "description": string, "severity": "minor"|"moderate"|"significant", "value_impact": "low"|"medium"|"high", "report_language": string }
- "inferred_direction": string describing the apparent direction/angle of the photo (e.g. "front elevation facing north")
- "professional_caption": string suitable for use in an appraisal report
- "comparable_adjustment_note": string noting any condition factors that would affect comparable adjustments`,
            },
          ],
        },
      ],
    });

    const durationMs = Date.now() - startMs;
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const parsed = parsePhotoAnalysisJson(textContent);
    if (!parsed) {
      return {
        data: null,
        error: 'Failed to parse photo analysis JSON from AI response',
      };
    }

    return {
      data: {
        analysis: parsed,
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        generation_duration_ms: durationMs,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[anthropic] analyzePhoto error: ${message}`);
    return { data: null, error: `AI photo analysis failed: ${message}` };
  }
}

// ─── Prompt Builders ─────────────────────────────────────────────────────────

function buildNarrativeSystemPrompt(payload: NarrativePayload): string {
  return `You are a professional property appraiser and tax assessment analyst. Generate a comprehensive property assessment report with multiple narrative sections.

You must return valid JSON — an array of objects with these keys:
- "section_name": one of the exact values listed below
- "content": the narrative text (may include Markdown)

Required section_name values (generate ALL that apply, in this order):
1. "executive_summary" — overview of findings and concluded value
2. "property_description" — physical description of the subject property
3. "site_description_narrative" — description of the site/land
4. "improvement_description_narrative" — description of the improvements
5. "area_analysis_county" — county-level area context
6. "area_analysis_city" — city-level area context
7. "area_analysis_neighborhood" — neighborhood-level area context
8. "market_analysis" — market conditions and trends
9. "hbu_as_vacant" — highest and best use as if vacant
10. "hbu_as_improved" — highest and best use as improved
11. "sales_comparison_narrative" — analysis of comparable sales with adjustments
12. "adjustment_grid_narrative" — explanation of the adjustment grid methodology
${payload.comparableRentals?.length ? '13. "income_approach_narrative" — rental income analysis and value conclusion' : ''}
14. "reconciliation_narrative" — final value reconciliation and recommendation
${payload.serviceType === 'tax_appeal' ? '15. "appeal_argument_summary" — summary argument for assessment appeal' : ''}

County assessment methodology: ${payload.countyRules.assessmentMethodology}
${payload.countyRules.assessmentRatioResidential != null ? `Assessment ratio (residential): ${payload.countyRules.assessmentRatioResidential}` : ''}
${payload.countyRules.assessmentRatioCommercial != null ? `Assessment ratio (commercial): ${payload.countyRules.assessmentRatioCommercial}` : ''}

Write in a professional but accessible tone. Support claims with data from the comparables and property characteristics provided.

CRITICAL INSTRUCTION — ASSESSOR CHALLENGE ANALYSIS:
Assessors are human. They make mistakes, use stale data, apply incorrect ratios, miss market trends, and sometimes entire counties systematically over-assess. Your job is to find EVERY legitimate angle where the assessor may have missed the mark. This applies to ALL reports — with or without photos.

You MUST analyze and report on ALL of the following in the appeal_argument_summary and reconciliation_narrative sections:
1. ASSESSED VALUE vs MARKET VALUE: Compare the assessed value per square foot against comparable sale prices per square foot. If the assessor's implied value exceeds what the market supports, call it out with specific numbers.
2. ASSESSMENT RATIO VALIDATION: If an assessment ratio is provided, verify it was applied correctly. Calculate: assessed_value ÷ concluded_market_value. If this implied ratio exceeds the county's statutory ratio, the assessment is mathematically over-stated.
3. MARKET TRENDS: If comparable sales show declining prices over time (older sales higher, recent sales lower), the assessor may be using stale valuations. Note any downward trend.
4. DATA ERRORS: Look for anomalies in the assessor's property records — square footage that seems wrong for the property type, year built discrepancies, lot size issues. If the data looks suspect, say so.
5. ATTOM MARKET RANGE: If the assessed value exceeds even the high end of independent market value estimates (ATTOM AVM), this is strong evidence of over-assessment.
6. EFFECTIVE AGE vs ACTUAL AGE: Older properties with no renovation history should reflect physical depreciation. If the assessment doesn't account for age-related depreciation, challenge it.
7. FLOOD ZONE / ENVIRONMENTAL: Properties in flood zones or with environmental concerns warrant value reductions that assessors often miss.

${payload.overvaluationAnalysis ? `
OVERVALUATION ANALYSIS (pre-computed — cite these specific numbers):
${payload.overvaluationAnalysis.overvaluationPct != null ? `- Assessed value per sqft: $${payload.overvaluationAnalysis.assessedValuePerSqft}/sqft vs median comp: $${payload.overvaluationAnalysis.medianCompPricePerSqft}/sqft (${payload.overvaluationAnalysis.overvaluationPct > 0 ? `OVER-ASSESSED by ${payload.overvaluationAnalysis.overvaluationPct.toFixed(1)}%` : `within market range`})` : ''}
${payload.overvaluationAnalysis.assessmentRatioMismatch ? `- ASSESSMENT RATIO ERROR: Implied ratio is ${payload.overvaluationAnalysis.assessmentRatioImplied?.toFixed(3)} but county statutory ratio is ${payload.overvaluationAnalysis.assessmentRatioExpected?.toFixed(3)} — the assessment exceeds what the ratio allows` : ''}
${payload.overvaluationAnalysis.assessedExceedsAttomRange ? `- Assessed value EXCEEDS independent AVM high estimate ($${payload.overvaluationAnalysis.attomMarketRangeHigh?.toLocaleString()}) — strong overvaluation signal` : ''}
${payload.overvaluationAnalysis.marketTrendPct != null && payload.overvaluationAnalysis.marketTrendPct < -2 ? `- DECLINING MARKET: Comp sales show ${payload.overvaluationAnalysis.marketTrendPct.toFixed(1)}% trend — assessor may be using stale valuations` : ''}
${payload.overvaluationAnalysis.dataAnomalies.length > 0 ? `- DATA ANOMALIES:\n${payload.overvaluationAnalysis.dataAnomalies.map(a => `  * ${a}`).join('\n')}` : ''}
` : ''}
${payload.photoAnalyses && payload.photoAnalyses.length > 0
  ? `PHOTO EVIDENCE: The property owner submitted ${payload.photoAnalyses.length} photo(s) with AI-analyzed condition data. Reference specific photo evidence (defects, condition ratings) in the property description, condition assessment, and reconciliation sections. This is evidence the assessor did not have access to — emphasize that documented conditions support the adjusted value conclusion.`
  : `NO PHOTO EVIDENCE: The property owner did not submit photos. This does NOT weaken your analysis — fight just as hard using market data, assessment ratio math, comparable sales, and any data anomalies. The assessor's value must still be justified by market evidence, and if it isn't, say so clearly.`
}
${payload.calibrationContext && payload.calibrationContext.sampleSize > 0
  ? `\nCALIBRATION NOTE: This valuation has been calibrated against ${payload.calibrationContext.sampleSize} professional appraisals${payload.calibrationContext.meanAbsoluteErrorPct != null ? ` with a mean absolute error of ${payload.calibrationContext.meanAbsoluteErrorPct.toFixed(1)}%` : ''}. The concluded value incorporates learned adjustments from real-world appraisal feedback.`
  : ''}`;
}

function buildNarrativeUserMessage(payload: NarrativePayload): string {
  return JSON.stringify(
    {
      propertyAddress: payload.propertyAddress,
      serviceType: payload.serviceType,
      propertyType: payload.propertyType,
      propertyData: payload.propertyData,
      comparableSales: payload.comparableSales,
      comparableRentals: payload.comparableRentals ?? [],
      incomeAnalysis: payload.incomeAnalysis ?? null,
      concludedValue: payload.concludedValue,
      photoAnalyses: payload.photoAnalyses ?? [],
      overvaluationAnalysis: payload.overvaluationAnalysis ?? null,
    },
    null,
    2
  );
}

// ─── JSON Parsers ────────────────────────────────────────────────────────────

function parseNarrativeJson(text: string): NarrativeSection[] | null {
  try {
    // Try direct parse first
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return validateNarrativeSections(parsed);
    if (parsed.sections && Array.isArray(parsed.sections)) return validateNarrativeSections(parsed.sections);
  } catch {
    // Try extracting JSON from markdown code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) return validateNarrativeSections(parsed);
        if (parsed.sections && Array.isArray(parsed.sections)) return validateNarrativeSections(parsed.sections);
      } catch {
        // fall through
      }
    }
  }
  console.error('[anthropic] Could not parse narrative JSON from response');
  return null;
}

function validateNarrativeSections(raw: any[]): NarrativeSection[] {
  return raw
    .filter((s) => s.section_name && s.content)
    .map((s) => ({
      section_name: s.section_name as NarrativeSectionName,
      content: s.content as string,
    }));
}

function parsePhotoAnalysisJson(text: string): PhotoAiAnalysis | null {
  function normalize(parsed: any): PhotoAiAnalysis {
    return {
      condition_rating: parsed.condition_rating ?? 'average',
      defects: (parsed.defects ?? []).map((d: any) => ({
        type: d.type ?? '',
        description: d.description ?? '',
        severity: d.severity ?? 'minor',
        value_impact: d.value_impact ?? 'low',
        report_language: d.report_language ?? '',
      })),
      inferred_direction: parsed.inferred_direction ?? '',
      professional_caption: parsed.professional_caption ?? '',
      comparable_adjustment_note: parsed.comparable_adjustment_note ?? '',
    };
  }

  try {
    const parsed = JSON.parse(text);
    return normalize(parsed);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        return normalize(parsed);
      } catch {
        // fall through
      }
    }
  }
  console.error('[anthropic] Could not parse photo analysis JSON from response');
  return null;
}
