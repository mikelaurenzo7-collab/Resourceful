// ─── Service & Strategy Configuration ────────────────────────────────────────
// Single source of truth for service type definitions, desired outcomes,
// approach weights by property type, and strategy selection logic.
//
// The pipeline uses these constants to tailor every report to the client's
// specific combination of: service type × property type × desired outcome × county.
//
// This file must never import from pipeline stages. Pure config only.

// ─── Service Types ────────────────────────────────────────────────────────────

export const SERVICE_TYPES = {
  TAX_APPEAL:   'tax_appeal',
  PRE_PURCHASE: 'pre_purchase',
  PRE_LISTING:  'pre_listing',
} as const;

export type ServiceType = typeof SERVICE_TYPES[keyof typeof SERVICE_TYPES];

// ─── Property Types ───────────────────────────────────────────────────────────

export const PROPERTY_TYPES = {
  RESIDENTIAL: 'residential',
  COMMERCIAL:  'commercial',
  INDUSTRIAL:  'industrial',
  LAND:        'land',
} as const;

export type PropertyType = typeof PROPERTY_TYPES[keyof typeof PROPERTY_TYPES];

// ─── Desired Outcomes ─────────────────────────────────────────────────────────
// Captured at intake to focus narrative emphasis and strategy selection.

export const DESIRED_OUTCOMES = {
  // Tax Appeal outcomes
  REDUCE_TAXES:             'reduce_taxes',
  APPEAL_UNIFORMITY:        'appeal_uniformity',      // equity / equal treatment argument
  APPEAL_PROCEDURAL:        'appeal_procedural',      // wrong class/sqft/assessment notice
  // Pre-Purchase outcomes
  NEGOTIATE_PURCHASE:       'negotiate_purchase',     // drive down offer price
  INVESTMENT_ANALYSIS:      'investment_analysis',    // ROI, cap rate, cash-on-cash
  DUE_DILIGENCE:            'due_diligence',          // risk profile, red flags
  TAX_PLANNING:             'tax_planning',           // project post-purchase tax burden
  // Pre-Listing outcomes
  MAXIMIZE_SALE_PRICE:      'maximize_sale_price',    // find the market ceiling
  PRICE_TO_SELL_FAST:       'price_to_sell_fast',     // absorption-rate sweet spot
  VALUE_ADD_ROADMAP:        'value_add_roadmap',      // ROI-ranked improvements before listing
  BUYER_PROFILE_TARGETING:  'buyer_profile_targeting',// tailor strategy to likely buyer
} as const;

export type DesiredOutcome = typeof DESIRED_OUTCOMES[keyof typeof DESIRED_OUTCOMES];

// ─── Outcome → Service Type Mapping ──────────────────────────────────────────
// Which outcomes are valid for which service type.

export const OUTCOMES_BY_SERVICE: Record<ServiceType, DesiredOutcome[]> = {
  tax_appeal:   ['reduce_taxes', 'appeal_uniformity', 'appeal_procedural'],
  pre_purchase: ['negotiate_purchase', 'investment_analysis', 'due_diligence', 'tax_planning'],
  pre_listing:  ['maximize_sale_price', 'price_to_sell_fast', 'value_add_roadmap', 'buyer_profile_targeting'],
};

// ─── Appraisal Approach Weights by Property Subtype ───────────────────────────
// Determines which valuation approaches are run and their weight in reconciliation.
// Weights must sum to 1.0. Use 0 to skip an approach entirely.
//
// Approaches:
//   sales_comparison: Adjusted comparable sales grid (always primary for most types)
//   income:           NOI/cap rate capitalization (commercial, industrial, multifamily)
//   cost:             Replacement cost new minus depreciation (all improved properties)

export interface ApproachWeights {
  sales_comparison: number;
  income:           number;
  cost:             number;
}

export const APPROACH_WEIGHTS: Record<string, ApproachWeights> = {
  // Residential — sales comparison primary; cost as check
  residential_sfr:          { sales_comparison: 0.80, income: 0.00, cost: 0.20 },
  residential_condo:        { sales_comparison: 0.85, income: 0.00, cost: 0.15 },
  residential_multifamily:  { sales_comparison: 0.50, income: 0.35, cost: 0.15 },
  residential_manufactured: { sales_comparison: 0.75, income: 0.00, cost: 0.25 },
  residential_coop:         { sales_comparison: 0.80, income: 0.10, cost: 0.10 },
  // Commercial — income primary; sales secondary; cost as upper bound
  commercial_retail_strip:  { sales_comparison: 0.30, income: 0.55, cost: 0.15 },
  commercial_office:        { sales_comparison: 0.30, income: 0.55, cost: 0.15 },
  commercial_restaurant:    { sales_comparison: 0.45, income: 0.40, cost: 0.15 },
  commercial_hotel:         { sales_comparison: 0.20, income: 0.65, cost: 0.15 },
  commercial_mixed_use:     { sales_comparison: 0.40, income: 0.45, cost: 0.15 },
  commercial_apartment:     { sales_comparison: 0.25, income: 0.65, cost: 0.10 },
  commercial_medical:       { sales_comparison: 0.25, income: 0.55, cost: 0.20 },
  commercial_self_storage:  { sales_comparison: 0.20, income: 0.65, cost: 0.15 },
  commercial_general:       { sales_comparison: 0.35, income: 0.50, cost: 0.15 },
  // Industrial — income and sales equal; cost as check
  industrial_warehouse:     { sales_comparison: 0.40, income: 0.45, cost: 0.15 },
  industrial_manufacturing: { sales_comparison: 0.35, income: 0.45, cost: 0.20 },
  industrial_flex:          { sales_comparison: 0.40, income: 0.45, cost: 0.15 },
  industrial_cold_storage:  { sales_comparison: 0.30, income: 0.50, cost: 0.20 },
  industrial_general:       { sales_comparison: 0.40, income: 0.45, cost: 0.15 },
  // Land — sales comparison only; no income or cost for bare land
  land_general:             { sales_comparison: 1.00, income: 0.00, cost: 0.00 },
  land_residential:         { sales_comparison: 1.00, income: 0.00, cost: 0.00 },
  land_commercial:          { sales_comparison: 0.70, income: 0.30, cost: 0.00 },
  land_agricultural:        { sales_comparison: 0.60, income: 0.40, cost: 0.00 },
  land_timberland:          { sales_comparison: 0.60, income: 0.40, cost: 0.00 },
  // Special purpose — income primary; cost as support
  special_senior_living:    { sales_comparison: 0.20, income: 0.60, cost: 0.20 },
  special_car_wash:         { sales_comparison: 0.25, income: 0.60, cost: 0.15 },
  special_parking:          { sales_comparison: 0.30, income: 0.55, cost: 0.15 },
  special_institutional:    { sales_comparison: 0.50, income: 0.00, cost: 0.50 },
};

