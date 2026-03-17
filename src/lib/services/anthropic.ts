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
  const systemPrompt = `You are a property tax appeal advisor. Generate a clear, actionable pro se filing guide for a homeowner appealing their property tax assessment. Include step-by-step instructions, deadlines, required documents, and tips for the hearing. Write in plain English suitable for someone without legal training. Format the output as a single text document with Markdown headings.`;

  const userMessage = JSON.stringify(payload, null, 2);
  const startMs = Date.now();

  try {
    const response = await getClient().messages.create({
      model: AI_MODELS.PRIMARY,
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

Write in a professional but accessible tone. Support claims with data from the comparables and property characteristics provided.`;
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
