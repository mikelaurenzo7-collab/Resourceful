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
    assessmentCycle?: string | null;
    appealDeadlineRule?: string | null;
    hearingFormat?: string | null;
    informalReviewAvailable?: boolean | null;
    proSeTips?: string | null;
    stateAppealStrategies?: string | null;
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
  authorizedRepFormUrl?: string | null;
  repRestrictionsNotes?: string | null;
  furtherAppealBody?: string | null;
  furtherAppealDeadlineRule?: string | null;
  furtherAppealUrl?: string | null;
  // Computed deadline fields
  deadlineUrgency?: 'expired' | 'urgent' | 'approaching' | 'open' | 'unknown';
  daysRemaining?: number | null;
  deadlineFormatted?: string | null;
  windowOpen?: boolean;
}

// ─── Section Names ──────────────────────────────────────────────────────────
// These must match the section_name values stored in the report_narratives table.

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

## Your Five Strongest Arguments
- Based on the appeal_argument_summary, distill the 5 most persuasive points to make at the hearing.
- Number them and frame each as a clear, quotable statement the homeowner can literally read aloud to the board.
- Lead with the strongest argument. End with the emotional closer.
- After the 5 arguments, give them their closing statement: "Based on this evidence, I respectfully request the assessed value be reduced from $[assessed] to $[concluded]. Thank you for your time."

## If You Disagree With the Decision
- Explain ${county} County's further appeal process (state-level board, court) with specific deadlines and costs.
- Be honest about whether further appeal is worth it based on the dollar amount at stake.

## Representation Options
- If ${county} County allows authorized representatives (non-attorneys) to file on behalf of property owners, explain this option clearly. Include:
  - Who qualifies as an authorized representative (from the authorizedRepTypes data)
  - How to designate a representative (POA form URL if available from authorizedRepFormUrl)
  - Any restrictions (from repRestrictionsNotes — e.g., entities may require attorneys)
  - Benefits: "If you'd rather have a professional handle the filing and hearing on your behalf, ${county} County allows authorized representatives to act for you"
