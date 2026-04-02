// ─── Valuation Configuration ─────────────────────────────────────────────────
// Single source of truth for all valuation parameters: IAAO economic life
// schedules, property subtype mapping, income approach assumptions, adjustment
// rates, and case strength weights.
//
// This file must never import from pipeline stages. It is a pure config module.

// ─── Economic Life (IAAO / Marshall & Swift standard ranges) ─────────────────
// Total useful life of the improvement in years. Used to compute physical
// depreciation and remaining economic life.

export const ECONOMIC_LIFE: Record<string, number> = {
  // Residential
  residential_sfr:          60,  // Single-family residence
  residential_condo:        50,  // Condominium / townhouse
  residential_multifamily:  55,  // 2–4 unit multi-family
  // Commercial
  commercial_retail_strip:  40,  // Retail strip / neighborhood center
  commercial_office:        45,  // Office building
  commercial_restaurant:    35,  // Restaurant / fast food (high obsolescence rate)
  commercial_hotel:         40,  // Hotel / motel
  commercial_mixed_use:     45,
  commercial_general:       40,  // Default for unclassified commercial
  // Industrial
  industrial_warehouse:     45,  // Warehouse / distribution center
  industrial_manufacturing: 40,  // Manufacturing / heavy industrial
  industrial_flex:          40,  // Flex / R&D space
  industrial_self_storage:  50,  // Self-storage (minimal mechanical systems)
  industrial_general:       40,  // Default for unclassified industrial
  // Land never depreciates
  land:                      0,
};

// ─── Property Subtype Map ─────────────────────────────────────────────────────
// Maps ATTOM propertyClass / propertyType codes to internal subtype keys.
// Keys are normalised to uppercase before lookup.

export const PROPERTY_SUBTYPE_MAP: Record<string, string> = {
  // Residential
  'R1': 'residential_sfr',
  'R2': 'residential_condo',
  'R3': 'residential_multifamily',
  'SFR': 'residential_sfr',
  'SINGLE FAMILY': 'residential_sfr',
  'RESIDENTIAL': 'residential_sfr',
  'SINGLE FAMILY RESIDENCE': 'residential_sfr',
  'CONDO': 'residential_condo',
  'CONDOMINIUM': 'residential_condo',
  'TOWNHOUSE': 'residential_condo',
  'TOWNHOME': 'residential_condo',
  'MULTI': 'residential_multifamily',
  'MULTI FAMILY': 'residential_multifamily',
  'MULTIFAMILY': 'residential_multifamily',
  'DUPLEX': 'residential_multifamily',
  'TRIPLEX': 'residential_multifamily',
  'FOURPLEX': 'residential_multifamily',
  // Commercial
  'C1': 'commercial_general',
  'RET': 'commercial_retail_strip',
  'RETAIL': 'commercial_retail_strip',
  'RETAIL STRIP': 'commercial_retail_strip',
  'OFF': 'commercial_office',
  'OFFICE': 'commercial_office',
  'REST': 'commercial_restaurant',
  'RESTAURANT': 'commercial_restaurant',
  'HOT': 'commercial_hotel',
  'HOTEL': 'commercial_hotel',
  'MOTEL': 'commercial_hotel',
  'MU': 'commercial_mixed_use',
  'MIXED USE': 'commercial_mixed_use',
  'COMMERCIAL': 'commercial_general',
  // Industrial
  'I1': 'industrial_general',
  'I2': 'industrial_general',
  'WARE': 'industrial_warehouse',
  'WAREHOUSE': 'industrial_warehouse',
  'DISTRIBUTION': 'industrial_warehouse',
  'MFG': 'industrial_manufacturing',
  'MANUFACTURING': 'industrial_manufacturing',
  'INDUSTRIAL': 'industrial_general',
  'FLEX': 'industrial_flex',
  'SS': 'industrial_self_storage',
  'STORAGE': 'industrial_self_storage',
  'SELF STORAGE': 'industrial_self_storage',
  'SELF-STORAGE': 'industrial_self_storage',
  // Land
  'LAND': 'land',
  'VAC': 'land',
  'VACANT': 'land',
  'VACANT LAND': 'land',
};

// ─── Condition → Effective Age Multiplier ─────────────────────────────────────
// After photo analysis establishes the overall condition, multiply actual
// chronological age by this factor to derive effective age.
// A property in excellent condition "acts younger" than its birth year implies.

