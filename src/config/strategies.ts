// ─── Strategy Resolution Engine ───────────────────────────────────────────────
// Resolves service type × property subtype × desired outcome → a concrete
// ResolvedStrategy that drives narrative tone, approach weights, and section
// selection throughout the pipeline.
//
// This is the single gate that every pipeline stage consults to know what to
// generate and how to frame it. No stage should make these decisions itself.
//
// This file imports only from config — never from pipeline stages or services.

import {
  type ServiceType,
  type DesiredOutcome,
  type ApproachWeights,
  NARRATIVE_SECTIONS,
  STAGE_6_GUIDE_TYPE,
  INCOME_APPROACH_ELIGIBLE_SUBTYPES,
  getApproachWeights,
} from './services';

// ─── Outcome Emphasis ─────────────────────────────────────────────────────────
// Each desired outcome maps to a directive injected into the AI system prompt.
// This is how the same property data produces a tax-fight report, a negotiation
// memo, or a listing strategy — the data is identical; the frame is not.

export const OUTCOME_EMPHASIS: Record<DesiredOutcome, string> = {
  // ── Tax Appeal ─────────────────────────────────────────────────────────────
  reduce_taxes:
    'Lead with the overassessment dollar amount. Build every argument to prove the county has overvalued the property. Quantify the annual tax savings the owner will realize if the assessment is corrected. End every section by circling back to the dollars at stake.',
  appeal_uniformity:
    'Lead with the equity argument: similarly-situated properties in the same neighborhood are assessed at lower ratios. Identify the disparity in assessed-value-per-sqft between the subject and its neighbors. Frame this as a violation of equal protection under the state constitution — taxpayers must be treated uniformly.',
  appeal_procedural:
    'Lead with procedural errors in the assessment record: wrong property class, incorrect square footage or unit count, missing depreciation for age, improper assessment notice, or assessment outside the statutory window. Each error is independently sufficient to void or reduce the assessment. Catalog every discrepancy before building the market-value case.',

  // ── Pre-Purchase ───────────────────────────────────────────────────────────
  negotiate_purchase:
    'Lead with the gap between the list price and the independent market value. Build a precise, dollar-justified negotiation memo the buyer can hand directly to the seller\'s agent. Every data point in the analysis should translate into a specific, defensible purchase-price adjustment. Do not hedge — state the number and justify it.',
  investment_analysis:
    'Lead with income metrics: projected NOI, market cap rate, gross rent multiplier, cash-on-cash return, and IRR at both list price and a negotiated price. The buyer is an investor — they need a complete underwriting package, not just a value opinion. Every conclusion should answer: "Does this deal pencil at list? At what price does it achieve the target return?"',
  due_diligence:
    'Lead with risk. Surface every issue that could cost the buyer money after closing: deferred maintenance cost estimates, red flags in sale history (rapid turnover, distressed sales), flood and environmental exposure, functional layout deficiencies, HOA exposure, and title anomalies from deed history. Quantify the dollar exposure for each risk. The buyer needs to know what they are inheriting.',
  tax_planning:
    'Lead with the projected post-purchase tax burden. Identify the county\'s reassessment-on-sale policy and calculate the likely new assessed value and annual tax bill after the transaction closes. Flag counties that reassess aggressively on sale — this can add thousands per year to carrying costs that the list price does not reflect.',

  // ── Pre-Listing ────────────────────────────────────────────────────────────
  maximize_sale_price:
    'Lead with the ceiling price the market will support. Use the comp analysis to identify the highest defensible list price — not the median, the top. Identify features that command premiums in this market and quantify their contribution to value. The seller is optimizing for maximum net proceeds, not fastest sale.',
  price_to_sell_fast:
    'Lead with the absorption-rate sweet spot: the price point that drives multiple offers without leaving money on the table. Use days-on-market trends, current active inventory, and list-to-sale price ratios to identify the optimal price band. The goal is maximum velocity at a price the market will immediately validate.',
  value_add_roadmap:
    'Lead with a ranked list of value-add improvements by net ROI. For each recommendation, show: estimated cost, expected value increase, and net return. Exclude anything where ROI does not exceed cost. Identify specific items buyers will negotiate away at closing and recommend curing them pre-listing to remove the discount.',
  buyer_profile_targeting:
    'Lead with the likely buyer profile for this property type, location, and price band. Who is this buyer, what do they prioritize, and how does this property satisfy their criteria? Tailor staging priorities, marketing channels, and listing language to appeal to that specific buyer. Every recommendation should be calibrated to the identified buyer, not a generic audience.',
};

// ─── Primary Approach by Service × Subtype ────────────────────────────────────
// When the income approach weight exceeds the sales comparison weight for a
// subtype, income leads the reconciliation. Otherwise, service type determines
// the lead approach. This ensures commercial/industrial reports are income-led
// even for non-tax-appeal services.

function resolvePrimaryApproach(
  weights: ApproachWeights
): 'sales_comparison' | 'income' | 'cost' {
  if (weights.income > weights.sales_comparison) return 'income';
  return 'sales_comparison';
}

// ─── Resolved Strategy ────────────────────────────────────────────────────────

export interface ResolvedStrategy {
  serviceType: ServiceType;
  propertySubtype: string;
  desiredOutcome: DesiredOutcome;
  /** Ordered list of narrative section_name values to generate for this report */
  sections: string[];
  /** Valuation approach weights for reconciliation blending */
  approachWeights: ApproachWeights;
  /** Whether Stage 3 income approach should run for this subtype */
  incomeEligible: boolean;
  /** Stage 6 guide type (determines deliverable format) */
  guideType: string;
  /** Directive injected into the AI system prompt to control tone and framing */
  outcomeEmphasis: string;
  /** Which valuation approach leads the reconciliation narrative */
  primaryApproach: 'sales_comparison' | 'income' | 'cost';
}

/**
 * Resolve a complete report generation strategy from the three client-supplied
 * inputs: service type, property subtype, and desired outcome.
 *
 * Called once per report at the start of Stage 5. The returned strategy drives
 * every downstream call: Anthropic prompt construction, approach weight blending
 * for the concluded value, section selection, and Stage 6 guide type.
 */
export function resolveStrategy(
  serviceType: ServiceType,
  propertySubtype: string,
  desiredOutcome: DesiredOutcome
): ResolvedStrategy {
  const approachWeights = getApproachWeights(propertySubtype);
  const incomeEligible = INCOME_APPROACH_ELIGIBLE_SUBTYPES.has(propertySubtype);
  const primaryApproach = resolvePrimaryApproach(approachWeights);

  return {
    serviceType,
    propertySubtype,
    desiredOutcome,
    sections: NARRATIVE_SECTIONS[serviceType],
    approachWeights,
    incomeEligible,
    guideType: STAGE_6_GUIDE_TYPE[serviceType],
    outcomeEmphasis: OUTCOME_EMPHASIS[desiredOutcome],
    primaryApproach,
  };
}
