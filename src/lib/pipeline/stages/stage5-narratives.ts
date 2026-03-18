// ─── Stage 5: Report Narrative Generation ────────────────────────────────────
// Assembles complete structured data payload from DB, calls Anthropic to
// generate all report narrative sections in a single call, and stores each
// section in report_narratives with model/token/duration metadata.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData, ComparableSale, ComparableRental, IncomeAnalysis, Photo, CountyRule, PhotoAiAnalysis, PropertyType } from '@/types/database';
import type { StageResult } from '../orchestrator';
import {
  generateNarratives,
  type NarrativePayload,
} from '@/lib/services/anthropic';
import { AI_MODELS } from '@/config/ai';
import { getCalibrationParams } from '@/lib/calibration/recalculate';

// ─── Section Mapping ────────────────────────────────────────────────────────

const SECTION_SORT_ORDER: Record<string, { title: string; order: number }> = {
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
  reconciliation_narrative: { title: 'Reconciliation & Final Value', order: 15 },
  appeal_argument_summary: { title: 'Appeal Argument Summary', order: 16 },
  // legacy aliases
  neighborhood_analysis: { title: 'Neighborhood Analysis', order: 8 },
  value_conclusion: { title: 'Reconciliation & Final Value', order: 15 },
  assessment_equity: { title: 'Assessment Equity Analysis', order: 16 },
};

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
  let concludedValue = comps.length > 0
    ? computeMedianValue(comps, propertyData.building_sqft_gross, (c) => c.adjusted_price_per_sqft)
    : 0;

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

    const DEFECT_ADJ: Record<string, Record<string, number>> = {
      minor:       { low: -0.5, medium: -1.0, high: -1.5 },
      moderate:    { low: -1.0, medium: -2.0, high: -3.0 },
      significant: { low: -2.0, medium: -3.5, high: -5.0 },
    };

    let defectAdj = 0;
    for (const defect of allPhotoDefects) {
      const severityMap = DEFECT_ADJ[defect.severity] ?? DEFECT_ADJ.minor;
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

    const baseOffset = overallCondition === 'poor' ? -3 : overallCondition === 'fair' ? -1.5 : 0;
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
  if (incomeData?.concluded_value_income_approach) {
    const incomeValue = incomeData.concluded_value_income_approach;
    // 70% sales comparison, 30% income approach for commercial/industrial
    concludedValue = Math.round(
      (concludedValue * 0.7 + incomeValue * 0.3) / 1000
    ) * 1000;
    concludedValueWithoutPhotos = Math.round(
      (concludedValueWithoutPhotos * 0.7 + incomeValue * 0.3) / 1000
    ) * 1000;
  }

  // Apply calibration value bias correction (learned from real appraisal feedback)
  const calibration = await getCalibrationParams(
    report.property_type as PropertyType,
    report.county_fips ?? null,
    supabase
  );
  if (calibration && calibration.value_bias_pct !== 0 && concludedValue > 0) {
    const biasFactor = 1 - calibration.value_bias_pct / 100;
    const preBias = concludedValue;
    // Positive bias = system overvalues, so subtract; negative = undervalues, so add
    concludedValue = Math.round((concludedValue * biasFactor) / 1000) * 1000;
    concludedValueWithoutPhotos = Math.round((concludedValueWithoutPhotos * biasFactor) / 1000) * 1000;
    console.log(
      `[stage5] Applied value bias correction: ${preBias} → ${concludedValue} (bias: ${calibration.value_bias_pct}%, n=${calibration.sample_size})`
    );
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

  if (propertyData.year_built && propertyData.year_built < 1970 && !propertyData.effective_age) {
    dataAnomalies.push(
      `Property built in ${propertyData.year_built} (${new Date().getFullYear() - propertyData.year_built}+ years old) with no effective age recorded — physical depreciation may not be reflected in the assessment`
    );
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
    buildingSqftFromAssessor: buildingSqft,
    dataAnomalies,
  };

  console.log(
    `[stage5] Overvaluation analysis: ${overvaluationPct != null ? `${overvaluationPct > 0 ? '+' : ''}${overvaluationPct}% vs comps` : 'N/A'}, ` +
    `ratio mismatch: ${assessmentRatioMismatch}, exceeds ATTOM: ${assessedExceedsAttomRange}, ` +
    `market trend: ${marketTrendPct != null ? `${marketTrendPct}%` : 'N/A'}, anomalies: ${dataAnomalies.length}`
  );

  // ── Build narrative payload ───────────────────────────────────────────
  const payload: NarrativePayload = {
    reportId,
    serviceType: report.service_type ?? 'tax_appeal',
    propertyType: report.property_type ?? 'residential',
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
      zoning_designation: propertyData.zoning_designation,
      flood_zone_designation: propertyData.flood_zone_designation,
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
          stateAppealStrategies: countyRule.state_appeal_strategies ?? null,
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
          stateAppealStrategies: null,
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
    calibrationContext: calibration && calibration.sample_size > 0
      ? {
          sampleSize: calibration.sample_size,
          meanAbsoluteErrorPct: calibration.mean_absolute_error_pct,
          valueBiasPct: calibration.value_bias_pct,
        }
      : undefined,
  };

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