export const CONDITION_AGE_MULTIPLIER: Record<string, number> = {
  excellent: 0.50, // looks half its age — major renovations, immaculate upkeep
  good:      0.75, // well-maintained, above average
  average:   1.00, // effective age equals chronological age (baseline)
  fair:      1.35, // deferred maintenance, aging systems
  poor:      1.70, // significant deterioration, well beyond expected condition for age
};

// ─── Condition Adjustment Rate ─────────────────────────────────────────────────
// Percentage adjustment per year of effective age difference between subject
// and comparable. Reflects market pricing of condition/age differentials.
// Applied in Stage 2 sales comparison adjustment grid.
// Capped at ±EFFECTIVE_AGE_ADJ_MAX_PCT to prevent runaway adjustments.

export const EFFECTIVE_AGE_ADJ_RATE_PER_YEAR = 0.35; // 0.35% per year of effective age diff
export const EFFECTIVE_AGE_ADJ_MAX_PCT        = 15;   // cap at ±15%

// ─── Location Adjustment by Distance ─────────────────────────────────────────
// When a comparable is further from the subject, location differences
// become more likely and meaningful. This table establishes a modest,
// defensible location adjustment for comps beyond the 0.5-mile core.
// adjPctPerPctDiff: multiplied by a normalised distance risk score.

export const LOCATION_ADJ_BY_DISTANCE: Array<{ maxMiles: number; adjFactor: number }> = [
  { maxMiles: 0.5, adjFactor: 0.0  }, // same immediate neighbourhood — no adj
  { maxMiles: 1.0, adjFactor: 0.08 }, // nearby — minimal location risk
  { maxMiles: 2.0, adjFactor: 0.20 }, // neighbourhood boundary possible
  { maxMiles: 5.0, adjFactor: 0.35 }, // cross-neighbourhood, different market tier likely
  { maxMiles: 999, adjFactor: 0.50 }, // different market area — material location diff
];

// Maximum location adjustment this system will apply (conservative; AI narrative
// provides the qualitative analysis behind larger differentials).
export const LOCATION_ADJ_MAX_PCT = 4; // ±4%

// ─── Income Approach Parameters by Subtype ────────────────────────────────────
// Vacancy rates, expense ratios, default cap rates, and fallback rent estimates
// for each commercial/industrial subtype. All rates sourced from CBRE/JLL/CoStar
// national market reports and IAAO income approach guidance.

export interface IncomeParams {
  vacancy_rate: number;          // Market vacancy assumption (decimal)
  expense_ratio: number;         // Operating expenses as % of EGI (decimal)
  cap_rate_default: number;      // Fallback cap rate when comps can't derive one
  rent_fallback_per_sqft_yr: number; // Used when no rental comps found
}

export const INCOME_PARAMS: Record<string, IncomeParams> = {
  commercial_retail_strip:  { vacancy_rate: 0.08, expense_ratio: 0.28, cap_rate_default: 0.065, rent_fallback_per_sqft_yr: 18 },
  commercial_office:        { vacancy_rate: 0.12, expense_ratio: 0.38, cap_rate_default: 0.075, rent_fallback_per_sqft_yr: 22 },
  commercial_restaurant:    { vacancy_rate: 0.06, expense_ratio: 0.30, cap_rate_default: 0.060, rent_fallback_per_sqft_yr: 25 },
  commercial_hotel:         { vacancy_rate: 0.25, expense_ratio: 0.60, cap_rate_default: 0.085, rent_fallback_per_sqft_yr: 0  },
  commercial_mixed_use:     { vacancy_rate: 0.08, expense_ratio: 0.32, cap_rate_default: 0.070, rent_fallback_per_sqft_yr: 18 },
  commercial_general:       { vacancy_rate: 0.08, expense_ratio: 0.32, cap_rate_default: 0.070, rent_fallback_per_sqft_yr: 14 },
  industrial_warehouse:     { vacancy_rate: 0.04, expense_ratio: 0.22, cap_rate_default: 0.065, rent_fallback_per_sqft_yr: 7  },
  industrial_manufacturing: { vacancy_rate: 0.05, expense_ratio: 0.25, cap_rate_default: 0.075, rent_fallback_per_sqft_yr: 6  },
  industrial_flex:          { vacancy_rate: 0.06, expense_ratio: 0.24, cap_rate_default: 0.070, rent_fallback_per_sqft_yr: 9  },
  industrial_self_storage:  { vacancy_rate: 0.10, expense_ratio: 0.35, cap_rate_default: 0.060, rent_fallback_per_sqft_yr: 12 },
  industrial_general:       { vacancy_rate: 0.05, expense_ratio: 0.24, cap_rate_default: 0.075, rent_fallback_per_sqft_yr: 6  },
};

