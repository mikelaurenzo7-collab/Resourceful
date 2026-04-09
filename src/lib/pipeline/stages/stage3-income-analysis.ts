// ─── Stage 3: Income Analysis (Commercial/Industrial Only) ──────────────────
// Builds a pro forma income statement, selects a cap rate, and calculates
// income approach value. Writes to income_analysis and comparable_rentals.
//
// Rental comp cascade:
//   1. ATTOM rental comps (paid, county-sourced)
//   2. Web search + Claude extraction (free — Serper + Anthropic)
//   3. RentCast active listings (paid, last resort)
//   4. RentCast AVM estimate (paid, last resort)
//   5. Hardcoded fallback from valuation.ts
//
// Market data (cap rates, vacancy, appreciation) is web-researched via
// Serper + Claude to override hardcoded valuation.ts constants.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ComparableRentalInsert, Report, PropertyData, ComparableSale } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { getRentalComparables } from '@/lib/services/attom';
import { getRentalListings, getRentEstimate } from '@/lib/services/rentcast';
import { findRentalsViaWeb } from '@/lib/services/web-rentals';
import { researchMarketData } from '@/lib/services/web-market-data';
import { INCOME_PARAMS, resolvePropertySubtype } from '@/config/valuation';
import { pipelineLogger } from '@/lib/logger';

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runIncomeAnalysis(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch report ──────────────────────────────────────────────────────
  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();
  const report = reportData as Report | null;

  if (reportError || !report) {
    return { success: false, error: `Failed to fetch report: ${reportError?.message}` };
  }

  // Only commercial/industrial/residential run Stage 3 at orchestrator level.
  // For residential, filter further: only multifamily gets income analysis.
  // The subtype check happens after fetching property_data below.

  // ── Fetch property data ───────────────────────────────────────────────
  const { data: pdData, error: pdError } = await supabase
    .from('property_data')
    .select('*')
    .eq('report_id', reportId)
    .single();
  const propertyData = pdData as PropertyData | null;

  if (pdError || !propertyData) {
    return { success: false, error: `No property_data found: ${pdError?.message}` };
  }

  // Use report-level lat/lng (set in stage 1)
  const latitude = report.latitude ?? 0;
  const longitude = report.longitude ?? 0;

  if (!latitude || !longitude) {
    return { success: false, error: 'No geocode coordinates found on report' };
  }

  const buildingSqFt = propertyData.building_sqft_gross ?? 0;

  // ── Resolve subtype-specific income parameters ────────────────────────
  const subtype = propertyData.property_subtype
    ?? resolvePropertySubtype(propertyData.property_class, report.property_type);

  // For residential, only multifamily gets income analysis
  if (report.property_type === 'residential' && subtype !== 'residential_multifamily') {
    pipelineLogger.info({ subtype }, '[stage3] Skipping income analysis for non-multifamily residential (subtype: )');
    return { success: true };
  }

  const incomeParams = INCOME_PARAMS[subtype] ?? INCOME_PARAMS['commercial_general'];
  const DEFAULT_VACANCY_RATE = incomeParams.vacancy_rate;
  const DEFAULT_EXPENSE_RATIO = incomeParams.expense_ratio;
  const FALLBACK_RENT = incomeParams.rent_fallback_per_sqft_yr;
  const DEFAULT_CAP_RATE = incomeParams.cap_rate_default;

  pipelineLogger.info(
    { subtype, vacancyPct: DEFAULT_VACANCY_RATE * 100, expensePct: DEFAULT_EXPENSE_RATIO * 100, fallbackRent: FALLBACK_RENT, defaultCapPct: DEFAULT_CAP_RATE * 100 },
    '[stage3] Income analysis params loaded'
  );

  // ── Query rental comparables from ATTOM ───────────────────────────────
  const rentalResult = await getRentalComparables({
    latitude,
    longitude,
    propertyType: subtype,
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
    pipelineLogger.warn({ message: deleteRentalsError.message }, '[stage3] Failed to delete existing rental comps');
  }

  let concludedMarketRentPerSqFtYr = 0;
  let rentcastCompCount = 0;

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
      pipelineLogger.warn({ message: rentalInsertError.message }, '[stage3] Failed to insert rental comps');
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

    pipelineLogger.info(
      { rentalCompCount: rentalResult.data.length, medianRentPerSqFtYr: concludedMarketRentPerSqFtYr },
      '[stage3] Found ATTOM rental comps'
    );
  } else {
    // ATTOM returned no rental comps — try web search, then RentCast, then fallback
    pipelineLogger.warn('[stage3] ATTOM returned 0 rental comps — trying web search');

    // Try web search first (free, powered by Serper + Claude)
    const webRentalResult = await findRentalsViaWeb({
      reportId,
      address: report.property_address ?? '',
      city: report.city ?? '',
      state: report.state ?? '',
      propertyType: report.property_type ?? 'commercial',
      subtype,
      buildingSqFt,
      latitude,
      longitude,
    });

    if (webRentalResult.inserts.length > 0 && webRentalResult.medianRentPerSqFtYr > 0) {
      await supabase.from('comparable_rentals').insert(webRentalResult.inserts);
      concludedMarketRentPerSqFtYr = webRentalResult.medianRentPerSqFtYr;
      rentcastCompCount = webRentalResult.inserts.length;
      pipelineLogger.info(
        { webCompCount: webRentalResult.inserts.length, medianRentPerSqFtYr: concludedMarketRentPerSqFtYr },
        '[stage3] Web search found rental comps',
      );
    }

    // If web search didn't find enough, try RentCast as paid fallback
    if (concludedMarketRentPerSqFtYr === 0) {
      pipelineLogger.warn('[stage3] Web search found 0 rental comps — trying RentCast');
      const rcListingsResult = await getRentalListings(latitude, longitude, 5, subtype, 20);
      const rcListings = (rcListingsResult.data ?? [])
        .filter((l) => l.price > 0 && l.squareFootage && l.squareFootage > 0);

      if (rcListings.length > 0) {
        const rcInserts: ComparableRentalInsert[] = rcListings.map((l) => ({
          report_id: reportId,
          address: l.formattedAddress,
          lease_date: l.listedDate ?? null,
          pin: null,
          building_sqft_leased: l.squareFootage ?? null,
          rent_per_sqft_yr: l.squareFootage
            ? Math.round((l.price * 12 / l.squareFootage) * 100) / 100
            : null,
          lease_type: null,
          tenant_pays_description: null,
          adjustment_notes: `RentCast listing (${l.status ?? 'Active'})`,
          effective_net_rent_per_sqft: l.squareFootage
            ? Math.round((l.price * 12 / l.squareFootage) * 100) / 100
            : null,
        }));
        await supabase.from('comparable_rentals').insert(rcInserts);

        const rates = rcListings
          .map((l) => (l.price * 12) / l.squareFootage!)
          .sort((a, b) => a - b);
        const mid = Math.floor(rates.length / 2);
        concludedMarketRentPerSqFtYr =
          rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid];
        rentcastCompCount = rcListings.length;
        pipelineLogger.info(
          { rcListingCount: rcListings.length, medianRentPerSqFtYr: concludedMarketRentPerSqFtYr },
          '[stage3] RentCast listings found',
        );
      }

      // If still no rate, try RentCast AVM estimate
      if (concludedMarketRentPerSqFtYr === 0) {
        const rcAvm = await getRentEstimate(
          report.property_address ?? '',
          report.city ?? '',
          report.state ?? '',
          subtype,
          buildingSqFt > 0 ? buildingSqFt : null,
        );
        if (rcAvm.data && rcAvm.data.rent > 0 && buildingSqFt > 0) {
          concludedMarketRentPerSqFtYr = (rcAvm.data.rent * 12) / buildingSqFt;
          pipelineLogger.info(
            { rentPerMonth: rcAvm.data.rent, rentPerSqFtYr: concludedMarketRentPerSqFtYr },
            '[stage3] RentCast AVM estimate used',
          );
        }
      }
    } // end RentCast fallback

    // Final hardcoded fallback
    if (concludedMarketRentPerSqFtYr === 0) {
      concludedMarketRentPerSqFtYr = FALLBACK_RENT;
      pipelineLogger.warn(
        { fallbackRent: FALLBACK_RENT, subtype },
        '[stage3] No rental comps from any source — using hardcoded fallback',
      );
    }
  }

  // ── Rental comp confidence scoring ──────────────────────────────────
  const rentalCompCount = (rentalResult.data?.length ?? 0) + rentcastCompCount;
  const rentalCompConfidence: 'high' | 'medium' | 'low' | 'none' =
    rentalCompCount >= 5 ? 'high' :
    rentalCompCount >= 2 ? 'medium' :
    rentalCompCount === 1 ? 'low' :
    'none';

  // ── Research real-time market data (cap rates, vacancy, etc.) ─────────
  const marketData = await researchMarketData({
    city: report.city ?? '',
    state: report.state ?? '',
    county: report.county ?? null,
    propertyType: report.property_type ?? 'commercial',
    subtype,
  });

  // Override hardcoded defaults with web-researched data when available
  const effectiveVacancyRate = marketData.vacancyRatePct != null
    ? marketData.vacancyRatePct / 100
    : DEFAULT_VACANCY_RATE;
  const marketVacancySource = marketData.vacancySource
    ?? (rentalResult.data?.length ? 'Derived from rental comparables' : 'Market default assumption');

  // If web research found market rent and we're using a fallback, prefer it
  if (concludedMarketRentPerSqFtYr === FALLBACK_RENT && marketData.marketRentPerSqFtYr != null) {
    concludedMarketRentPerSqFtYr = marketData.marketRentPerSqFtYr;
    pipelineLogger.info({ concludedMarketRentPerSqFtYr, marketRentSource: marketData.marketRentSource }, '[stage3] Overriding fallback rent with web research: $/sqft/yr ()');
  }

  // ── Build pro forma ───────────────────────────────────────────────────
  const potentialGrossIncome = Math.round(buildingSqFt * concludedMarketRentPerSqFtYr);
  const vacancyRatePct = effectiveVacancyRate * 100; // store as percentage
  const vacancyAmount = Math.round(potentialGrossIncome * effectiveVacancyRate);
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

  const expenseRatioPct = effectiveGrossIncome > 0
    ? Math.round((totalExpenses / effectiveGrossIncome) * 10000) / 100
    : DEFAULT_EXPENSE_RATIO * 100;

  const netOperatingIncome = effectiveGrossIncome - totalExpenses;

  // ── Cap rate selection from comparable sales implied rates ─────────────
  const { data: salesCompsData } = await supabase
    .from('comparable_sales')
    .select('*')
    .eq('report_id', reportId);
  const salesComps = (salesCompsData ?? []) as ComparableSale[];

  let concludedCapRate = DEFAULT_CAP_RATE; // subtype-specific default
  let capRateMarketLow: number | null = marketData.capRateLow;
  let capRateMarketHigh: number | null = marketData.capRateHigh;
  const investorSurveyRef: string | null = marketData.capRateSurveySource;

  // Use web-researched cap rate as the default if available (better than hardcoded)
  if (marketData.capRate != null) {
    concludedCapRate = marketData.capRate;
    pipelineLogger.info({ concludedCapRate: (concludedCapRate * 100).toFixed(2), capRateSurveySource: marketData.capRateSurveySource }, '[stage3] Using web-researched cap rate: % ()');
  }

  if (salesComps && salesComps.length > 0) {
    // Derive implied cap rates from sale prices and estimated NOI
    const impliedRates = salesComps
      .filter((c) => c.sale_price && c.sale_price > 0 && c.building_sqft && c.building_sqft > 0)
      .map((c) => {
        // Estimate NOI for each comp using our expense ratio
        const compAnnualRent = (c.building_sqft! * concludedMarketRentPerSqFtYr);
        const expenseRatio = effectiveGrossIncome > 0 ? totalExpenses / effectiveGrossIncome : DEFAULT_EXPENSE_RATIO;
        const compNoi = compAnnualRent * (1 - DEFAULT_VACANCY_RATE) * (1 - expenseRatio);
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
  const rawCapitalizedValue = concludedCapRate > 0 ? netOperatingIncome / concludedCapRate : 0;
  const capitalizedValue = Math.round(rawCapitalizedValue / 10000) * 10000;
  const concludedValueIncomeApproach = capitalizedValue;

  // ── Delete existing income_analysis ───────────────────────────────────
  const { error: deleteIncomeError } = await supabase
    .from('income_analysis')
    .delete()
    .eq('report_id', reportId);

  if (deleteIncomeError) {
    pipelineLogger.warn({ message: deleteIncomeError.message }, '[stage3] Failed to delete existing income_analysis');
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
      market_vacancy_rate_source: marketVacancySource,
      cap_rate_market_low: capRateMarketLow,
      cap_rate_market_high: capRateMarketHigh,
      cap_rate_investor_survey_avg: marketData.capRate,
      concluded_cap_rate: concludedCapRate,
      capitalized_value: capitalizedValue,
      concluded_value_income_approach: concludedValueIncomeApproach,
      investor_survey_reference: investorSurveyRef,
      rental_comp_confidence: rentalCompConfidence,
    });

  if (insertError) {
    return { success: false, error: `Failed to insert income_analysis: ${insertError.message}` };
  }

  pipelineLogger.info(
    { noi: netOperatingIncome, capRate: (concludedCapRate * 100).toFixed(2), incomeValue: concludedValueIncomeApproach, rentalCompConfidence, rentalCompCount },
    '[stage3] Income analysis complete'
  );

  return { success: true };
}