// ─── Income Approach Eligibility ─────────────────────────────────────────────
// The income approach is only run for these subtypes.
// SFR and bare land are EXCLUDED — running income approach on them produces
// unreliable results and creates misleading conclusions.

export const INCOME_APPROACH_ELIGIBLE_SUBTYPES = new Set([
  'residential_multifamily',
  'residential_coop',
  'commercial_retail_strip',
  'commercial_office',
  'commercial_restaurant',
  'commercial_hotel',
  'commercial_mixed_use',
  'commercial_apartment',
  'commercial_medical',
  'commercial_self_storage',
  'commercial_general',
  'industrial_warehouse',
  'industrial_manufacturing',
  'industrial_flex',
  'industrial_cold_storage',
  'industrial_general',
  'land_commercial',
  'land_agricultural',
  'land_timberland',
  'special_senior_living',
  'special_car_wash',
  'special_parking',
]);

// ─── Stage 6 Action Guide Type by Service ─────────────────────────────────────
// Stage 6 always runs, but produces a different deliverable per service type.

export const STAGE_6_GUIDE_TYPE: Record<ServiceType, string> = {
  tax_appeal:   'appeal_filing_guide',    // county-specific appeal instructions
  pre_purchase: 'buyer_action_guide',     // negotiation memo + due diligence checklist
  pre_listing:  'listing_strategy_guide', // pricing range + value-add priority list
};

// ─── Narrative Sections by Service Type ───────────────────────────────────────
// Stage 5 generates these sections for each service type.
// Sections listed in order they appear in the PDF.

export const NARRATIVE_SECTIONS: Record<ServiceType, string[]> = {
  tax_appeal: [
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
    'income_approach_narrative',   // skipped for SFR/land by income eligibility check
    'cost_approach_narrative',
    'reconciliation_narrative',
    'appeal_argument_summary',
  ],
  pre_purchase: [
    'executive_summary',
    'property_description',
    'site_description_narrative',
    'improvement_description_narrative',
    'condition_assessment',
    'area_analysis_neighborhood',
    'market_analysis',
    'hbu_as_improved',
    'sales_comparison_narrative',
    'adjustment_grid_narrative',
    'income_approach_narrative',   // only if income-eligible subtype
    'cost_approach_narrative',
    'reconciliation_narrative',
    'risk_flags_summary',
    'tax_projection_narrative',
    'negotiation_memo',
  ],
  pre_listing: [
    'executive_summary',
    'property_description',
    'site_description_narrative',
    'improvement_description_narrative',
    'condition_assessment',
    'area_analysis_neighborhood',
    'market_analysis',
    'hbu_as_improved',
    'sales_comparison_narrative',
    'adjustment_grid_narrative',
    'income_approach_narrative',   // only if income-eligible subtype
    'cost_approach_narrative',
    'reconciliation_narrative',
    'value_add_recommendations',
    'buyer_profile_brief',
    'listing_strategy_summary',
  ],
};

// ─── Strategy Helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if the income approach should be run for this property subtype.
 */
export function isIncomeApproachEligible(subtype: string): boolean {
  return INCOME_APPROACH_ELIGIBLE_SUBTYPES.has(subtype);
}

/**
 * Returns the approach weights for a given subtype, defaulting to a safe
 * sales-comparison-heavy fallback for unknown subtypes.
 */
export function getApproachWeights(subtype: string): ApproachWeights {
  return APPROACH_WEIGHTS[subtype] ?? { sales_comparison: 0.70, income: 0.15, cost: 0.15 };
}

/**
 * Returns the valid desired outcomes for a service type.
 */
export function getOutcomesForService(serviceType: ServiceType): DesiredOutcome[] {
  return OUTCOMES_BY_SERVICE[serviceType] ?? [];
}

/**
 * Returns the Stage 6 guide type for a service type.
 */
export function getActionGuideType(serviceType: ServiceType): string {
  return STAGE_6_GUIDE_TYPE[serviceType];
}