// ─── Case Strength Scoring ─────────────────────────────────────────────────────
// Used in Stage 5 to compute a 0-100 case strength score that drives:
//   - Admin review priority
//   - User-facing confidence indicators
//   - Filing strategy recommendations (pro se vs our full-service filing)

export const CASE_STRENGTH = {
  // Points for overassessment magnitude (0–40 pts)
  // Each percentage point of overassessment = 2 pts, capped at 40 (i.e. 20%+ = max)
  overassessment_pts_per_pct: 2,
  overassessment_max_pts: 40,

  // Points for comparable support (0–20 pts)
  // 4 pts per comp, up to 5 comps (20 pts max)
  comp_pts_each: 4,
  comp_max_pts: 20,

  // Points for photo evidence (0–25 pts)
  // 5 pts per significant defect (up to 3), 1 pt each minor/moderate (up to 10)
  sig_defect_pts_each: 5,
  sig_defect_max_pts: 15,
  defect_pts_each: 1,
  defect_max_pts: 10,

} as const;

// ─── Replacement Cost New (RCN) Per Square Foot ───────────────────────────────
// Marshall & Swift-derived construction cost estimates per gross building sqft
// by property subtype and quality grade. Values in current (2025–2026) dollars.
// When quality_grade is unknown, default to 'average'.
//
// Quality grades (ascending cost): economy → average → good → excellent → luxury
// Luxury only applies to residential — commercial/industrial cap at excellent.

export type QualityGrade = 'economy' | 'average' | 'good' | 'excellent' | 'luxury';

export const REPLACEMENT_COST_PER_SQFT: Record<string, Record<QualityGrade, number>> = {
  // Residential
  residential_sfr:          { economy: 95,  average: 130, good: 175, excellent: 230, luxury: 350 },
  residential_condo:        { economy: 100, average: 140, good: 185, excellent: 245, luxury: 380 },
  residential_multifamily:  { economy: 90,  average: 120, good: 155, excellent: 200, luxury: 200 },
  // Commercial
  commercial_retail_strip:  { economy: 75,  average: 105, good: 140, excellent: 185, luxury: 185 },
  commercial_office:        { economy: 100, average: 145, good: 195, excellent: 260, luxury: 260 },
  commercial_restaurant:    { economy: 110, average: 160, good: 215, excellent: 280, luxury: 280 },
  commercial_hotel:         { economy: 90,  average: 135, good: 185, excellent: 250, luxury: 250 },
  commercial_mixed_use:     { economy: 90,  average: 130, good: 175, excellent: 230, luxury: 230 },
  commercial_general:       { economy: 80,  average: 110, good: 150, excellent: 200, luxury: 200 },
  // Industrial
  industrial_warehouse:     { economy: 45,  average: 65,  good: 90,  excellent: 120, luxury: 120 },
  industrial_manufacturing: { economy: 55,  average: 80,  good: 110, excellent: 150, luxury: 150 },
  industrial_flex:          { economy: 65,  average: 95,  good: 130, excellent: 170, luxury: 170 },
  industrial_self_storage:  { economy: 35,  average: 50,  good: 70,  excellent: 95,  luxury: 95  },
  industrial_general:       { economy: 50,  average: 72,  good: 100, excellent: 135, luxury: 135 },
};

// ─── Conditions of Sale Adjustment ────────────────────────────────────────────
// Positive upward adjustment applied to distressed sales (REO, foreclosure,
// short sale, sheriff sale) to bring them to arms-length equivalent.
// IAAO standard range is +10% to +20%; we use +12% — conservative and defensible.
// This makes distressed comps properly comparable to arms-length subject property.

export const DISTRESSED_SALE_ADJ_PCT = 12;

// ─── Market Trends Adjustment ───────────────────────────────────────────────
// Applied to comps older than 6 months. Conservative monthly appreciation rate.

