// ─── Anthropic AI Service ─────────────────────────────────────────────────────
// Generates report narratives, filing guides, and photo analyses via Claude.

import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS, AI_CONFIG } from '@/config/ai';
import type { PhotoAiAnalysis, PhotoDefect } from '@/types/database';
import { withRetry, isRetryableError } from '@/lib/utils/retry';

/**
 * Wrapper for Anthropic API calls with retry logic.
 * Handles 429 (rate limit), 5xx (server error), and network timeouts.
 */
async function createWithRetry(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  return withRetry(
    () => getClient().messages.create(params),
    { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 30000, retryOn: isRetryableError }
  );
}

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
  desiredOutcome?: string | null;
  propertyData: {
    year_built: number | null;
    building_sqft_gross: number | null;
    building_sqft_living_area: number | null;
    lot_size_sqft: number | null;
    assessed_value: number | null;
    market_value_estimate_low: number | null;
    market_value_estimate_high: number | null;
    property_class: string | null;
    property_subtype?: string | null;
    zoning_designation: string | null;
    flood_zone_designation: string | null;
    // Depreciation intelligence (populated by Stage 1 + refined by Stage 4)
    effective_age?: number | null;
    effective_age_source?: string | null;
    physical_depreciation_pct?: number | null;
    remaining_economic_life?: number | null;
    economic_life_years?: number | null;
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
    assessmentCycle?: string | null;
    appealDeadlineRule?: string | null;
    hearingFormat?: string | null;
    informalReviewAvailable?: boolean | null;
    proSeTips?: string | null;
    boardPersonalityNotes?: string | null;
    winningArgumentPatterns?: string | null;
    commonAssessorErrors?: string | null;
    successRatePct?: number | null;
  };
  concludedValue: number;
  photoAnalyses?: Array<{
    photo_type: string;
    condition_rating: string;
    defects: PhotoDefect[];
    professional_caption: string;
    comparable_adjustment_note: string;
  }>;
  // Photo value attribution — how much the photos moved the needle
  photoAttribution?: {
    concludedValueWithPhotos: number;
    concludedValueWithoutPhotos: number;
    photoImpactDollars: number;
    photoImpactPct: number;
    photoConditionAdjustmentPct: number;
    totalDefects: number;
    significantDefects: number;
  } | null;
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
    physicalDepreciationPct?: number | null; // computed depreciation %
    remainingEconomicLife?: number | null;   // years of useful life remaining
    buildingSqftFromAssessor: number | null;
    dataAnomalies: string[];
    // Two-way analysis
    isUnderassessed?: boolean;
    underassessmentPct?: number | null;
    // Case intelligence
    caseStrengthScore?: number;
    caseValueAtStake?: number;
    // Cost approach (third USPAP approach)
    costApproachRcn?: number | null;        // replacement cost new (building)
    costApproachValue?: number | null;      // full cost approach with land + depreciation
    landValue?: number | null;             // assessor's split land value
    // Functional obsolescence
    functionalObsolescencePct?: number | null;
    functionalObsolescenceNotes?: string | null;
    // Conditions of sale
    distressedCompCount?: number;          // # comps with conditions-of-sale adjustment applied
  };
  // Live research intelligence — per-report web research from research agent
  researchIntelligence?: {
    strategyInsights: string;
    deadlineInfo: string | null;
    boardIntelligence: string | null;
    recentChanges: string | null;
    sources: string[];
  } | null;
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
  authorizedRepFormUrl?: string | null;
  repRestrictionsNotes?: string | null;
  furtherAppealBody?: string | null;
  furtherAppealDeadlineRule?: string | null;
  furtherAppealUrl?: string | null;
  // Board intelligence
  boardPersonalityNotes?: string | null;
  winningArgumentPatterns?: string | null;
  successRatePct?: number | null;
}