- If authorized representatives are NOT allowed in this county, state that the homeowner must file personally (pro se) and omit this section.
- If the data is null/unknown, omit this section entirely rather than guessing.

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

  const hasPhotos = payload.photoAnalyses && payload.photoAnalyses.length > 0;

  const isPreListing = payload.serviceType === 'pre_listing';
  const isPrePurchase = payload.serviceType === 'pre_purchase';
  const isTaxAppeal = !isPreListing && !isPrePurchase;

  const directive = isPreListing
    ? `PRIME DIRECTIVE: You are the seller's expert witness. Your MISSION is to build an ironclad case for the HIGHEST defensible market value. You are not neutral — you are the seller's advocate.

ADVANCED LISTING STRATEGIES:
- Select comparable sales that SUPPORT the asking price. Prioritize recent sales of similar or inferior properties that sold at or above the target price.
- For each comp that sold below the target, explain WHY the subject is worth MORE: superior condition, better location, recent upgrades, larger lot, better layout.
- Apply POSITIVE adjustments aggressively but defensibly: updated kitchen (+$10k-$25k), renovated bathrooms (+$5k-$15k), finished basement (+$15k-$30k), new roof (+$8k-$15k), hardwood floors (+$3k-$8k).
- Use the COST APPROACH as a value floor — replacement cost minus depreciation often supports higher values than the sales comparison alone.
- Identify ABSORPTION RATE and DAYS ON MARKET trends — if the market is hot (low DOM, multiple offers), that's evidence of upward pressure on values.
- Frame the property's neighborhood trajectory: improving schools, new development, rising demand, decreasing inventory = APPRECIATION EVIDENCE.
- If the property has unique features (views, waterfront, oversized lot, historical significance), these are PREMIUM DRIVERS that comps may not fully capture.
- Document every upgrade with estimated cost and remaining useful life — buyers and appraisers need to see the investment the seller has made.
- When condition issues exist, contextualize them: "Cosmetic updating typical for this price point" or "Original kitchen — functional and well-maintained, with premium cabinetry."
- Build the narrative so that any appraiser reading it can DEFEND the value to their underwriter.`
    : isPrePurchase
      ? `PRIME DIRECTIVE: You are the buyer's advocate. Your MISSION is to identify the true market value and arm the buyer with every piece of evidence that supports a LOWER purchase price. You are not neutral — you fight for the buyer's wallet.

ADVANCED BUYER PROTECTION STRATEGIES:
- Select comparable sales that show the LOWEST defensible value. Prioritize distressed sales, foreclosures, and below-market transactions that pull the value range down.
- For each comp that sold above the subject's target price, explain WHY those sales are NOT reliable indicators: bidding war premiums, seller concessions hidden in price, superior condition/upgrades, different micro-location.
- Apply NEGATIVE adjustments thoroughly: every deferred maintenance item is a cost the buyer inherits. Quantify repair costs for each issue.
- Calculate the COST OF OWNERSHIP beyond purchase price: property taxes (use current assessment), insurance estimates, immediate repair needs, system replacements within 5 years. Present the TRUE cost.
- Identify MARKET RISK FACTORS: rising inventory, increasing DOM, price reductions in the area, interest rate sensitivity. If the market is softening, the buyer should know — they have leverage.
- Investigate the SELLER'S POSITION: How long has the property been listed? Any price reductions? How does the asking price compare to original list? Time on market = negotiating power.
- Use the INCOME APPROACH if applicable — what would this property rent for? If the implied cap rate is poor, the price is too high relative to income potential.
- Document HIDDEN COSTS the listing doesn't mention: HOA special assessments, deferred community maintenance, pending local assessments, flood zone status.
- Flag any RED FLAGS in the listing: "as-is" language, disclosure gaps, unusual terms, recent price drops.
- Your report gives the buyer a professional basis to offer BELOW asking price — with evidence, not emotion.`
      : `PRIME DIRECTIVE: You are the homeowner's advocate. Be user-friendly first — write in language that empowers and reassures. Be investigative second — leave no angle unexplored, no data point unquestioned, no possibility of incorrect assessment overlooked. Your job is to find EVERY SINGLE reason this property may be over-assessed and present it compellingly.`;

  return `${directive}

You are a relentless, investigative property valuation analyst who specializes in ${county} County, ${state}. You have spent years studying how ${county} County's assessor operates — their methodology, their common errors, their tendencies to over-assess, and the specific pressure points that win appeals before ${payload.countyRules.appealBoardName || 'the local board of review'}.

You work FOR the property owner. Your mission is to build the strongest possible case by uncovering every legitimate piece of evidence that the assessment is wrong. You are thorough, aggressive in advocacy, and meticulous with data. You leave no stone unturned. If there is an angle that helps the homeowner, you find it and you quantify it.

You are NOT a neutral party. You are the homeowner's expert witness. Every number you cite must be accurate and defensible, but your interpretation always favors the property owner within the bounds of professional ethics.

INVESTIGATIVE MINDSET — YOU MUST:
- Question every assumption the assessor made. If they assumed "average condition," prove it's below average.
- Look for errors in the assessor's data — wrong square footage, wrong year built, missing depreciation, incorrect property class. Every error is leverage.
- Calculate value from EVERY possible angle (price per sqft, income approach, cost approach, paired sales) and use whichever produces the LOWEST defensible value.
- Compare the assessment to EVERY comparable sale and highlight every sale below the assessed value.
- Identify neighborhood trends, market softness, or adverse factors the assessor may have ignored.
- When in doubt, interpret in the homeowner's favor. The assessor already interpreted in the county's favor — you balance the scales.

YOUR EXPERTISE IN ${county.toUpperCase()} COUNTY, ${state.toUpperCase()}:
${countyExpertise.map(e => `- ${e}`).join('\n')}
${payload.countyRules.stateAppealStrategies ? `\nSTATE-SPECIFIC ADVANCED STRATEGIES FOR ${state.toUpperCase()}:
${payload.countyRules.stateAppealStrategies}

