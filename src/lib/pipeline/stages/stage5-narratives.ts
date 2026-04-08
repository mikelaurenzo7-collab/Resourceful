// ─── Stage 5: Report Narrative Generation ────────────────────────────────────
// Assembles complete structured data payload from DB, calls Anthropic to
// generate all report narrative sections in a single call, and stores each
// section in report_narratives with model/token/duration metadata.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData, ComparableSale, ComparableRental, IncomeAnalysis, Photo, CountyRule, PhotoAiAnalysis } from '@/types/database';
import type { StageResult } from '../orchestrator';
import {
  generateNarratives,
  type NarrativePayload,
} from '@/lib/services/anthropic';
import { AI_MODELS } from '@/config/ai';
import {
  ECONOMIC_LIFE,
  CASE_STRENGTH,
  REPLACEMENT_COST_PER_SQFT,
  OVER_IMPROVEMENT_THRESHOLD_PCT,
  CONDITION_DEFECT_ADJUSTMENTS,
  CONDITION_BASE_OFFSET,
  OVER_IMPROVEMENT_ADJ_PCT,
  OVER_IMPROVEMENT_ADJ_MAX_PCT,
  type QualityGrade,
} from '@/config/valuation';
import { getCalibrationParams } from '@/lib/repository/calibration';
// Attorney referral system removed — all filing handled in-house or guided pro se.

// ─── Section Mapping ────────────────────────────────────────────────────────

const _SECTION_SORT_ORDER: Record<string, { title: string; order: number }> = {
  executive_summary: { title: 'Executive Summary', order: 1 },
  property_description: { title: 'Property Description', order: 2 },
  site_description_narrative: { title: 'Site Description', order: 3 },
  improvement_description_narrative: { title: 'Improvement Description', order: 4 },
  condition_assessment: { title: 'Property Condition Evidence', order: 5 },
  area_analysis_county: { title: 'County Area Analysis', order: 6 },
  area_analysis_city: { title: 'City Area Analysis', order: 7 },
  area_analysis_neighborhood: { title: 'Neighborhood Analysis', order: 8 },
  market_analysis: { title: 'Market Analysis', order: 9 },
  hbu_as_vacant: { title: 'Highest & Best Use — As Vacant', order: 10 },
  hbu_as_improved: { title: 'Highest & Best Use — As Improved', order: 11 },
  sales_comparison_narrative: { title: 'Sales Comparison Approach', order: 12 },
  adjustment_grid_narrative: { title: 'Adjustment Grid Analysis', order: 13 },
  income_approach_narrative: { title: 'Income Approach', order: 14 },
  cost_approach_narrative: { title: 'Cost Approach', order: 15 },
  reconciliation_narrative: { title: 'Reconciliation & Final Value', order: 16 },
  appeal_argument_summary: { title: 'Appeal Argument Summary', order: 17 },
  // legacy aliases
  neighborhood_analysis: { title: 'Neighborhood Analysis', order: 8 },
  value_conclusion: { title: 'Reconciliation & Final Value', order: 15 },
  assessment_equity: { title: 'Assessment Equity Analysis', order: 16 },
};

// ─── Cost Approach Helpers ───────────────────────────────────────────────────

interface CostApproachResult {
  rcn: number | null;
  costApproachValue: number | null;
}

function computeCostApproach(
  subtype: string | null,
  qualityGrade: string | null,
  buildingSqft: number | null,
  physicalDepreciationPct: number | null,
  functionalObsolescencePct: number,
  landValue: number | null
): CostApproachResult {
  if (!subtype || !buildingSqft || buildingSqft <= 0) return { rcn: null, costApproachValue: null };
  const costTable = REPLACEMENT_COST_PER_SQFT[subtype];
  if (!costTable) return { rcn: null, costApproachValue: null };

  const grade = (qualityGrade as QualityGrade | null) ?? 'average';
  const costPerSqft = costTable[grade] ?? costTable.average;
  const rcn = Math.round(costPerSqft * buildingSqft);

  // Require a credible land value to produce a valid cost approach.
  // Without land, the indicated value would be a depreciated improvement value only —
  // not a full USPAP cost approach and potentially misleading as overassessment evidence.
  if (!landValue || landValue <= 0) {
    return { rcn, costApproachValue: null };
  }

  // Total obsolescence = physical + functional, capped at 90%
  const totalObsolescence = Math.min((physicalDepreciationPct ?? 0) + functionalObsolescencePct, 90);
  const depreciatedBuildingValue = Math.round(rcn * (1 - totalObsolescence / 100));

  // Land never depreciates — add at cost (assessor's land value is the best estimate)
  const costApproachValue = Math.round((depreciatedBuildingValue + landValue) / 1000) * 1000;

  return { rcn, costApproachValue };
}

// ─── Functional Obsolescence Helper ─────────────────────────────────────────

interface FunctionalObsolescenceResult {
  obsolescencePct: number;
  notes: string | null;
}