export const MARKET_TRENDS_ADJ_PER_MONTH = 0.3;   // % per month appreciation
export const MARKET_TRENDS_ADJ_MAX_PCT   = 10;    // maximum time adjustment cap

// ─── Size Adjustment ────────────────────────────────────────────────────────
// Per 10% size differential. Asymmetric: smaller comps get larger upward adj
// because smaller properties typically sell at higher $/SF.

export const SIZE_ADJ_LARGER_PER_10PCT  = -3;     // subject larger than comp
export const SIZE_ADJ_SMALLER_PER_10PCT = 5;      // subject smaller than comp
export const SIZE_ADJ_MAX_PCT           = 15;     // maximum size adjustment cap

// ─── Land-to-Building Ratio ─────────────────────────────────────────────────

export const LAND_RATIO_THRESHOLD_PCT = 20;       // % difference to trigger adjustment

// ─── Photo Condition Adjustments ────────────────────────────────────────────
// Defect impact by severity × value_impact level. Used in stage4 and stage5.

export const CONDITION_DEFECT_ADJUSTMENTS: Record<string, Record<string, number>> = {
  minor:       { low: -0.5, medium: -1.0, high: -1.5 },
  moderate:    { low: -1.0, medium: -2.0, high: -3.0 },
  significant: { low: -2.0, medium: -3.5, high: -5.0 },
};

export const CONDITION_BASE_OFFSET: Record<string, number> = {
  poor: -4, fair: -2, average: 0, good: 0, excellent: 0,
};

export const CONDITION_ADJ_MAX_PCT           = 30;  // maximum total condition adjustment
export const CONDITION_COMPLETENESS_MULTIPLIER = 1.10; // 10% uplift for complete photo set

// ─── Functional Obsolescence Thresholds ──────────────────────────────────────
// Over-improvement (super-adequacy): subject is materially larger than the
// neighborhood median comparable sale, indicating the market will not pay
// replacement cost for the excess improvement (incurable functional obsolescence).
// Threshold: subject must be >30% larger than median comp sqft to trigger.
// Adjustment: 5% per 30% excess, capped at 15%.

export const OVER_IMPROVEMENT_THRESHOLD_PCT = 30;  // % larger than median comp to trigger
export const OVER_IMPROVEMENT_ADJ_PCT        = 5;   // obsolescence % per 30% excess
export const OVER_IMPROVEMENT_ADJ_MAX_PCT    = 15;  // maximum functional obsolescence cap

// ─── Subtype Resolver ─────────────────────────────────────────────────────────
// Resolves an ATTOM propertyClass string + report property_type to an internal
// subtype key. Safe to call from any stage.

export function resolvePropertySubtype(
  attomClass: string | null | undefined,
  propertyType: string
): string {
  if (attomClass) {
    const normalized = attomClass.toUpperCase().trim();
    const mapped = PROPERTY_SUBTYPE_MAP[normalized];
    if (mapped) return mapped;
  }
  // Fallback: derive from the broad property type
  switch (propertyType) {
    case 'residential': return 'residential_sfr';
    case 'commercial':  return 'commercial_general';
    case 'industrial':  return 'industrial_general';
    case 'land':        return 'land';
    default:            return 'residential_sfr';
  }
}

// ─── Depreciation Helpers ─────────────────────────────────────────────────────

/**
 * Compute physical depreciation percentage (0–90) for a building.
 * Caps at 90% — land always retains value, and even severely deteriorated
 * improvements retain some contributory value.
 */
export function computePhysicalDepreciation(effectiveAge: number, subtype: string): number {
  const life = ECONOMIC_LIFE[subtype] ?? 45;
  if (life <= 0) return 0;
  return Math.min(Math.round((effectiveAge / life) * 1000) / 10, 90);
}

/**
 * Compute effective age from chronological age and photo-observed condition.
 * Called in Stage 1 (baseline, condition='average') and Stage 4 (refined).
 */
export function computeEffectiveAge(
  yearBuilt: number | null | undefined,
  condition: string = 'average'
): number {
  if (!yearBuilt) return 0;
  const actualAge = new Date().getFullYear() - yearBuilt;
  const multiplier = CONDITION_AGE_MULTIPLIER[condition] ?? 1.0;
  return Math.max(Math.round(actualAge * multiplier), 0);
}
