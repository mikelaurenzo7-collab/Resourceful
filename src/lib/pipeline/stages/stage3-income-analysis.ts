// ─── Stage 3: Income Analysis (Commercial/Industrial Only) ──────────────────
// Queries ATTOM for rental comparables, builds a pro forma income statement,
// selects a cap rate from comparable sales implied rates, and calculates
// income approach value. Writes to income_analysis and comparable_rentals.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ComparableRentalInsert, PropertyType, Report, PropertyData, ComparableSale } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { getRentalComparables } from '@/lib/services/attom';
import { INCOME_PARAMS, resolvePropertySubtype } from '@/config/valuation';

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runIncomeAnalysis(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch report + property data in parallel ──────────────────────────
  const [
    { data: reportData, error: reportError },
    { data: pdData, error: pdError },
  ] = await Promise.all([
    supabase.from('reports').select('*').eq('id', reportId).single(),
    supabase.from('property_data').select('*').eq('report_id', reportId).single(),
  ]);
  const report = reportData as Report | null;
  const propertyData = pdData as PropertyData | null;

  if (reportError || !report) {
    return { success: false, error: `Failed to fetch report: ${reportError?.message}` };
  }
  if (pdError || !propertyData) {
    return { success: false, error: `No property_data found: ${pdError?.message}` };
  }

  // ── Resolve subtype and skip if income approach doesn't apply ─────────
  const subtype = propertyData.property_subtype
    ?? resolvePropertySubtype(propertyData.property_class, report.property_type);

  const INCOME_ELIGIBLE_RESIDENTIAL = new Set(['residential_multifamily', 'residential_coop']);
  const needsIncome =
    report.property_type === 'commercial' ||
    report.property_type === 'industrial' ||
    report.property_type === 'special_purpose' ||
    INCOME_ELIGIBLE_RESIDENTIAL.has(subtype);

  if (!needsIncome) {
    console.log(`[stage3] Skipping income analysis for subtype="${subtype}"`);
    return { success: true };
  }

  // Use report-level lat/lng (set in stage 1)
  const latitude = report.latitude ?? 0;
  const longitude = report.longitude ?? 0;

  if (!latitude || !longitude) {
    return { success: false, error: 'No geocode coordinates found on report' };
  }

  const buildingSqFt = propertyData.building_sqft_gross ?? 0;

  // ── Resolve subtype-specific income parameters ────────────────────────
  const incomeParams = INCOME_PARAMS[subtype] ?? INCOME_PARAMS['commercial_general'];
  const DEFAULT_VACANCY_RATE = incomeParams.vacancy_rate;
  const DEFAULT_EXPENSE_RATIO = incomeParams.expense_ratio;
  const FALLBACK_RENT = incomeParams.rent_fallback_per_sqft_yr;
  const DEFAULT_CAP_RATE = incomeParams.cap_rate_default;

  console.log(
    `[stage3] Income params for subtype="${subtype}": vacancy=${DEFAULT_VACANCY_RATE * 100}%, ` +
    `expenses=${DEFAULT_EXPENSE_RATIO * 100}%, fallbackRent=$${FALLBACK_RENT}/sf/yr, ` +
    `defaultCap=${DEFAULT_CAP_RATE * 100}%`
  );

  // ── Query rental comparables from ATTOM ───────────────────────────────
  const rentalResult = await getRentalComparables({
    latitude,
    longitude,
    propertyType: report.property_type.toUpperCase(),
    minSqft: Math.round(buildingSqFt * 0.6),
    maxSqft: Math.round(buildingSqFt * 1.4) || 99999,
    radiusMiles: 5,
    monthsBack: 24,
  });

  // ── Delete existing rental comps ──────────────────────────────────────
  const { error: deleteRentalsError } = await supabase
    .from('comparable_rentals')
    .delete()
    .eq('report_id', reportId);

  if (deleteRentalsError) {
    console.warn(`[stage3] Failed to delete existing rental comps: ${deleteRentalsError.message}`);
  }

  let concludedMarketRentPerSqFtYr = 0;

  if (rentalResult.data && rentalResult.data.length > 0) {
    // Write rental comps to DB
    const rentalInserts: ComparableRentalInsert[] = rentalResult.data.map((r) => ({
      report_id: reportId,
      address: r.address,
      lease_date: r.rentDate ?? null,
      pin: null,
      building_sqft_leased: r.buildingSquareFeet ?? null,
      rent_per_sqft_yr: r.rentPerSqFt ?? null,
      lease_type: null,
      tenant_pays_description: null,
      adjustment_notes: null,
      effective_net_rent_per_sqft: r.rentPerSqFt ?? null,
    }));

    const { error: rentalInsertError } = await supabase
      .from('comparable_rentals')
      .insert(rentalInserts);

    if (rentalInsertError) {
      console.warn(`[stage3] Failed to insert rental comps: ${rentalInsertError.message}`);
    }

    // Calculate concluded market rent from comparables (median rent_per_sqft_yr)
    const rentsPerSqFt = rentalResult.data
      .map((r) => r.rentPerSqFt)
      .filter((r): r is number => r != null && r > 0)
      .sort((a, b) => a - b);

    if (rentsPerSqFt.length > 0) {
      const mid = Math.floor(rentsPerSqFt.length / 2);
      concludedMarketRentPerSqFtYr = rentsPerSqFt.length % 2 === 0
        ? (rentsPerSqFt[mid - 1] + rentsPerSqFt[mid]) / 2
        : rentsPerSqFt[mid];
    }

    console.log(
      `[stage3] Found ${rentalResult.data.length} rental comps, median rent/sqft/yr: $${concludedMarketRentPerSqFtYr}`
    );
  } else {
    // Fallback: subtype-specific estimate from valuation config
    concludedMarketRentPerSqFtYr = FALLBACK_RENT;
    console.warn(
      `[stage3] No rental comps found. Using subtype fallback rate: $${concludedMarketRentPerSqFtYr}/sqft/yr for "${subtype}"`
    );
  }

  // ── Build pro forma ───────────────────────────────────────────────────
  const potentialGrossIncome = Math.round(buildingSqFt * concludedMarketRentPerSqFtYr);
  const vacancyRatePct = DEFAULT_VACANCY_RATE * 100; // store as percentage
  const vacancyAmount = Math.round(potentialGrossIncome * DEFAULT_VACANCY_RATE);
  const effectiveGrossIncome = potentialGrossIncome - vacancyAmount;

  // Calculate individual expense line items
  const expenseNnnDuringVacancy = Math.round(effectiveGrossIncome * 0.04);
  const expenseLegalProfessional = Math.round(effectiveGrossIncome * 0.03);
  const expenseUtilitiesCommon = Math.round(effectiveGrossIncome * 0.04);
  const expenseReserves = Math.round(effectiveGrossIncome * 0.03);
  const expenseRepairsMaintenance = Math.round(effectiveGrossIncome * 0.08);

  const totalExpenses =
    expenseNnnDuringVacancy +
    expenseLegalProfessional +
    expenseUtilitiesCommon +
    expenseReserves +
    expenseRepairsMaintenance;

  const expenseRatioDecimal = effectiveGrossIncome > 0
    ? totalExpenses / effectiveGrossIncome
    : DEFAULT_EXPENSE_RATIO;
  const expenseRatioPct = Math.round(expenseRatioDecimal * 10000) / 100;

  const netOperatingIncome = effectiveGrossIncome - totalExpenses;

  // ── Cap rate selection from comparable sales implied rates ─────────────
  const { data: salesCompsData } = await supabase
    .from('comparable_sales')
    .select('*')
    .eq('report_id', reportId);
  const salesComps = (salesCompsData ?? []) as ComparableSale[];

  let concludedCapRate = DEFAULT_CAP_RATE; // subtype-specific default
  let capRateMarketLow: number | null = null;
  let capRateMarketHigh: number | null = null;

  if (salesComps.length > 0) {
    // Derive implied cap rates from sale prices and estimated NOI
    const impliedRates = salesComps
      .filter((c) => c.sale_price && c.sale_price > 0 && c.building_sqft && c.building_sqft > 0)
      .map((c) => {
        const compNoi = c.building_sqft! * concludedMarketRentPerSqFtYr * (1 - DEFAULT_VACANCY_RATE) * (1 - expenseRatioDecimal);
        return compNoi / c.sale_price!;
      })
      .filter((r) => r > 0.03 && r < 0.15) // reasonable cap rate range
      .sort((a, b) => a - b);

    if (impliedRates.length > 0) {
      capRateMarketLow = Math.round(impliedRates[0] * 10000) / 10000;
      capRateMarketHigh = Math.round(impliedRates[impliedRates.length - 1] * 10000) / 10000;

      // Use median implied cap rate
      const mid = Math.floor(impliedRates.length / 2);
      concludedCapRate = impliedRates.length % 2 === 0
        ? (impliedRates[mid - 1] + impliedRates[mid]) / 2
        : impliedRates[mid];
      concludedCapRate = Math.round(concludedCapRate * 10000) / 10000;
    }
  }

  // ── Concluded value = NOI / cap rate, rounded to $10,000 ──────────────
  const capitalizedValue = concludedCapRate > 0
    ? Math.round((netOperatingIncome / concludedCapRate) / 10000) * 10000
    : 0;

  // ── Delete existing income_analysis ───────────────────────────────────
  const { error: deleteIncomeError } = await supabase
    .from('income_analysis')
    .delete()
    .eq('report_id', reportId);

  if (deleteIncomeError) {
    console.warn(`[stage3] Failed to delete existing income_analysis: ${deleteIncomeError.message}`);
  }

  // ── Write income analysis to DB ───────────────────────────────────────
  const { error: insertError } = await supabase
    .from('income_analysis')
    .insert({
      report_id: reportId,
      concluded_market_rent_per_sqft_yr: Math.round(concludedMarketRentPerSqFtYr * 100) / 100,
      potential_gross_income: potentialGrossIncome,
      vacancy_rate_pct: vacancyRatePct,
      vacancy_amount: vacancyAmount,
      effective_gross_income: effectiveGrossIncome,
      expense_nnn_during_vacancy: expenseNnnDuringVacancy,
      expense_legal_professional: expenseLegalProfessional,
      expense_utilities_common: expenseUtilitiesCommon,
      expense_reserves: expenseReserves,
      expense_repairs_maintenance: expenseRepairsMaintenance,
      total_expenses: totalExpenses,
      net_operating_income: netOperatingIncome,
      expense_ratio_pct: expenseRatioPct,
      market_vacancy_rate_source: rentalResult.data?.length
        ? 'Derived from rental comparables'
        : 'Market default assumption',
      cap_rate_market_low: capRateMarketLow,
      cap_rate_market_high: capRateMarketHigh,
      cap_rate_investor_survey_avg: null,
      concluded_cap_rate: concludedCapRate,
      capitalized_value: capitalizedValue,
      concluded_value_income_approach: capitalizedValue,
      investor_survey_reference: null,
    });

  if (insertError) {
    return { success: false, error: `Failed to insert income_analysis: ${insertError.message}` };
  }

  console.log(
    `[stage3] Income analysis complete. NOI: $${netOperatingIncome}, Cap: ${(concludedCapRate * 100).toFixed(2)}%, Value: $${capitalizedValue}`
  );

  return { success: true };
}