function computeFunctionalObsolescence(
  subjectSqft: number | null,
  comps: ComparableSale[]
): FunctionalObsolescenceResult {
  if (!subjectSqft || subjectSqft <= 0 || comps.length < 3) {
    return { obsolescencePct: 0, notes: null };
  }

  const compSqfts = comps
    .map((c) => c.building_sqft)
    .filter((s): s is number => s != null && s > 0)
    .sort((a, b) => a - b);

  if (compSqfts.length < 3) return { obsolescencePct: 0, notes: null };

  const medianCompSqft = compSqfts[Math.floor(compSqfts.length / 2)];
  const overImprovementPct = ((subjectSqft - medianCompSqft) / medianCompSqft) * 100;

  if (overImprovementPct <= OVER_IMPROVEMENT_THRESHOLD_PCT) {
    return { obsolescencePct: 0, notes: null };
  }

  // Each 30% increment of over-improvement = OVER_IMPROVEMENT_ADJ_PCT obsolescence
  const excessBuckets = Math.floor(overImprovementPct / OVER_IMPROVEMENT_THRESHOLD_PCT);
  const obsolescencePct = Math.min(
    excessBuckets * OVER_IMPROVEMENT_ADJ_PCT,
    OVER_IMPROVEMENT_ADJ_MAX_PCT
  );

  const notes =
    `Subject is ${overImprovementPct.toFixed(0)}% larger than the neighborhood median ` +
    `(${subjectSqft.toLocaleString()} sqft vs ${medianCompSqft.toLocaleString()} sqft median). ` +
    `This super-adequacy is incurable functional obsolescence — the market will not pay ` +
    `replacement cost for improvement in excess of what the neighborhood supports. ` +
    `Applied ${obsolescencePct}% functional obsolescence deduction to the cost approach.`;

  return { obsolescencePct, notes };
}

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runNarratives(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch all required data in parallel ───────────────────────────────
  const [reportRes, propertyRes, compsRes, rentalsRes, incomeRes, photosRes] =
    await Promise.all([
      supabase.from('reports').select('*').eq('id', reportId).single(),
      supabase.from('property_data').select('*').eq('report_id', reportId).single(),
      supabase.from('comparable_sales').select('*').eq('report_id', reportId),
      supabase.from('comparable_rentals').select('*').eq('report_id', reportId),
      supabase.from('income_analysis').select('*').eq('report_id', reportId).single(),
      supabase.from('photos').select('*').eq('report_id', reportId),
    ]);

  const report = reportRes.data as Report | null;
  const propertyData = propertyRes.data as PropertyData | null;
  const incomeData = incomeRes.data as IncomeAnalysis | null;

  if (!report) {
    return { success: false, error: `Failed to fetch report: ${reportRes.error?.message}` };
  }
  if (!propertyData) {
    return { success: false, error: `No property_data found: ${propertyRes.error?.message}` };
  }

  // ── Fetch county rules ────────────────────────────────────────────────
  let countyRule: CountyRule | null = null;
  if (report.county_fips) {
    const { data } = await supabase
      .from('county_rules')
      .select('*')
      .eq('county_fips', report.county_fips)
      .single();
    countyRule = data as CountyRule | null;
  }
  if (!countyRule && report.county && report.state) {
    const { data } = await supabase
      .from('county_rules')
      .select('*')
      .eq('county_name', report.county)
      .eq('state_abbreviation', report.state)
      .single();
    countyRule = data as CountyRule | null;
  }

  // ── Load calibration params (learned value bias correction) ───────────
  const cal = await getCalibrationParams(
    supabase,
    report.property_type,
    report.county_fips ?? null,
  );

  // ── Extract photo analyses from photo records ─────────────────────────
  const photos = (photosRes.data ?? []) as Photo[];
  const photoAnalyses = photos
    .filter((p) => p.ai_analysis != null)
    .map((p) => {
      const analysis = p.ai_analysis as unknown as PhotoAiAnalysis | null;
      return {
        photo_type: (p.photo_type ?? 'other') as string,
        condition_rating: analysis?.condition_rating ?? 'average',
        defects: analysis?.defects ?? [],
        professional_caption: analysis?.professional_caption ?? '',
        comparable_adjustment_note: analysis?.comparable_adjustment_note ?? '',
      };
    });

  // ── Calculate concluded value ─────────────────────────────────────────
  // Use median adjusted_price_per_sqft * subject building sqft as primary value indicator
  const comps = (compsRes.data ?? []) as ComparableSale[];
  const rentals = (rentalsRes.data ?? []) as ComparableRental[];

  // Helper: compute median value from an array of comp data using a price extractor
  function computeMedianValue(
    compList: ComparableSale[],
    sqft: number | null,
    getPricePerSqft: (c: ComparableSale) => number | null
  ): number {
    const prices = compList
      .map(getPricePerSqft)
      .filter((p): p is number => p != null && p > 0)
      .sort((a, b) => a - b);

    if (prices.length > 0 && sqft && sqft > 0) {
      const mid = Math.floor(prices.length / 2);
      const median = prices.length % 2 === 0
        ? (prices[mid - 1] + prices[mid]) / 2
        : prices[mid];
      return Math.round(median * sqft);
    }

    // Fallback: use sale_price directly
    const salePrices = compList
      .map((c) => c.sale_price)
      .filter((p): p is number => p != null && p > 0)
      .sort((a, b) => a - b);
    if (salePrices.length > 0) {
      const mid = Math.floor(salePrices.length / 2);
      return salePrices.length % 2 === 0
        ? Math.round((salePrices[mid - 1] + salePrices[mid]) / 2)
        : salePrices[mid];
    }
    return 0;
  }

  // ── Value WITH photo condition adjustments (the real concluded value) ──
  // When 0 comps are available (thin rural markets), fall back to cost/income approach.
  if (comps.length === 0 && !incomeData?.concluded_value_income_approach) {
    // Check if we can use cost approach as sole valuation method
    const landValue = propertyData.land_value ?? null;
    const qualityGrade = propertyData.quality_grade ?? 'average';
    const { costApproachValue } = computeCostApproach(
      propertyData.property_subtype,
      qualityGrade,
      propertyData.building_sqft_gross,
      propertyData.physical_depreciation_pct,
      0, // no functional obsolescence without comps
      landValue
    );
    if (!costApproachValue) {
      return {
        success: false,
        error: 'No comparable sales, income data, or sufficient cost approach data available — cannot generate valuation',
      };
    }
    console.warn(`[stage5] 0 comps and no income data — falling back to cost approach only ($${costApproachValue.toLocaleString()})`);
  }

  let concludedValue: number;
  if (comps.length > 0) {
    concludedValue = computeMedianValue(comps, propertyData.building_sqft_gross, (c) => c.adjusted_price_per_sqft);
  } else if (incomeData?.concluded_value_income_approach) {
    // No comps but income approach available — use income as primary
    concludedValue = incomeData.concluded_value_income_approach;
    console.warn(`[stage5] 0 comps — using income approach as primary value: $${concludedValue.toLocaleString()}`);
  } else {
    // Cost approach only (validated above)
    const landValue = propertyData.land_value ?? null;
    const qualityGrade = propertyData.quality_grade ?? 'average';
    const { costApproachValue } = computeCostApproach(
      propertyData.property_subtype,
      qualityGrade,
      propertyData.building_sqft_gross,
      propertyData.physical_depreciation_pct,
      0,
      landValue
    );
    concludedValue = costApproachValue!;
    console.warn(`[stage5] 0 comps, no income — using cost approach as primary value: $${concludedValue.toLocaleString()}`);
  }

  // ── Value WITHOUT photo condition adjustments (market data only) ───────
  // Strip out the photo-based condition adjustment from each comp to see
  // what the value would be using only market data + standard adjustments.
  // Stage 4 stores the photo adjustment in adjustment_pct_condition on top
  // of the base condition adjustment from stage 2. We need to reverse it.
  let concludedValueWithoutPhotos = concludedValue; // same if no photos
  let photoConditionAdjustmentPct: number | null = null;

  if (photoAnalyses.length > 0 && comps.length > 0) {
    // Re-derive the photo adjustment the same way stage4 does
    const allPhotoDefects: Array<{ severity: string; value_impact: string }> = [];
    for (const pa of photoAnalyses) {
      for (const d of pa.defects) {
        allPhotoDefects.push({ severity: d.severity, value_impact: d.value_impact });
      }
    }

    let defectAdj = 0;
    for (const defect of allPhotoDefects) {
      const severityMap = CONDITION_DEFECT_ADJUSTMENTS[defect.severity] ?? CONDITION_DEFECT_ADJUSTMENTS.minor;
      defectAdj += severityMap[defect.value_impact] ?? severityMap.low;
    }

    // Condition ratings from photo analyses
    const conditionRatings = photoAnalyses.map(p => p.condition_rating);
    const overallCondition: string = conditionRatings.length > 0
      ? (() => {
          const freq: Record<string, number> = {};
          for (const v of conditionRatings) freq[v] = (freq[v] ?? 0) + 1;
          const order = ['poor', 'fair', 'average', 'good', 'excellent'];
          let maxCount = 0;
          let mode: string = conditionRatings[0];
          for (const [val, count] of Object.entries(freq)) {
            if (count > maxCount || (count === maxCount && order.indexOf(val) < order.indexOf(mode))) {
              maxCount = count;
              mode = val;
            }
          }
          return mode;
        })()
      : 'average';

    const baseOffset = CONDITION_BASE_OFFSET[overallCondition] ?? 0;
    photoConditionAdjustmentPct = Math.max(
      Math.round((defectAdj + baseOffset) * 100) / 100,
      -25
    );

    // Only compute the "without photos" value if photos actually changed anything
    if (photoConditionAdjustmentPct !== 0) {
      // Reverse the photo adjustment on each comp to get the pre-photo price
      const pricesWithoutPhotos = comps
        .map((c) => {
          if (!c.adjusted_price_per_sqft || !c.sale_price || !c.building_sqft || c.building_sqft <= 0 || c.net_adjustment_pct == null) return null;
          // The current net includes the photo adjustment. Remove it.
          const netWithoutPhoto = c.net_adjustment_pct - photoConditionAdjustmentPct!;
          return Math.round(((c.sale_price * (1 + netWithoutPhoto / 100)) / c.building_sqft) * 100) / 100;
        })
        .filter((p): p is number => p != null && p > 0)
        .sort((a, b) => a - b);

      if (pricesWithoutPhotos.length > 0 && propertyData.building_sqft_gross) {
        const mid = Math.floor(pricesWithoutPhotos.length / 2);
        const median = pricesWithoutPhotos.length % 2 === 0
          ? (pricesWithoutPhotos[mid - 1] + pricesWithoutPhotos[mid]) / 2
          : pricesWithoutPhotos[mid];
        concludedValueWithoutPhotos = Math.round(median * propertyData.building_sqft_gross);
      }
    }
  }

  // Round to nearest $1,000
  concludedValue = Math.round(concludedValue / 1000) * 1000;
  concludedValueWithoutPhotos = Math.round(concludedValueWithoutPhotos / 1000) * 1000;

  // If income approach is available, weight it in (apply to both)
  // Only blend when we have sales comp data — if income was already the primary
  // value source (0 comps), don't dilute it with itself.
  if (incomeData?.concluded_value_income_approach && comps.length > 0) {
    const incomeValue = incomeData.concluded_value_income_approach;
    // 70% sales comparison, 30% income approach for commercial/industrial/multifamily
    concludedValue = Math.round(
      (concludedValue * 0.7 + incomeValue * 0.3) / 1000
    ) * 1000;
    concludedValueWithoutPhotos = Math.round(
      (concludedValueWithoutPhotos * 0.7 + incomeValue * 0.3) / 1000
    ) * 1000;
  }

  // ── Apply calibration value bias correction ───────────────────────────
  // value_bias_pct > 0 means system historically overvalues; apply downward correction
  if (cal.value_bias_pct !== 0 && cal.sample_count > 0) {
    const biasFactor = 1 - (cal.value_bias_pct / 100);
    concludedValue = Math.round((concludedValue * biasFactor) / 1000) * 1000;
    concludedValueWithoutPhotos = Math.round((concludedValueWithoutPhotos * biasFactor) / 1000) * 1000;
    console.log(`[stage5] Applied calibration bias correction of ${cal.value_bias_pct}% (n=${cal.sample_count})`);
  }

  // ── Photo value attribution ────────────────────────────────────────────
  const photoImpactDollars = concludedValueWithoutPhotos - concludedValue;
  const photoImpactPct = concludedValueWithoutPhotos > 0
    ? Math.round((photoImpactDollars / concludedValueWithoutPhotos) * 10000) / 100
    : 0;

  const totalDefects = photoAnalyses.reduce((sum, p) => sum + p.defects.length, 0);
  const significantDefects = photoAnalyses.reduce(
    (sum, p) => sum + p.defects.filter(d => d.severity === 'significant').length, 0
  );

  // Determine primary valuation method for transparency
  const valuationMethod: string =
    comps.length > 0 && incomeData?.concluded_value_income_approach ? 'sales_income_blend' :
    comps.length > 0 ? 'sales_comparison' :
    incomeData?.concluded_value_income_approach ? 'income' :
    'cost';

  // Store attribution on property_data
  const { error: attrUpdateError } = await supabase
    .from('property_data')
    .update({
      concluded_value: concludedValue,
      concluded_value_without_photos: concludedValueWithoutPhotos,
      photo_impact_dollars: photoImpactDollars > 0 ? photoImpactDollars : 0,
      photo_impact_pct: photoImpactPct > 0 ? photoImpactPct : 0,
      photo_condition_adjustment_pct: photoConditionAdjustmentPct,
      photo_defect_count: totalDefects,
      photo_defect_count_significant: significantDefects,
      photo_count: photoAnalyses.length,
      comp_count: comps.length,
      valuation_method: valuationMethod,
    })
    .eq('report_id', reportId);

  if (attrUpdateError) {
    console.warn(`[stage5] Failed to store photo attribution: ${attrUpdateError.message}`);
  }

  if (photoAnalyses.length > 0) {
    console.log(
      `[stage5] Photo value attribution: $${concludedValueWithoutPhotos.toLocaleString()} (market only) → $${concludedValue.toLocaleString()} (with photos) = $${photoImpactDollars.toLocaleString()} impact (${photoImpactPct}%), ${totalDefects} defects (${significantDefects} significant), condition adj: ${photoConditionAdjustmentPct}%`
    );
  }

  // ── Two-way analysis: overassessment vs. underassessment ──────────────
  const assessedForTwoWay = propertyData.assessed_value ?? 0;
  const overassessmentDollars = concludedValue > 0 && assessedForTwoWay > concludedValue
    ? assessedForTwoWay - concludedValue
    : 0;
  const underassessmentPct = concludedValue > 0 && assessedForTwoWay > 0 && concludedValue > assessedForTwoWay
    ? Math.round(((concludedValue - assessedForTwoWay) / concludedValue) * 1000) / 10
    : 0;
  const isUnderassessed = underassessmentPct > 5; // meaningful underassessment threshold

  // ── Case strength score (0-100) ────────────────────────────────────────
  // Weights: overassessment magnitude, comp count, photo evidence.
  let strengthScore = 0;

  // Overassessment magnitude (0-40 pts): 2 pts per % overassessed, capped at 40
  if (overassessmentDollars > 0 && concludedValue > 0) {
    const overPct = (overassessmentDollars / concludedValue) * 100;
    strengthScore += Math.min(
      Math.round(overPct * CASE_STRENGTH.overassessment_pts_per_pct),
      CASE_STRENGTH.overassessment_max_pts
    );
  }

  // Comparable support (0-20 pts): 4 pts per comp, up to 5 comps
  const nonWeakComps = comps.filter((c) => !c.is_weak_comparable).length;
  strengthScore += Math.min(
    nonWeakComps * CASE_STRENGTH.comp_pts_each,
    CASE_STRENGTH.comp_max_pts
  );

  // Photo evidence (0-25 pts): significant defects + total defects
  strengthScore += Math.min(
    significantDefects * CASE_STRENGTH.sig_defect_pts_each,
    CASE_STRENGTH.sig_defect_max_pts
  );
  strengthScore += Math.min(
    totalDefects * CASE_STRENGTH.defect_pts_each,
    CASE_STRENGTH.defect_max_pts
  );

  strengthScore = Math.min(Math.round(strengthScore), 100);

  // Store case intelligence on the report
  const { error: reportIntelError } = await supabase
    .from('reports')
    .update({
      case_strength_score: strengthScore,
      case_value_at_stake: overassessmentDollars > 0 ? overassessmentDollars : 0,
      is_underassessed: isUnderassessed,
      underassessment_pct: isUnderassessed ? underassessmentPct : null,
    })
    .eq('id', reportId);

  if (reportIntelError) {
    console.warn(`[stage5] Failed to store case intelligence: ${reportIntelError.message}`);
  }

  console.log(
    `[stage5] Case intelligence: strength=${strengthScore}/100, ` +
    `value_at_stake=$${overassessmentDollars.toLocaleString()}, ` +
    `is_underassessed=${isUnderassessed}${isUnderassessed ? ` (${underassessmentPct}% under)` : ''}`
  );

  // ── Determine assessment ratio based on property type ──────────────────
  let assessmentRatio: number | null = null;
  if (countyRule) {
    switch (report.property_type) {
      case 'commercial':
        assessmentRatio = countyRule.assessment_ratio_commercial;
        break;
      case 'industrial':
        assessmentRatio = countyRule.assessment_ratio_industrial;
        break;
      case 'agricultural':
        assessmentRatio = (countyRule as Record<string, unknown>).assessment_ratio_agricultural as number | null
          ?? countyRule.assessment_ratio_residential;
        break;
      default:
        assessmentRatio = countyRule.assessment_ratio_residential;
        break;
    }
  }

  // ── Compute overvaluation analysis ───────────────────────────────────
  // Pre-compute every angle where the assessor may have missed the mark.
  // This data is passed to the AI so it can build the strongest possible case.

  const assessedValue = propertyData.assessed_value;
  const buildingSqft = propertyData.building_sqft_gross;

  // Assessed $/sqft vs median comp $/sqft
  const assessedValuePerSqft = assessedValue && buildingSqft && buildingSqft > 0
    ? Math.round((assessedValue / buildingSqft) * 100) / 100
    : null;

  const adjustedPricesPerSqftForAnalysis = comps
    .map((c) => c.adjusted_price_per_sqft)
    .filter((p): p is number => p != null && p > 0)
    .sort((a, b) => a - b);

  const medianCompPricePerSqft = adjustedPricesPerSqftForAnalysis.length > 0
    ? (() => {
        const mid = Math.floor(adjustedPricesPerSqftForAnalysis.length / 2);
        return adjustedPricesPerSqftForAnalysis.length % 2 === 0
          ? Math.round(((adjustedPricesPerSqftForAnalysis[mid - 1] + adjustedPricesPerSqftForAnalysis[mid]) / 2) * 100) / 100
          : adjustedPricesPerSqftForAnalysis[mid];
      })()
    : null;

  const overvaluationPct = assessedValuePerSqft && medianCompPricePerSqft && medianCompPricePerSqft > 0
    ? Math.round(((assessedValuePerSqft - medianCompPricePerSqft) / medianCompPricePerSqft) * 1000) / 10
    : null;

  // Assessment ratio validation
  const assessmentRatioImplied = assessedValue && concludedValue > 0
    ? Math.round((assessedValue / concludedValue) * 1000) / 1000
    : null;
  const assessmentRatioExpected = assessmentRatio;
  const assessmentRatioMismatch = assessmentRatioImplied != null && assessmentRatioExpected != null
    ? assessmentRatioImplied > assessmentRatioExpected * 1.05 // 5% tolerance
    : false;

  // ATTOM market value range check
  const attomLow = propertyData.market_value_estimate_low;
  const attomHigh = propertyData.market_value_estimate_high;
  const assessedExceedsAttomRange = assessedValue != null && attomHigh != null
    ? assessedValue > attomHigh
    : false;

  // Market trend analysis from comp sale dates
  let marketTrendPct: number | null = null;
  if (comps.length >= 3) {
    const compsWithDates = comps
      .filter((c) => c.sale_date && c.sale_price && c.building_sqft && c.building_sqft > 0)
      .map((c) => ({
        date: new Date(c.sale_date!).getTime(),
        pricePerSqft: c.sale_price! / c.building_sqft!,
      }))
      .sort((a, b) => a.date - b.date);

    if (compsWithDates.length >= 3) {
      const firstHalf = compsWithDates.slice(0, Math.ceil(compsWithDates.length / 2));
      const secondHalf = compsWithDates.slice(Math.ceil(compsWithDates.length / 2));
      const avgFirst = firstHalf.reduce((s, c) => s + c.pricePerSqft, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, c) => s + c.pricePerSqft, 0) / secondHalf.length;
      if (avgFirst > 0) {
        marketTrendPct = Math.round(((avgSecond - avgFirst) / avgFirst) * 1000) / 10;
      }
    }
  }

  // Data anomaly detection
  const dataAnomalies: string[] = [];

  if (buildingSqft && medianCompPricePerSqft) {
    // Check if assessor's sqft seems wrong compared to comps
    const compSqfts = comps
      .map((c) => c.building_sqft)
      .filter((s): s is number => s != null && s > 0)
      .sort((a, b) => a - b);
    if (compSqfts.length >= 3) {
      const medianCompSqft = compSqfts[Math.floor(compSqfts.length / 2)];
      const sqftDiffPct = Math.abs((buildingSqft - medianCompSqft) / medianCompSqft) * 100;
      if (sqftDiffPct > 30) {
        dataAnomalies.push(
          `Subject building sqft (${buildingSqft.toLocaleString()}) differs from median comp sqft (${medianCompSqft.toLocaleString()}) by ${sqftDiffPct.toFixed(0)}% — verify assessor records are accurate`
        );
      }
    }
  }

  if (propertyData.year_built && propertyData.year_built < 1970) {
    const actualAge = new Date().getFullYear() - propertyData.year_built;
    const depreciationPct = propertyData.physical_depreciation_pct;
    if (depreciationPct != null && depreciationPct >= 50) {
      dataAnomalies.push(
        `Property built in ${propertyData.year_built} (${actualAge} years old) has accumulated ${depreciationPct.toFixed(1)}% physical depreciation ` +
        `against its ${propertyData.property_subtype ?? 'building category'} economic life — ` +
        `assessor must account for this depreciation in the assessment`
      );
    } else if (!depreciationPct) {
      dataAnomalies.push(
        `Property built in ${propertyData.year_built} (${actualAge}+ years old) — ` +
        `physical depreciation may not be reflected in the assessment`
      );
    }
  }

  if (propertyData.flood_zone_designation && !['X', 'C'].includes(propertyData.flood_zone_designation)) {
    dataAnomalies.push(
      `Property is in flood zone ${propertyData.flood_zone_designation} — flood risk typically warrants 5-15% value reduction that assessors often overlook`
    );
  }

  if (assessedValue && attomLow && assessedValue < attomLow * 0.7) {
    dataAnomalies.push(
      `Assessed value ($${assessedValue.toLocaleString()}) is significantly below ATTOM low estimate ($${attomLow.toLocaleString()}) — assessment records may contain data errors`
    );
  }

  // ── Functional obsolescence ───────────────────────────────────────────
  const { obsolescencePct: functionalObsolescencePct, notes: functionalObsolescenceNotes } =
    computeFunctionalObsolescence(buildingSqft, comps);

  // ── Cost approach (third USPAP approach) ──────────────────────────────
  // Requires: subtype (for RCN table), quality grade, sqft, depreciation, land value.
  // When all three approaches converge below the assessed value, the case is
  // mathematically airtight.
  const landValue = propertyData.land_value ?? null;
  const qualityGrade = propertyData.quality_grade ?? 'average';

  const { rcn: costApproachRcn, costApproachValue } = computeCostApproach(
    propertyData.property_subtype,
    qualityGrade,
    propertyData.building_sqft_gross,
    propertyData.physical_depreciation_pct,
    functionalObsolescencePct,
    landValue
  );

  // Persist cost approach and functional obsolescence to property_data
  if (costApproachRcn != null || functionalObsolescencePct > 0) {
    const { error: costUpdateError } = await supabase
      .from('property_data')
      .update({
        cost_approach_rcn: costApproachRcn,
        cost_approach_value: costApproachValue,
        functional_obsolescence_pct: functionalObsolescencePct > 0 ? functionalObsolescencePct : null,
        functional_obsolescence_notes: functionalObsolescenceNotes,
      })
      .eq('report_id', reportId);

    if (costUpdateError) {
      console.warn(`[stage5] Failed to persist cost approach: ${costUpdateError.message}`);
    } else {
      console.log(
        `[stage5] Cost approach: RCN=$${costApproachRcn?.toLocaleString()}, ` +
        `value=$${costApproachValue?.toLocaleString()}, ` +
        `functional obsolescence=${functionalObsolescencePct}%`
      );
    }
  }

  // Count distressed comps that received conditions-of-sale adjustment
  const distressedCompCount = comps.filter((c) => c.is_distressed_sale).length;

  const overvaluationAnalysis = {
    assessedValuePerSqft,
    medianCompPricePerSqft,
    overvaluationPct,
    assessmentRatioImplied,
    assessmentRatioExpected,
    assessmentRatioMismatch,
    attomMarketRangeLow: attomLow,
    attomMarketRangeHigh: attomHigh,
    assessedExceedsAttomRange,
    marketTrendPct,
    effectiveAge: propertyData.effective_age,
    physicalDepreciationPct: propertyData.physical_depreciation_pct,
    remainingEconomicLife: propertyData.remaining_economic_life,
    buildingSqftFromAssessor: buildingSqft,
    dataAnomalies,
    // Two-way analysis
    isUnderassessed,
    underassessmentPct: isUnderassessed ? underassessmentPct : null,
    // Case intelligence
    caseStrengthScore: strengthScore,
    caseValueAtStake: overassessmentDollars,
    // Cost approach
    costApproachRcn,
    costApproachValue,
    landValue,
    // Functional obsolescence
    functionalObsolescencePct: functionalObsolescencePct > 0 ? functionalObsolescencePct : null,
    functionalObsolescenceNotes,
    // Conditions of sale
    distressedCompCount,
  };

  console.log(
    `[stage5] Overvaluation analysis: ${overvaluationPct != null ? `${overvaluationPct > 0 ? '+' : ''}${overvaluationPct}% vs comps` : 'N/A'}, ` +
    `ratio mismatch: ${assessmentRatioMismatch}, exceeds ATTOM: ${assessedExceedsAttomRange}, ` +
    `market trend: ${marketTrendPct != null ? `${marketTrendPct}%` : 'N/A'}, anomalies: ${dataAnomalies.length}`
  );

  // ── Form prefill data (tax_appeal only) ────────────────────────────────
  // Generate structured form field values from the pipeline's concluded data.
  // Stored in form_submissions so the client (or admin) can download and fill
  // the county appeal form without re-entering any data.
  if (report.service_type === 'tax_appeal' && countyRule) {
    const requestedAssessedValue = assessmentRatio && assessmentRatio < 1
      ? Math.round(concludedValue * assessmentRatio / 1000) * 1000
      : concludedValue;

    const appealGrounds: string[] = [];
    if (overvaluationPct != null && overvaluationPct > 0) {
      appealGrounds.push(
        `Assessed value per sqft ($${assessedValuePerSqft}/sqft) exceeds market evidence ` +
        `($${medianCompPricePerSqft}/sqft median from ${comps.length} comparable sales)`
      );
    }
    if (assessmentRatioMismatch) {
      appealGrounds.push(
        `Implied assessment ratio (${assessmentRatioImplied?.toFixed(3)}) exceeds county statutory ratio (${assessmentRatioExpected?.toFixed(3)})`
      );
    }
    if ((propertyData.physical_depreciation_pct ?? 0) > 30) {
      appealGrounds.push(
        `Property has accumulated ${propertyData.physical_depreciation_pct?.toFixed(1)}% physical depreciation not reflected in the assessment`
      );
    }
    if (propertyData.flood_zone_designation && !['X', 'C'].includes(propertyData.flood_zone_designation)) {
      appealGrounds.push(
        `Property is in FEMA flood zone ${propertyData.flood_zone_designation} — a risk factor that suppresses market value`
      );
    }
    if (functionalObsolescencePct > 0) {
      appealGrounds.push(
        `Property exhibits ${functionalObsolescencePct}% incurable functional obsolescence (super-adequacy) relative to neighborhood comparables`
      );
    }

    const prefillData = {
      property_address: report.property_address,
      city: report.city,
      state: report.state,
      parcel_id: report.pin,
      owner_name: report.client_name,
      current_assessed_value: propertyData.assessed_value,
      concluded_market_value: concludedValue,
      requested_assessed_value: requestedAssessedValue,
      reduction_requested_dollars: overassessmentDollars > 0 ? overassessmentDollars : null,
      property_type: report.property_type,
      year_built: propertyData.year_built,
      building_sqft: propertyData.building_sqft_gross,
      lot_sqft: propertyData.lot_size_sqft,
      tax_year: propertyData.tax_year_in_appeal,
      case_strength_score: strengthScore,
      comp_count: comps.length,
      appeal_grounds: appealGrounds,
      filing_date: new Date().toISOString().split('T')[0],
      form_download_url: countyRule.form_download_url,
      portal_url: countyRule.portal_url,
      filing_steps: countyRule.filing_steps,
      required_documents: countyRule.required_documents,
      accepts_online_filing: countyRule.accepts_online_filing,
      accepts_email_filing: countyRule.accepts_email_filing,
      filing_email: countyRule.filing_email,
    };

    const submissionMethod = countyRule.accepts_online_filing ? 'online'
      : countyRule.accepts_email_filing ? 'email'
      : 'mail';

    const { error: formError } = await supabase
      .from('form_submissions')
      .insert({
        report_id: reportId,
        county_fips: report.county_fips ?? countyRule.county_fips,
        submission_method: submissionMethod,
        portal_url: countyRule.portal_url ?? null,
        submission_status: 'prefill_ready',
        prefill_data: prefillData as unknown as Record<string, unknown>,
      });

    if (formError) {
      console.warn(`[stage5] Form prefill storage failed (non-fatal): ${formError.message}`);
    } else {
      console.log(`[stage5] Form prefill ready: ${submissionMethod} filing${countyRule.portal_url ? ` via ${countyRule.portal_url}` : ''}`);
    }
  }

  // ── Build narrative payload ───────────────────────────────────────────
  const payload: NarrativePayload = {
    reportId,
    serviceType: report.service_type ?? 'tax_appeal',
    propertyType: report.property_type ?? 'residential',
    desiredOutcome: report.desired_outcome ?? null,
    propertyAddress: [
      report.property_address,
      report.city,
      report.state,
    ].filter(Boolean).join(', '),
    propertyData: {
      year_built: propertyData.year_built,
      building_sqft_gross: propertyData.building_sqft_gross,
      building_sqft_living_area: propertyData.building_sqft_living_area,
      lot_size_sqft: propertyData.lot_size_sqft,
      assessed_value: propertyData.assessed_value,
      market_value_estimate_low: propertyData.market_value_estimate_low,
      market_value_estimate_high: propertyData.market_value_estimate_high,
      property_class: propertyData.property_class,
      property_subtype: propertyData.property_subtype,
      zoning_designation: propertyData.zoning_designation,
      flood_zone_designation: propertyData.flood_zone_designation,
      // Depreciation facts — computed by Stage 1 (year_built) + refined by Stage 4 (photos)
      effective_age: propertyData.effective_age,
      effective_age_source: propertyData.effective_age_source,
      physical_depreciation_pct: propertyData.physical_depreciation_pct,
      remaining_economic_life: propertyData.remaining_economic_life,
      economic_life_years: propertyData.property_subtype
        ? (ECONOMIC_LIFE[propertyData.property_subtype] ?? null)
        : null,
    },
    comparableSales: comps.map((c) => ({
      address: c.address ?? '',
      sale_price: c.sale_price ?? 0,
      sale_date: c.sale_date ?? '',
      building_sqft: c.building_sqft,
      price_per_sqft: c.price_per_sqft,
      distance_miles: c.distance_miles,
      adjusted_price_per_sqft: c.adjusted_price_per_sqft,
    })),
    comparableRentals: rentals.length > 0
      ? rentals.map((r) => ({
          address: r.address ?? '',
          rent_per_sqft_yr: r.rent_per_sqft_yr,
          building_sqft_leased: r.building_sqft_leased,
          lease_type: r.lease_type,
          effective_net_rent_per_sqft: r.effective_net_rent_per_sqft,
        }))
      : undefined,
    incomeAnalysis: incomeData
      ? {
          net_operating_income: incomeData.net_operating_income,
          concluded_cap_rate: incomeData.concluded_cap_rate,
          concluded_value_income_approach: incomeData.concluded_value_income_approach,
        }
      : undefined,
    countyRules: countyRule
      ? {
          countyName: countyRule.county_name,
          state: countyRule.state_name,
          assessmentMethodology: countyRule.assessment_methodology ?? 'full_value',
          assessmentRatio,
          appealBoardName: countyRule.appeal_board_name,
          assessmentCycle: countyRule.assessment_cycle ?? null,
          appealDeadlineRule: countyRule.appeal_deadline_rule ?? null,
          hearingFormat: countyRule.hearing_format ?? null,
          informalReviewAvailable: countyRule.informal_review_available ?? null,
          proSeTips: countyRule.pro_se_tips ?? null,
          boardPersonalityNotes: countyRule.board_personality_notes ?? null,
          winningArgumentPatterns: countyRule.winning_argument_patterns ?? null,
          commonAssessorErrors: countyRule.common_assessor_errors ?? null,
          successRatePct: countyRule.success_rate_pct ?? null,
        }
      : {
          countyName: report.county ?? '',
          state: report.state ?? '',
          assessmentMethodology: 'full_value',
          assessmentRatio: null,
          appealBoardName: null,
          assessmentCycle: null,
          appealDeadlineRule: null,
          hearingFormat: null,
          informalReviewAvailable: null,
          proSeTips: null,
          boardPersonalityNotes: null,
          winningArgumentPatterns: null,
          commonAssessorErrors: null,
          successRatePct: null,
        },
    concludedValue,
    photoAnalyses: photoAnalyses.length > 0 ? photoAnalyses : undefined,
    photoAttribution: photoAnalyses.length > 0 && photoImpactDollars > 0
      ? {
          concludedValueWithPhotos: concludedValue,
          concludedValueWithoutPhotos,
          photoImpactDollars,
          photoImpactPct,
          photoConditionAdjustmentPct: photoConditionAdjustmentPct ?? 0,
          totalDefects,
          significantDefects,
        }
      : null,
    floodZone: propertyData.flood_zone_designation,
    overvaluationAnalysis,
  };

  // ── Per-report research — adaptive web search for current strategies ──
  let researchIntelligence: typeof payload.researchIntelligence = null;
  try {
    const { researchAppealStrategy } = await import('@/lib/services/research-agent');
    const research = await researchAppealStrategy({
      countyName: countyRule?.county_name ?? report.county ?? '',
      stateName: countyRule?.state_name ?? report.state ?? '',
      propertyType: report.property_type ?? 'residential',
      serviceType: report.service_type ?? 'tax_appeal',
      desiredOutcome: report.desired_outcome,
      assessedValue: propertyData.assessed_value,
      concludedValue,
      propertyIssues: report.property_issues ?? [],
    });
    if (research.strategyInsights) {
      researchIntelligence = {
        strategyInsights: research.strategyInsights,
        deadlineInfo: research.deadlineInfo,
        boardIntelligence: research.boardIntelligence,
        recentChanges: research.recentChanges,
        sources: research.sources,
      };
      console.log(`[stage5] Research complete: ${research.searchesPerformed} searches, ${research.sources.length} sources`);
    }
  } catch (err) {
    // Research is non-fatal — narratives can generate without it
    console.warn(`[stage5] Research agent failed (non-fatal): ${err instanceof Error ? err.message : err}`);
  }

  payload.researchIntelligence = researchIntelligence;

  // ── Call Anthropic to generate narratives ──────────────────────────────
  console.log(`[stage5] Generating narratives for report ${reportId}...`);
  const narrativeResult = await generateNarratives(payload);

  if (narrativeResult.error || !narrativeResult.data) {
    return {
      success: false,
      error: `Narrative generation failed: ${narrativeResult.error}`,
    };
  }

  const { sections, prompt_tokens, completion_tokens, generation_duration_ms } = narrativeResult.data;

  // ── Delete existing narratives ────────────────────────────────────────
  const { error: deleteNarrativesError } = await supabase
    .from('report_narratives')
    .delete()
    .eq('report_id', reportId);

  if (deleteNarrativesError) {
    return { success: false, error: `Failed to delete existing narratives: ${deleteNarrativesError.message}` };
  }

  // ── Store each section ────────────────────────────────────────────────
  const narrativeInserts = sections.map((section) => ({
    report_id: reportId,
    section_name: section.section_name,
    content: section.content,
    model_used: AI_MODELS.PRIMARY,
    prompt_tokens,
    completion_tokens,
    generation_duration_ms,
    admin_edited: false,
    admin_edited_content: null,
  } as const));

  const { error: insertError } = await supabase
    .from('report_narratives')
    .insert(narrativeInserts);

  if (insertError) {
    return {
      success: false,
      error: `Failed to insert report_narratives: ${insertError.message}`,
    };
  }

  console.log(
    `[stage5] Generated ${sections.length} narrative sections in ${generation_duration_ms}ms. Concluded value: $${concludedValue}`
  );

  return { success: true };
}