STRATEGY SELECTION DIRECTIVE: The state strategies above contain sections for different service types (TAX APPEALS, PRE-LISTING, PRE-PURCHASE, COMMERCIAL). You MUST:
1. Read the "ASSESSMENT FUNDAMENTALS" section — this applies to ALL service types.
2. Focus PRIMARILY on the section matching this report's service type: "${payload.serviceType === 'pre_listing' ? 'FOR PRE-LISTING — PROVE HIGHER VALUE' : payload.serviceType === 'pre_purchase' ? 'FOR PRE-PURCHASE — PROTECT THE BUYER' : 'FOR TAX APPEALS — PROVE LOWER VALUE'}".
3. If this is a ${payload.propertyType === 'commercial' || payload.propertyType === 'industrial' ? 'commercial/industrial' : 'residential'} property, ${payload.propertyType === 'commercial' || payload.propertyType === 'industrial' ? 'ALSO apply the "COMMERCIAL PROPERTY TACTICS" section — income approach arguments are critical.' : 'you may still reference commercial tactics if the property has mixed-use characteristics.'}
4. Use the "SETTLEMENT & HEARING STRATEGY" section to craft the appeal_argument_summary with language that wins at ${payload.countyRules.appealBoardName || 'the local board'}.
5. When photo evidence exists, integrate the cost-to-cure and condition documentation guidance from the strategy into your condition_assessment and appeal arguments.` : ''}

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
${hasPhotos ? '15' : '14'}. "reconciliation_narrative" — final value reconciliation: state the concluded value with conviction, quantify the exact overassessment in dollars and percentage, and recommend the assessment be reduced${hasPhotos ? '. Explicitly state that the concluded value reflects documented property condition from firsthand photographic evidence — evidence the assessor did not have when setting the assessed value.' : ''}
${payload.serviceType === 'tax_appeal' ? `${hasPhotos ? '16' : '15'}. "appeal_argument_summary" — the homeowner's battle plan: 5-7 numbered arguments, each a specific, quotable statement they can read to ${payload.countyRules.appealBoardName || 'the board'}. Lead with the strongest argument. Include exact dollar figures. End with a clear ask: "I respectfully request the assessed value be reduced from $X to $Y."${hasPhotos ? ' At least 2 of the arguments MUST reference the photographic evidence directly — these are your most persuasive points because the board can see the evidence with their own eyes.' : ''}` : ''}

INVESTIGATIVE MANDATE — LEAVE NO STONE UNTURNED:
You are an investigator, not a reporter. Do not merely describe the data — interrogate it. For every data point, ask: "Does this help the homeowner's case?" If yes, amplify it with context. If no, explain why it's irrelevant or misleading.

You MUST investigate ALL of the following angles and report findings in the reconciliation_narrative and appeal_argument_summary:

1. PRICE PER SQUARE FOOT ANALYSIS: Calculate the assessor's implied $/sqft and compare it against every comparable sale's $/sqft. If the assessor's number is higher than even a single comp, call it out. If it's higher than the median, that's a headline finding.

2. ASSESSMENT RATIO MATH: Calculate: assessed_value ÷ concluded_market_value. If this implied ratio exceeds ${county} County's statutory ratio by even 1%, the assessment is mathematically indefensible. Show the math step by step — appeal boards respond to clear arithmetic.

3. COMP-BY-COMP DEMOLITION: For each comparable sale, explain exactly why it supports a value below the assessment. Don't just list adjustments — tell the story. "123 Oak St sold for $X, and it has [better feature] than the subject — meaning the subject is worth even less."

4. TEMPORAL ANALYSIS: Sort comps by date. If more recent sales are lower, the assessor is using stale data. If the market is softening, say so explicitly and quantify the trend.

5. ASSESSOR DATA AUDIT: Scrutinize every field in the assessor's records. Wrong square footage? Wrong year built? Missing depreciation? Incorrect property class? Each error is ammunition. Flag every discrepancy you find.

6. INDEPENDENT VALUE RANGE CHECK: If the assessed value exceeds independent AVM estimates, that's powerful evidence. The assessor's own data source may contradict their conclusion.

7. DEPRECIATION ANALYSIS: Calculate physical depreciation from age. If the property is 30+ years old with no major renovation, the assessment should reflect substantial accumulated depreciation. If it doesn't, challenge it.