// ─── Section Names ──────────────────────────────────────────────────────────
// These must match the section_name values stored in the report_narratives table.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NARRATIVE_SECTION_NAMES = [
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
    const response = await createWithRetry({
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
  const county = payload.countyName;
  const state = payload.state;

  const systemPrompt = `You are a property tax appeal coach who has helped hundreds of homeowners successfully appeal their assessments in ${county} County, ${state}. You know exactly how ${county} County's appeal process works — the forms, the deadlines, the board members' expectations, and the tactics that win.

You are writing a personalized, step-by-step battle plan for THIS specific homeowner at ${payload.propertyAddress}. They are going to walk into their hearing (or file online) feeling like they've done this a dozen times before. Leave NOTHING to guesswork.

REQUIRED SECTIONS (use these exact Markdown headings):

## Your Filing Window
- State the exact deadline or window (from the data provided). If a specific next_appeal_deadline date is given, use it prominently and in bold.
- Explain ${county} County's assessment cycle (annual/biennial/triennial) so they know when they can file again if they miss this window.
- Create urgency: "Missing this deadline means you'll pay $X more than you should for another full year" (calculate from the potentialSavings data).

## How to File: Step-by-Step
- Number each step clearly (1, 2, 3...). Use the filing_steps data if provided, otherwise construct logical steps based on the county's accepted methods.
- If ${county} County accepts online filing, lead with that and provide the portal URL prominently. Walk them through what to expect on the portal.
- If email or mail filing, give exact addresses, formatting requirements, and what to write in the subject line.
- Include the appeal form name and download URL if available.
- State the filing fee and how to pay it. If there's no fee, say so — it removes a barrier.
- Tell them exactly what to write on the form. Don't leave them staring at a blank field.

## What to Include With Your Appeal
- List every required document with checkboxes (- [ ]) so they can track their packet.
- Put our report first — it's their strongest piece of evidence.
- Include photos if they submitted them, the appeal form, and any county-specific requirements.
- Tell them how to organize the packet: what order, how many copies, stapled or clipped.

## Informal Review (if available)
- If ${county} County offers informal review before formal hearing, STRONGLY recommend it. Explain that most successful appeals are resolved informally — the homeowner avoids a hearing entirely.
- Explain exactly how to request it: who to call, what to say, what to bring.
- Coach them on what to say: "I'd like to discuss my assessment informally before filing a formal appeal. I have a professional market analysis showing my property is over-assessed by $X."

## What to Expect at Your Hearing
- Hearing format specific to ${county} County (in-person, virtual, written review). If virtual, name the platform and any technical setup needed.
- How long hearings typically last — set expectations so they don't panic about time.
- How hearings are scheduled after filing (days? weeks? how will they be notified?).
- COACH THEM on what to say. Give them an opening statement template: "Good morning. My name is [name], and I'm here to appeal the assessment on [address]. My property is currently assessed at $X, but market evidence shows it's worth $Y — an overassessment of $Z. I have [number] pieces of evidence to present."
- Tell them what NOT to do: don't get emotional, don't argue with the board, don't bring up neighbor's assessments unless it supports equity arguments, don't apologize for taking their time.
- Specific tips for ${county} County based on the hearing format and any pro_se_tips provided.
${payload.boardPersonalityNotes ? `\nBOARD INSIDER NOTES: ${payload.boardPersonalityNotes}\nUse this intelligence to coach the homeowner on exactly how this specific board operates.` : ''}
${payload.winningArgumentPatterns ? `\nWINNING ARGUMENTS: ${payload.winningArgumentPatterns}\nEmphasize these argument patterns — they have the highest success rate in this county.` : ''}
${payload.successRatePct ? `\nHISTORICAL SUCCESS RATE: ${payload.successRatePct}% of appeals in this county succeed. Frame this to set appropriate expectations.` : ''}

## Your Five Strongest Arguments
- Based on the appeal_argument_summary, distill the 5 most persuasive points to make at the hearing.
- Number them and frame each as a clear, quotable statement the homeowner can literally read aloud to the board.
- Lead with the strongest argument. End with the emotional closer.
- After the 5 arguments, give them their closing statement: "Based on this evidence, I respectfully request the assessed value be reduced from $[assessed] to $[concluded]. Thank you for your time."

## If You Disagree With the Decision
- Explain ${county} County's further appeal process (state-level board, court) with specific deadlines and costs.
- Be honest about whether further appeal is worth it based on the dollar amount at stake.

## Our Filing Services
- If ${county} County allows authorized representatives to file on behalf of property owners (authorizedRepAllowed is true), explain that Resourceful offers full-service filing:
  - "If you purchased our Full Representation package, our team will handle the entire filing process and attend the hearing on your behalf. You don't need to do anything else."
  - "If you purchased Guided Filing, we'll walk you through every step on a live call — you'll file it yourself, but you won't be guessing."
  - If they're on the standard package, mention: "If you'd like us to handle the filing and hearing for you, you can upgrade to our Full Representation package."
  - Include the POA form URL if available from authorizedRepFormUrl.
  - Note any restrictions (from repRestrictionsNotes).
- If ${county} County does NOT allow authorized representatives, explain that the homeowner files pro se (themselves) and reassure them: "Don't worry — we've designed this guide to make you feel like you've done this a dozen times before. You've got this."
- If the data is null/unknown, default to pro se guidance and omit the full-service mention.

## Important Reminders
- Filing deadline reiterated in bold
- "Keep copies of EVERYTHING you submit"
- "Take notes during your hearing"
- "You have the right to appeal — you are not being difficult, you are being responsible"
- Disclaimer: this is informational guidance, not legal advice

Write in plain, encouraging English. Be specific to ${county} County — never generic. Use the county name and state throughout. Address the homeowner directly as "you." If data fields are null, omit that section rather than guessing. Your goal is to make this homeowner feel confident, prepared, and empowered.`;

  const userMessage = JSON.stringify(payload, null, 2);
  const startMs = Date.now();

  try {
    const response = await createWithRetry({
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
 *
 * @param userContext  Optional caption/description the property owner provided.
 *                     Treated as high-trust firsthand testimony from the person
 *                     who lives in/owns the property.
 */
export async function analyzePhoto(
  imageUrl: string,
  systemPrompt: string,
  userContext?: string
): Promise<ServiceResult<PhotoAnalysisResponse>> {
  const startMs = Date.now();

  const ownerContext = userContext?.trim()
    ? `\n\nOWNER'S DESCRIPTION OF THIS PHOTO:\n"${userContext.trim()}"\n\nTreat the owner's description as firsthand testimony. They live in and own this property — they know issues that may not be fully visible in a photograph. If they identify a specific defect or condition, document it even if it's only partially visible or the photo angle limits your view.`
    : '';

  try {
    const response = await createWithRetry({
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
              text: `Analyze this property photo.${ownerContext}

Return a JSON object with:
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

/**
 * Build a structured photo evidence brief for the system prompt.
 * This gives the AI a detailed, photo-by-photo breakdown it can cite directly.
 */
function buildPhotoEvidenceBrief(
  photos: NonNullable<NarrativePayload['photoAnalyses']>,
  attribution?: NarrativePayload['photoAttribution']
): string {
  const totalDefects = photos.reduce((sum, p) => sum + p.defects.length, 0);
  const significantDefects = photos.reduce(
    (sum, p) => sum + p.defects.filter(d => d.severity === 'significant').length, 0
  );
  const moderateDefects = photos.reduce(
    (sum, p) => sum + p.defects.filter(d => d.severity === 'moderate').length, 0
  );
  const highImpactDefects = photos.reduce(
    (sum, p) => sum + p.defects.filter(d => d.value_impact === 'high').length, 0
  );

  // Build per-photo detail
  const photoDetails = photos.map((photo, idx) => {
    const defectSummary = photo.defects.length > 0
      ? photo.defects.map(d =>
          `    - [${d.severity.toUpperCase()}/${d.value_impact} impact] ${d.type}: ${d.description}${d.report_language ? `\n      Report language: "${d.report_language}"` : ''}`
        ).join('\n')
      : '    - No defects identified in this view';

    return `  Photo ${idx + 1} (${photo.photo_type}): condition = ${photo.condition_rating}
    Caption: "${photo.professional_caption}"
${defectSummary}
    Comparable adjustment note: ${photo.comparable_adjustment_note || 'N/A'}`;
  }).join('\n\n');

  return `
═══════════════════════════════════════════════════════════════════════
PROPRIETARY PHOTO EVIDENCE — OUR COMPETITIVE ADVANTAGE
This is firsthand evidence the assessor NEVER had access to.
The county assessed this property from a desk. We have eyes on the ground.
═══════════════════════════════════════════════════════════════════════

EVIDENCE SUMMARY:
- ${photos.length} photographs analyzed by AI vision
- ${totalDefects} total condition issues documented
- ${significantDefects} significant defects, ${moderateDefects} moderate defects
- ${highImpactDefects} defects with HIGH value impact
- Overall condition ratings: ${photos.map(p => `${p.photo_type}: ${p.condition_rating}`).join(', ')}

DETAILED PHOTO-BY-PHOTO EVIDENCE:
${photoDetails}

HOW TO USE THIS EVIDENCE (CRITICAL INSTRUCTIONS):
1. CONDITION ASSESSMENT SECTION: This section is your showcase. Walk through each photo methodically. For every defect, explain what it means for value in plain language a board member can understand. Use the report_language from each defect — it's pre-written for formal use.

2. EXECUTIVE SUMMARY: Open with the fact that this analysis includes ${photos.length} independently analyzed photographs documenting property condition — evidence the assessor did not have. This immediately establishes credibility over the assessor's desk-based valuation.

3. PROPERTY/IMPROVEMENT DESCRIPTIONS: Reference specific photo evidence when describing the property. Don't just say "the roof shows wear" — say "as documented in the roof photograph, [specific defect] was identified with [severity] severity, indicating [value impact]."

4. SALES COMPARISON: When applying condition adjustments to comparables, tie EVERY adjustment back to specific photographed evidence. "A ${photos.reduce((sum, p) => sum + p.defects.filter(d => d.severity !== 'minor').length, 0)} documented condition issues warrant a negative condition adjustment of [X]% relative to [comp address], which sold in [assumed better] condition."

5. RECONCILIATION: State clearly that the concluded value incorporates documented physical condition that reduces value below what the assessor assumed. The assessor used standard assumptions; we have photographic proof.

6. APPEAL ARGUMENTS: At least 2 of your numbered arguments MUST lead with photo evidence. Frame it as: "The assessor valued this property assuming [standard condition]. Our independent photographic analysis documents [X defects] including [most impactful]. This documented condition evidence supports a value of $Y, not the assessed $Z."

The photos are your secret weapon. The assessor has spreadsheets. You have eyes on the property. Use them relentlessly.
${attribution && attribution.photoImpactDollars > 0 ? `
PHOTO EVIDENCE CONTEXT (internal — DO NOT show two separate values to the client):
- The concluded value already incorporates the condition evidence from photos.
- Present ONE final value only. Do NOT mention a "market-data-only value" or show a before/after comparison.
- Condition adjustment applied: ${attribution.photoConditionAdjustmentPct}%
- Evidence basis: ${attribution.totalDefects} documented defects (${attribution.significantDefects} significant)

When discussing condition in the narrative, explain that photographic documentation revealed specific defects
(reference the defects from the photo analyses above) that the assessor's records do not reflect, and that the
concluded value accounts for these documented conditions. Frame it as: the concluded value reflects the TRUE
condition of the property as documented by our independent inspection, not a theoretical adjustment.` : ''}
═══════════════════════════════════════════════════════════════════════`;
}

function buildNarrativeSystemPrompt(payload: NarrativePayload): string {
  const county = payload.countyRules.countyName;
  const state = payload.countyRules.state;

  // Build county expertise context — everything we know about how this county operates
  const countyExpertise: string[] = [];
  countyExpertise.push(`Assessment methodology: ${payload.countyRules.assessmentMethodology}`);
  if (payload.countyRules.assessmentRatioResidential != null) {
    countyExpertise.push(`Statutory residential assessment ratio: ${payload.countyRules.assessmentRatioResidential}`);
  }
  if (payload.countyRules.assessmentRatioCommercial != null) {
    countyExpertise.push(`Statutory commercial assessment ratio: ${payload.countyRules.assessmentRatioCommercial}`);
  }
  if (payload.countyRules.assessmentCycle) {
    countyExpertise.push(`Assessment cycle: ${payload.countyRules.assessmentCycle}`);
  }
  if (payload.countyRules.appealBoardName) {
    countyExpertise.push(`Appeal board: ${payload.countyRules.appealBoardName}`);
  }
  if (payload.countyRules.appealDeadlineRule) {
    countyExpertise.push(`Appeal deadline rule: ${payload.countyRules.appealDeadlineRule}`);
  }
  if (payload.countyRules.hearingFormat) {
    countyExpertise.push(`Hearing format: ${payload.countyRules.hearingFormat}`);
  }
  if (payload.countyRules.informalReviewAvailable) {
    countyExpertise.push(`Informal review: available — recommend the homeowner request this first`);
  }
  if (payload.countyRules.proSeTips) {
    countyExpertise.push(`County-specific pro se tips: ${payload.countyRules.proSeTips}`);
  }
  if (payload.countyRules.boardPersonalityNotes) {
    countyExpertise.push(`Board personality & hearing tips: ${payload.countyRules.boardPersonalityNotes}`);
  }
  if (payload.countyRules.winningArgumentPatterns) {
    countyExpertise.push(`Winning argument patterns in this county: ${payload.countyRules.winningArgumentPatterns}`);
  }
  if (payload.countyRules.commonAssessorErrors) {
    countyExpertise.push(`Common assessor errors to exploit: ${payload.countyRules.commonAssessorErrors}`);
  }
  if (payload.countyRules.successRatePct) {
    countyExpertise.push(`Historical appeal success rate: ${payload.countyRules.successRatePct}%`);
  }

  const hasPhotos = payload.photoAnalyses && payload.photoAnalyses.length > 0;

  // Service-type-specific framing
  const serviceFraming = payload.serviceType === 'pre_listing'
    ? `You are an expert property valuation analyst preparing a pre-listing analysis for ${county} County, ${state}. Your client is SELLING this property and wants to understand its true market value to price competitively. Your mission is to build an accurate, favorable market position — highlight strengths, acknowledge weaknesses honestly, and conclude at a defensible value that helps the seller maximize their outcome. You work FOR the seller.`
    : payload.serviceType === 'pre_purchase'
      ? `You are an expert property valuation analyst preparing a pre-purchase analysis for ${county} County, ${state}. Your client is BUYING this property and needs to know its true market value to negotiate effectively. Your mission is to uncover every legitimate reason the asking price may be too high — deferred maintenance, market softness, comparable sales, condition issues. You are the buyer's advocate. Every deficiency you document is negotiation leverage.`
      : `You are a relentless, investigative property valuation analyst who specializes in ${county} County, ${state}. You have spent years studying how ${county} County's assessor operates — their methodology, their common errors, their tendencies to over-assess, and the specific pressure points that win appeals before ${payload.countyRules.appealBoardName || 'the local board of review'}. Your mission is to build the strongest possible case that the assessment is wrong.`;

  const desiredOutcomeContext = payload.desiredOutcome
    ? `\n\nCLIENT'S STATED GOAL: "${payload.desiredOutcome}"\nFactor this into your analysis. Align your conclusions and emphasis with what the client is trying to achieve, while keeping all numbers accurate and defensible.`
    : '';

  return `${serviceFraming}

You work FOR the property owner. You are thorough, aggressive in advocacy, and meticulous with data. You leave no stone unturned. If there is an angle that helps your client, you find it and you quantify it.

You are NOT a neutral party. You are your client's expert witness. Every number you cite must be accurate and defensible, but your interpretation always favors the property owner within the bounds of professional ethics.${desiredOutcomeContext}

YOUR EXPERTISE IN ${county.toUpperCase()} COUNTY, ${state.toUpperCase()}:
${countyExpertise.map(e => `- ${e}`).join('\n')}
${payload.researchIntelligence?.strategyInsights ? `
LIVE RESEARCH INTELLIGENCE (researched for this specific report):
${payload.researchIntelligence.strategyInsights}
${payload.researchIntelligence.deadlineInfo ? `\nCURRENT DEADLINE INFO: ${payload.researchIntelligence.deadlineInfo}` : ''}
${payload.researchIntelligence.boardIntelligence ? `\nBOARD INTELLIGENCE: ${payload.researchIntelligence.boardIntelligence}` : ''}
${payload.researchIntelligence.recentChanges ? `\nRECENT CHANGES: ${payload.researchIntelligence.recentChanges}` : ''}
Use this research to make your analysis current and county-specific. Reference specific procedures, deadlines, or strategies where relevant.` : ''}

You must return valid JSON — an array of objects with these keys:
- "section_name": one of the exact values listed below
- "content": the narrative text (may include Markdown)

Required section_name values (generate ALL that apply, in this order):
1. "executive_summary" — lead with the dollar amount the homeowner is being overcharged, the concluded market value, and a confident summary of why the assessment is wrong${hasPhotos ? '. Mention that the analysis includes firsthand photographic evidence of property condition that the assessor never reviewed.' : ''}
2. "property_description" — physical description emphasizing any characteristics that would LOWER value (age, deferred maintenance, functional obsolescence, layout inefficiencies)${hasPhotos ? '. Weave in specific observations from the photo evidence — reference individual photos by type (e.g., "as shown in the front elevation photograph") when describing condition.' : ''}
3. "site_description_narrative" — site description noting any adverse factors (flood zone, noise, traffic, easements, irregular lot shape, proximity to commercial/industrial)${hasPhotos ? '. Reference any site-level issues visible in exterior photos (drainage, grading, neighboring conditions).' : ''}
4. "improvement_description_narrative" — improvement description, emphasizing depreciation, outdated systems, and any features that don't add proportional value${hasPhotos ? '. Cite specific photo evidence of deterioration, deferred maintenance, and age-related wear documented in the condition analysis.' : ''}
${hasPhotos ? `5. "condition_assessment" — THIS IS YOUR MOST POWERFUL SECTION. The assessor valued this property without setting foot inside or examining it up close. The homeowner's photographs tell the REAL story. For each photo submitted:
   - State what the photo shows (type: front, rear, interior, roof, etc.)
   - List every defect identified with severity and estimated value impact
   - Explain in plain language why this condition reduces value below what the assessor assumed
   - Quantify: "This level of [defect] typically warrants a [X-Y]% condition adjustment in comparable sales analysis"
   - Reference the comparable_adjustment_note for each photo

   End with a summary: total number of documented defects, overall condition rating, and the aggregate value impact. Frame this as: "The assessor's records assume [assumed condition]. Our on-site photographic evidence documents [actual condition]. This discrepancy alone accounts for approximately $[X] in overassessment."

   This section should be substantial — it is evidence the county does not have and cannot refute.` : ''}
${hasPhotos ? '6' : '5'}. "area_analysis_county" — ${county} County market context, noting any factors that suppress values (tax burden, population trends, economic conditions, inventory levels)
${hasPhotos ? '7' : '6'}. "area_analysis_city" — city-level analysis with focus on factors that limit appreciation
${hasPhotos ? '8' : '7'}. "area_analysis_neighborhood" — hyperlocal neighborhood analysis — competing listings, days on market, any negative externalities
${hasPhotos ? '9' : '8'}. "market_analysis" — market conditions and trends, emphasizing any softness, rising inventory, or declining price trends
${hasPhotos ? '10' : '9'}. "hbu_as_vacant" — highest and best use as if vacant
${hasPhotos ? '11' : '10'}. "hbu_as_improved" — highest and best use as improved
${hasPhotos ? '12' : '11'}. "sales_comparison_narrative" — aggressive comparable sales analysis: explain why each comp supports a LOWER value than the assessor's, call out every adjustment that works in the homeowner's favor${hasPhotos ? '. When discussing condition adjustments, explicitly tie them back to the photographic evidence: "Based on the documented [defect type] shown in the property photographs, a condition adjustment of [X]% is warranted when comparing to [comp address]."' : ''}
${hasPhotos ? '13' : '12'}. "adjustment_grid_narrative" — methodical explanation of every adjustment, framed to support the lower concluded value${hasPhotos ? '. The condition adjustment line item should reference the photo evidence summary.' : ''}
${payload.comparableRentals?.length ? `${hasPhotos ? '14' : '13'}. "income_approach_narrative" — rental income analysis showing the income-derived value is below the assessed value` : ''}
${payload.overvaluationAnalysis?.costApproachValue != null ? `${hasPhotos ? '15' : '14'}. "cost_approach_narrative" — USPAP Cost Approach: present the replacement cost new (RCN), physical depreciation, ${payload.overvaluationAnalysis.functionalObsolescencePct ? 'functional obsolescence, ' : ''}and land value. Show the math step by step: "RCN of $[X] × (1 − [Y]% total depreciation) + land value of $[Z] = cost approach indicator of $[W]." If the cost approach value is BELOW the assessed value, this is a powerful third line of evidence converging with the sales comparison${payload.comparableRentals?.length ? ' and income approaches' : ''}. State explicitly: "Three independent valuation approaches all indicate a market value below the assessor's figure." If it exceeds the assessed value, address it honestly — explain why the cost approach may be less reliable here (e.g., land value uncertainty, market obsolescence) — do not suppress it.` : ''}
${hasPhotos ? '16' : '15'}. "reconciliation_narrative" — final value reconciliation: state the concluded value with conviction, quantify the exact overassessment in dollars and percentage, and recommend the assessment be reduced. When cost approach data is present, state which approaches were used and how they were weighted. ${hasPhotos ? 'Explicitly state that the concluded value reflects documented property condition from firsthand photographic evidence — evidence the assessor did not have when setting the assessed value.' : ''}
${payload.serviceType === 'tax_appeal' ? `${hasPhotos ? '17' : '16'}. "appeal_argument_summary" — the homeowner's battle plan: 5-7 numbered arguments, each a specific, quotable statement they can read to ${payload.countyRules.appealBoardName || 'the board'}. Lead with the strongest argument. Include exact dollar figures. End with a clear ask: "I respectfully request the assessed value be reduced from $X to $Y."${hasPhotos ? ' At least 2 of the arguments MUST reference the photographic evidence directly — these are your most persuasive points because the board can see the evidence with their own eyes.' : ''}` : ''}

COUNTER-ARGUMENT PREPARATION — ANTICIPATE AND DEFEAT THE ASSESSOR'S RESPONSE:
In the reconciliation_narrative, include a "Preemptive Rebuttals" subsection that addresses the 2-3 most likely assessor counter-arguments:
- If you cite comparable sales below assessed value: address why the assessor might argue your comps are dissimilar, and preemptively explain why your adjustments account for those differences.
- If you cite condition issues: address the assessor's likely claim that photos are selective or don't represent the full property. Counter with the breadth and specificity of your documentation.
- If you cite assessment ratio violations: address whether the assessor might argue a different effective date or methodology. Counter with the statutory requirement.
This transforms the report from one-sided advocacy into a document that has already anticipated and defeated the opposing position — exactly what board members want to see.

INVESTIGATIVE MANDATE — LEAVE NO STONE UNTURNED:
You are an investigator, not a reporter. Do not merely describe the data — interrogate it. For every data point, ask: "Does this help the homeowner's case?" If yes, amplify it with context. If no, explain why it's irrelevant or misleading.

You MUST investigate ALL of the following angles and report findings in the reconciliation_narrative and appeal_argument_summary:

1. PRICE PER SQUARE FOOT ANALYSIS: Calculate the assessor's implied $/sqft and compare it against every comparable sale's $/sqft. If the assessor's number is higher than even a single comp, call it out. If it's higher than the median, that's a headline finding.

2. ASSESSMENT RATIO MATH: Calculate: assessed_value ÷ concluded_market_value. If this implied ratio exceeds ${county} County's statutory ratio by even 1%, the assessment is mathematically indefensible. Show the math step by step — appeal boards respond to clear arithmetic.

3. COMP-BY-COMP DEMOLITION: For each comparable sale, explain exactly why it supports a value below the assessment. Don't just list adjustments — tell the story. "123 Oak St sold for $X, and it has [better feature] than the subject — meaning the subject is worth even less."

4. TEMPORAL ANALYSIS: Sort comps by date. If more recent sales are lower, the assessor is using stale data. If the market is softening, say so explicitly and quantify the trend.

5. ASSESSOR DATA AUDIT: Scrutinize every field in the assessor's records. Wrong square footage? Wrong year built? Missing depreciation? Incorrect property class? Each error is ammunition. Flag every discrepancy you find.

6. INDEPENDENT VALUE RANGE CHECK: If the assessed value exceeds independent AVM estimates, that's powerful evidence. The assessor's own data source may contradict their conclusion.

7. DEPRECIATION ANALYSIS: Use the pre-computed depreciation facts provided in the property data — effective_age, physical_depreciation_pct, remaining_economic_life, and economic_life_years. These are IAAO-standard calculations based on the building category's total economic life. If the property data shows physical_depreciation_pct > 40%, the assessment MUST reflect this accumulated depreciation — if it doesn't, this is a major line of attack. State the numbers explicitly: "With an effective age of X years against a standard economic life of Y years for [building category], the subject has accumulated Z% physical depreciation. The assessor's failure to account for this depreciation results in a [dollar amount] overstatement of improvement value." If effective_age_source is "photo_adjusted", emphasize that the effective age reflects observed condition from firsthand photographic inspection — not a generic assumption.

8. ADVERSE CONDITIONS: Flood zones, environmental hazards, proximity to nuisances, deferred maintenance — every negative factor that the assessor may have ignored. Quantify the impact where possible.

9. FUNCTIONAL/EXTERNAL OBSOLESCENCE: Use the pre-computed functional obsolescence data from the property analysis. If functional_obsolescence_pct > 0, the system has already quantified incurable super-adequacy — the subject is materially larger than the neighborhood median, and the market will not pay replacement cost for the excess. State this explicitly: "The subject's [X,XXX sqft] exceeds the neighborhood median by Y%, resulting in Z% incurable functional obsolescence that the assessor has not accounted for." External obsolescence from flood zones, busy roads, or commercial adjacency should also be cited and quantified.

10. EQUITY ANALYSIS: If the subject's assessed value per sqft significantly exceeds nearby properties of similar quality, that's an equal-protection argument. The assessment must be equitable.

11. CONDITIONS OF SALE: Note how many comparable sales in the analysis grid were distressed (REO, foreclosure, short sale). Each was adjusted upward by 12% to arms-length equivalent. If you see distressedCompCount > 0 in the data, note this in adjustment_grid_narrative: "Of the [N] comparable sales analyzed, [X] required conditions-of-sale adjustments to reflect arms-length market conditions, ensuring the analysis is not contaminated by non-market transactions."

${payload.overvaluationAnalysis ? `
EVIDENCE DOSSIER (pre-computed — cite these exact numbers, they are verified):
${payload.overvaluationAnalysis.overvaluationPct != null ? `- CRITICAL: Assessed value per sqft: $${payload.overvaluationAnalysis.assessedValuePerSqft}/sqft vs median comp: $${payload.overvaluationAnalysis.medianCompPricePerSqft}/sqft → OVER-ASSESSED by ${payload.overvaluationAnalysis.overvaluationPct > 0 ? `${payload.overvaluationAnalysis.overvaluationPct.toFixed(1)}%` : 'within market range — investigate other angles harder'}` : ''}
${payload.overvaluationAnalysis.assessmentRatioMismatch ? `- SMOKING GUN: Implied assessment ratio is ${payload.overvaluationAnalysis.assessmentRatioImplied?.toFixed(3)} but ${county} County's statutory ratio is ${payload.overvaluationAnalysis.assessmentRatioExpected?.toFixed(3)} — the assessment EXCEEDS the legal maximum. This alone should win the appeal.` : ''}
${payload.overvaluationAnalysis.assessedExceedsAttomRange ? `- INDEPENDENT CONFIRMATION: Assessed value EXCEEDS the high end of independent AVM estimate ($${payload.overvaluationAnalysis.attomMarketRangeHigh?.toLocaleString()}) — even aggressive market estimates can't justify this assessment` : ''}
${payload.overvaluationAnalysis.marketTrendPct != null && payload.overvaluationAnalysis.marketTrendPct < -2 ? `- STALE DATA ALERT: Comparable sales show a ${Math.abs(payload.overvaluationAnalysis.marketTrendPct).toFixed(1)}% declining trend — the assessor appears to be using outdated valuations that don't reflect current market reality` : ''}
${payload.overvaluationAnalysis.physicalDepreciationPct != null && payload.overvaluationAnalysis.physicalDepreciationPct > 30 ? `- DEPRECIATION WEAPON: Property has accumulated ${payload.overvaluationAnalysis.physicalDepreciationPct.toFixed(1)}% physical depreciation (effective age: ${payload.overvaluationAnalysis.effectiveAge ?? 'N/A'} years, remaining economic life: ${payload.overvaluationAnalysis.remainingEconomicLife ?? 'N/A'} years). If the assessor has not applied proportional depreciation to the improvement value, this is a mathematically indefensible error. Lead with this in the improvement_description_narrative.` : ''}
${payload.overvaluationAnalysis.isUnderassessed ? `- STRATEGIC NOTE (INTERNAL — HANDLE WITH CARE): Our analysis indicates the property may actually be UNDER-assessed by approximately ${payload.overvaluationAnalysis.underassessmentPct?.toFixed(1)}%. ${payload.serviceType === 'tax_appeal' ? 'Include a brief, tactful advisory in the reconciliation that filing an appeal may invite the assessor to review the assessment upward. The owner should understand this risk before filing. Do NOT recommend against filing — just ensure they have informed consent.' : payload.serviceType === 'pre_purchase' ? 'Frame this as a strategic advantage — the buyer is acquiring a property with below-market assessed value, meaning lower taxes until the next reassessment cycle. Quantify the annual tax savings.' : 'Note this in the executive summary as a finding — the property appears to be assessed below its market value.'}` : ''}
${payload.overvaluationAnalysis.caseStrengthScore != null ? `- CASE STRENGTH: ${payload.overvaluationAnalysis.caseStrengthScore}/100${payload.overvaluationAnalysis.caseStrengthScore >= 75 ? ' — STRONG CASE. Express confidence in the executive summary and appeal arguments. This case has multiple converging lines of evidence.' : payload.overvaluationAnalysis.caseStrengthScore >= 50 ? ' — MODERATE CASE. Focus arguments on the strongest 2-3 evidence points rather than spreading thin.' : ' — the evidence is limited. Be measured in tone while still advocating for the homeowner. Acknowledge where the assessment may have some basis while still pressing the strongest arguments.'}` : ''}
${payload.overvaluationAnalysis.costApproachValue != null && payload.overvaluationAnalysis.costApproachValue < (payload.overvaluationAnalysis.buildingSqftFromAssessor ?? 0) * (payload.overvaluationAnalysis.assessedValuePerSqft ?? 0) + (payload.overvaluationAnalysis.landValue ?? 0) ? `- COST APPROACH CONVERGENCE: The USPAP Cost Approach yields $${payload.overvaluationAnalysis.costApproachValue.toLocaleString()} — below the assessed value. RCN: $${payload.overvaluationAnalysis.costApproachRcn?.toLocaleString()}. This is the third independent valuation method confirming overassessment. Cite it in the reconciliation as three-approach convergence: "Sales comparison, ${payload.comparableRentals?.length ? 'income approach, and cost approach all' : 'and cost approach both'} indicate a market value below $${(payload.overvaluationAnalysis.costApproachValue + 50000).toLocaleString()}."` : payload.overvaluationAnalysis.costApproachValue != null ? `- COST APPROACH: Yields $${payload.overvaluationAnalysis.costApproachValue.toLocaleString()} (RCN: $${payload.overvaluationAnalysis.costApproachRcn?.toLocaleString()}). Present in cost_approach_narrative but note this approach is least reliable for market value — give it less weight in the reconciliation.` : ''}
${payload.overvaluationAnalysis.functionalObsolescencePct != null && payload.overvaluationAnalysis.functionalObsolescencePct > 0 ? `- FUNCTIONAL OBSOLESCENCE: ${payload.overvaluationAnalysis.functionalObsolescencePct.toFixed(1)}% incurable super-adequacy. ${payload.overvaluationAnalysis.functionalObsolescenceNotes ?? ''} Cite this in improvement_description_narrative and cost_approach_narrative.` : ''}
${(payload.overvaluationAnalysis.distressedCompCount ?? 0) > 0 ? `- CONDITIONS OF SALE: ${payload.overvaluationAnalysis.distressedCompCount} of ${payload.comparableSales.length} comparable sales were distressed (REO/foreclosure/short sale) and received +12% arms-length conditions-of-sale adjustment. Note this in adjustment_grid_narrative to demonstrate methodological rigor.` : ''}
${payload.overvaluationAnalysis.dataAnomalies.length > 0 ? `- ASSESSOR DATA ERRORS:\n${payload.overvaluationAnalysis.dataAnomalies.map(a => `  → ${a}`).join('\n')}` : ''}
` : ''}
${hasPhotos ? buildPhotoEvidenceBrief(payload.photoAnalyses!, payload.photoAttribution) : ''}

TONE: Write with the confidence of an expert witness who has testified before ${payload.countyRules.appealBoardName || 'boards of review'} hundreds of times. Be specific, cite numbers, and make every paragraph advance the homeowner's case. Professional but assertive — never timid, never hedging. The homeowner is paying for advocacy, not neutrality.`;
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
