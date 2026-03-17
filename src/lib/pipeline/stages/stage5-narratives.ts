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

// ─── Section Mapping ────────────────────────────────────────────────────────

const SECTION_SORT_ORDER: Record<string, { title: string; order: number }> = {
  executive_summary: { title: 'Executive Summary', order: 1 },
  property_description: { title: 'Property Description', order: 2 },
  site_description_narrative: { title: 'Site Description', order: 3 },
  improvement_description_narrative: { title: 'Improvement Description', order: 4 },
  area_analysis_county: { title: 'County Area Analysis', order: 5 },
  area_analysis_city: { title: 'City Area Analysis', order: 6 },
  area_analysis_neighborhood: { title: 'Neighborhood Analysis', order: 7 },
  market_analysis: { title: 'Market Analysis', order: 8 },
  hbu_as_vacant: { title: 'Highest & Best Use — As Vacant', order: 9 },
  hbu_as_improved: { title: 'Highest & Best Use — As Improved', order: 10 },
  sales_comparison_narrative: { title: 'Sales Comparison Approach', order: 11 },
  adjustment_grid_narrative: { title: 'Adjustment Grid Analysis', order: 12 },
  income_approach_narrative: { title: 'Income Approach', order: 13 },
  reconciliation_narrative: { title: 'Reconciliation & Final Value', order: 14 },
  appeal_argument_summary: { title: 'Appeal Argument Summary', order: 15 },
  // legacy aliases
  neighborhood_analysis: { title: 'Neighborhood Analysis', order: 7 },
  value_conclusion: { title: 'Reconciliation & Final Value', order: 14 },
  condition_assessment: { title: 'Condition Assessment', order: 12 },
  assessment_equity: { title: 'Assessment Equity Analysis', order: 15 },
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
      };
    });

  // ── Calculate concluded value ─────────────────────────────────────────
  // Use median adjusted_price_per_sqft * subject building sqft as primary value indicator
  const comps = (compsRes.data ?? []) as ComparableSale[];
  const rentals = (rentalsRes.data ?? []) as ComparableRental[];
  let concludedValue = 0;

  if (comps.length > 0) {
    const adjustedPricesPerSqft = comps
      .map((c) => c.adjusted_price_per_sqft)
      .filter((p): p is number => p != null && p > 0)
      .sort((a, b) => a - b);

    if (adjustedPricesPerSqft.length > 0 && propertyData.building_sqft_gross) {
      const mid = Math.floor(adjustedPricesPerSqft.length / 2);
      const medianPricePerSqft = adjustedPricesPerSqft.length % 2 === 0
        ? (adjustedPricesPerSqft[mid - 1] + adjustedPricesPerSqft[mid]) / 2
        : adjustedPricesPerSqft[mid];
      concludedValue = Math.round(medianPricePerSqft * propertyData.building_sqft_gross);
    } else {
      // Fallback: use sale_price directly
      const salePrices = comps
        .map((c) => c.sale_price)
        .filter((p): p is number => p != null && p > 0)
        .sort((a, b) => a - b);
      if (salePrices.length > 0) {
        const mid = Math.floor(salePrices.length / 2);
        concludedValue = salePrices.length % 2 === 0
          ? Math.round((salePrices[mid - 1] + salePrices[mid]) / 2)
          : salePrices[mid];
      }
    }
  }

  // Round to nearest $1,000
  concludedValue = Math.round(concludedValue / 1000) * 1000;

  // If income approach is available, weight it in
  if (incomeData?.concluded_value_income_approach) {
    const incomeValue = incomeData.concluded_value_income_approach;
    // 70% sales comparison, 30% income approach for commercial/industrial
    concludedValue = Math.round(
      (concludedValue * 0.7 + incomeValue * 0.3) / 1000
    ) * 1000;
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
        }
      : {
          countyName: report.county ?? '',
          state: report.state ?? '',
          assessmentMethodology: 'full_value',
          assessmentRatio: null,
          appealBoardName: null,
        },
    concludedValue,
    photoAnalyses: photoAnalyses.length > 0 ? photoAnalyses : undefined,
    floodZone: propertyData.flood_zone_designation,
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
  await supabase
    .from('report_narratives')
    .delete()
    .eq('report_id', reportId);

  // ── Store each section ────────────────────────────────────────────────
  const narrativeInserts = sections.map((section) => ({
    report_id: reportId,
    section_name: section.section_name,
    content: section.content,
    model_used: process.env.AI_MODEL_PRIMARY ?? 'claude-sonnet-4-6',
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