8. ADVERSE CONDITIONS: Flood zones, environmental hazards, proximity to nuisances, deferred maintenance — every negative factor that the assessor may have ignored. Quantify the impact where possible.

9. FUNCTIONAL/EXTERNAL OBSOLESCENCE: Outdated floor plans, over-improvements for the neighborhood, external factors (busy road, commercial adjacency) — these reduce value and assessors frequently miss them.

10. EQUITY ANALYSIS: If the subject's assessed value per sqft significantly exceeds nearby properties of similar quality, that's an equal-protection argument. The assessment must be equitable.

11. COST APPROACH CROSS-CHECK: Estimate replacement cost minus depreciation. If the cost approach yields a value below the assessment, cite it — assessors often ignore accumulated depreciation.

12. MARKET TREND TRAJECTORY: If the market is flat or declining, the assessor's value should reflect current conditions — not peak values from prior years. Identify any lag in the assessor's data.

13. OVER-IMPROVEMENT ANALYSIS: If the property has features that exceed neighborhood norms (e.g., a $200k kitchen in a $300k neighborhood), the market won't recoup the full cost. The assessor may have added full value for features the market discounts.

14. HIGHEST AND BEST USE MISMATCH: If the assessor is valuing the property based on a use that doesn't match its actual use or zoning, challenge it. A single-family home valued as potential commercial is a common assessor error.

${payload.overvaluationAnalysis ? `
EVIDENCE DOSSIER (pre-computed — cite these exact numbers, they are verified):
${payload.overvaluationAnalysis.overvaluationPct != null ? `- CRITICAL: Assessed value per sqft: $${payload.overvaluationAnalysis.assessedValuePerSqft}/sqft vs median comp: $${payload.overvaluationAnalysis.medianCompPricePerSqft}/sqft → OVER-ASSESSED by ${payload.overvaluationAnalysis.overvaluationPct > 0 ? `${payload.overvaluationAnalysis.overvaluationPct.toFixed(1)}%` : 'within market range — investigate other angles harder'}` : ''}
${payload.overvaluationAnalysis.assessmentRatioMismatch ? `- SMOKING GUN: Implied assessment ratio is ${payload.overvaluationAnalysis.assessmentRatioImplied?.toFixed(3)} but ${county} County's statutory ratio is ${payload.overvaluationAnalysis.assessmentRatioExpected?.toFixed(3)} — the assessment EXCEEDS the legal maximum. This alone should win the appeal.` : ''}
${payload.overvaluationAnalysis.assessedExceedsAttomRange ? `- INDEPENDENT CONFIRMATION: Assessed value EXCEEDS the high end of independent AVM estimate ($${payload.overvaluationAnalysis.attomMarketRangeHigh?.toLocaleString()}) — even aggressive market estimates can't justify this assessment` : ''}
${payload.overvaluationAnalysis.marketTrendPct != null && payload.overvaluationAnalysis.marketTrendPct < -2 ? `- STALE DATA ALERT: Comparable sales show a ${Math.abs(payload.overvaluationAnalysis.marketTrendPct).toFixed(1)}% declining trend — the assessor appears to be using outdated valuations that don't reflect current market reality` : ''}
${payload.overvaluationAnalysis.dataAnomalies.length > 0 ? `- ASSESSOR DATA ERRORS:\n${payload.overvaluationAnalysis.dataAnomalies.map(a => `  → ${a}`).join('\n')}` : ''}
` : ''}
${hasPhotos ? buildPhotoEvidenceBrief(payload.photoAnalyses!, payload.photoAttribution) : ''}
${payload.calibrationContext && payload.calibrationContext.sampleSize > 0
  ? `\nCALIBRATION CREDIBILITY: This valuation methodology has been validated against ${payload.calibrationContext.sampleSize} independent professional appraisals${payload.calibrationContext.meanAbsoluteErrorPct != null ? ` with a mean absolute error of only ${payload.calibrationContext.meanAbsoluteErrorPct.toFixed(1)}%` : ''}. Mention this in the executive summary — it demonstrates our analysis is professionally calibrated, not speculative.`
  : ''}

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
