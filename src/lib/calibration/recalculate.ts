// ─── Calibration Param Recalculation ─────────────────────────────────────────
// Computes calibrated adjustment multipliers and bias corrections from
// completed calibration entries. Groups by property_type (and county_fips
// when enough data exists). Upserts results into calibration_params.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, CalibrationEntry, CalibrationParams, PropertyType } from '@/types/database';

// Minimum samples required at each calibration level
const MIN_BIAS_ONLY = 5;          // enough for a simple value bias offset
const MIN_ROUGH_MULTIPLIERS = 10; // enough for rough per-adjustment multipliers
const MIN_FULL_CALIBRATION = 50;  // enough for per-adjustment regression
const MIN_COUNTY_ENTRIES = 5;     // minimum to create county-specific params
const MIN_SQFT_ENTRIES = 5;       // minimum to compute sqft correction

interface CalibrationResult {
  property_type: PropertyType;
  county_fips: string | null;
  size_multiplier: number;
  condition_multiplier: number;
  market_trend_multiplier: number;
  land_ratio_multiplier: number;
  value_bias_pct: number;
  sqft_correction_factor: number;
  sqft_sample_size: number;
  sample_size: number;
  mean_absolute_error_pct: number;
  median_error_pct: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Clamp a multiplier to prevent runaway calibration.
 * Keeps values between 0.3 and 3.0 (never invert or overly amplify).
 */
function clampMultiplier(value: number): number {
  return Math.round(Math.max(0.3, Math.min(3.0, value)) * 100) / 100;
}

/**
 * Compute adjustment multiplier correction for one adjustment category.
 * If entries with large adjustments in this category correlate with larger errors,
 * we dampen the multiplier.
 *
 * Simple approach: if the category's average adjustment correlates with the
 * error direction, nudge the multiplier. Uses a conservative 0.5 learning rate
 * to avoid overfitting.
 */
function computeMultiplier(
  entries: CalibrationEntry[],
  getAdj: (e: CalibrationEntry) => number | null,
  level: 'rough' | 'full'
): number {
  const withAdj = entries.filter(e => {
    const adj = getAdj(e);
    return adj != null && adj !== 0 && e.variance_pct != null;
  });

  if (withAdj.length < MIN_ROUGH_MULTIPLIERS) return 1.0;

  // Correlation between adjustment magnitude and error
  const adjValues = withAdj.map(e => getAdj(e)!);
  const errorValues = withAdj.map(e => e.variance_pct!);

  const meanAdj = mean(adjValues);
  const meanErr = mean(errorValues);

  let covariance = 0;
  let adjVariance = 0;
  for (let i = 0; i < withAdj.length; i++) {
    covariance += (adjValues[i] - meanAdj) * (errorValues[i] - meanErr);
    adjVariance += (adjValues[i] - meanAdj) ** 2;
  }

  if (adjVariance === 0) return 1.0;

  const correlation = covariance / adjVariance;

  // Learning rate: conservative for rough, slightly more aggressive for full
  const learningRate = level === 'full' ? 0.15 : 0.08;

  // If positive correlation (higher adj → higher error), dampen the adjustment
  const correction = 1.0 - correlation * learningRate;
  return clampMultiplier(correction);
}

function computeParamsForGroup(
  entries: CalibrationEntry[],
  propertyType: PropertyType,
  countyFips: string | null
): CalibrationResult | null {
  const completed = entries.filter(
    e => e.status === 'completed' && e.actual_appraised_value != null
  );

  if (completed.length < MIN_BIAS_ONLY) return null;

  // Value error percentages: (system - actual) / actual * 100
  // Positive = system overvalued, negative = system undervalued
  const errorPcts = completed.map(
    e => ((e.system_concluded_value - e.actual_appraised_value!) / e.actual_appraised_value!) * 100
  );
  const absErrorPcts = errorPcts.map(Math.abs);

  const valueBiasPct = Math.round(median(errorPcts) * 100) / 100;
  const meanAbsErrorPct = Math.round(mean(absErrorPcts) * 100) / 100;
  const medianErrorPct = Math.round(median(errorPcts) * 100) / 100;

  // Determine calibration level
  const level: 'bias_only' | 'rough' | 'full' =
    completed.length >= MIN_FULL_CALIBRATION ? 'full' :
    completed.length >= MIN_ROUGH_MULTIPLIERS ? 'rough' : 'bias_only';

  // Adjustment multipliers
  let sizeMultiplier = 1.0;
  let conditionMultiplier = 1.0;
  let marketTrendMultiplier = 1.0;
  let landRatioMultiplier = 1.0;

  if (level !== 'bias_only') {
    const adjLevel = level === 'full' ? 'full' : 'rough';
    sizeMultiplier = computeMultiplier(completed, e => e.avg_adj_size, adjLevel);
    conditionMultiplier = computeMultiplier(completed, e => e.avg_adj_condition, adjLevel);
    marketTrendMultiplier = computeMultiplier(completed, e => e.avg_adj_market_trends, adjLevel);
    landRatioMultiplier = computeMultiplier(completed, e => e.avg_adj_land_ratio, adjLevel);
  }

  // Sqft correction factor
  let sqftCorrectionFactor = 1.0;
  let sqftSampleSize = 0;

  const withSqft = completed.filter(
    e => e.actual_building_sqft != null && e.actual_building_sqft > 0 &&
         e.attom_building_sqft != null && e.attom_building_sqft > 0
  );

  if (withSqft.length >= MIN_SQFT_ENTRIES) {
    const ratios = withSqft.map(e => e.attom_building_sqft! / e.actual_building_sqft!);
    sqftCorrectionFactor = Math.round(median(ratios) * 1000) / 1000;
    sqftSampleSize = withSqft.length;
    // Clamp to reasonable range (ATTOM shouldn't be off by more than 20%)
    sqftCorrectionFactor = Math.max(0.8, Math.min(1.2, sqftCorrectionFactor));
  }

  return {
    property_type: propertyType,
    county_fips: countyFips,
    size_multiplier: sizeMultiplier,
    condition_multiplier: conditionMultiplier,
    market_trend_multiplier: marketTrendMultiplier,
    land_ratio_multiplier: landRatioMultiplier,
    value_bias_pct: valueBiasPct,
    sqft_correction_factor: sqftCorrectionFactor,
    sqft_sample_size: sqftSampleSize,
    sample_size: completed.length,
    mean_absolute_error_pct: meanAbsErrorPct,
    median_error_pct: medianErrorPct,
  };
}

export async function recalculateCalibrationParams(
  supabase: SupabaseClient<Database>
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  // Fetch all completed calibration entries
  const { data: allEntries, error: fetchError } = await supabase
    .from('calibration_entries')
    .select('*')
    .eq('status', 'completed');

  if (fetchError) {
    return { updated: 0, errors: [`Failed to fetch entries: ${fetchError.message}`] };
  }

  const entries = (allEntries ?? []) as CalibrationEntry[];
  if (entries.length < MIN_BIAS_ONLY) {
    return { updated: 0, errors: [`Need at least ${MIN_BIAS_ONLY} completed entries (have ${entries.length})`] };
  }

  // Group by property type
  const propertyTypes: PropertyType[] = ['residential', 'land'];
  const results: CalibrationResult[] = [];

  for (const pt of propertyTypes) {
    const ptEntries = entries.filter(e => e.property_type === pt);

    // Global params for this property type
    const globalResult = computeParamsForGroup(ptEntries, pt, null);
    if (globalResult) {
      results.push(globalResult);
    }

    // County-specific params (only if enough data)
    const countyCounts: Record<string, CalibrationEntry[]> = {};
    for (const entry of ptEntries) {
      if (entry.county_fips) {
        if (!countyCounts[entry.county_fips]) countyCounts[entry.county_fips] = [];
        countyCounts[entry.county_fips].push(entry);
      }
    }

    for (const [fips, countyEntries] of Object.entries(countyCounts)) {
      if (countyEntries.length >= MIN_COUNTY_ENTRIES) {
        const countyResult = computeParamsForGroup(countyEntries, pt, fips);
        if (countyResult) results.push(countyResult);
      }
    }
  }

  // Upsert results
  for (const result of results) {
    const { error: upsertError } = await supabase
      .from('calibration_params')
      .upsert(
        {
          property_type: result.property_type,
          county_fips: result.county_fips,
          size_multiplier: result.size_multiplier,
          condition_multiplier: result.condition_multiplier,
          market_trend_multiplier: result.market_trend_multiplier,
          land_ratio_multiplier: result.land_ratio_multiplier,
          value_bias_pct: result.value_bias_pct,
          sqft_correction_factor: result.sqft_correction_factor,
          sqft_sample_size: result.sqft_sample_size,
          sample_size: result.sample_size,
          mean_absolute_error_pct: result.mean_absolute_error_pct,
          median_error_pct: result.median_error_pct,
          last_computed_at: new Date().toISOString(),
        },
        {
          // Match on the unique index scope
          onConflict: 'property_type,coalesce(county_fips, \'__global__\')',
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      // Fallback: try delete + insert since upsert on expression index can be tricky
      await supabase
        .from('calibration_params')
        .delete()
        .eq('property_type', result.property_type)
        .is('county_fips', result.county_fips === null ? null : undefined as never);

      if (result.county_fips !== null) {
        await supabase
          .from('calibration_params')
          .delete()
          .eq('property_type', result.property_type)
          .eq('county_fips', result.county_fips);
      }

      const { error: insertError } = await supabase
        .from('calibration_params')
        .insert({
          property_type: result.property_type,
          county_fips: result.county_fips,
          size_multiplier: result.size_multiplier,
          condition_multiplier: result.condition_multiplier,
          market_trend_multiplier: result.market_trend_multiplier,
          land_ratio_multiplier: result.land_ratio_multiplier,
          value_bias_pct: result.value_bias_pct,
          sqft_correction_factor: result.sqft_correction_factor,
          sqft_sample_size: result.sqft_sample_size,
          sample_size: result.sample_size,
          mean_absolute_error_pct: result.mean_absolute_error_pct,
          median_error_pct: result.median_error_pct,
          last_computed_at: new Date().toISOString(),
        });

      if (insertError) {
        errors.push(`Failed to upsert params for ${result.property_type}/${result.county_fips ?? 'global'}: ${insertError.message}`);
        continue;
      }
    }

    updated++;
  }

  console.log(`[calibration] Recalculated ${updated} param sets from ${entries.length} entries`);

  return { updated, errors };
}

/**
 * Fetch calibration params for a given property type and county.
 * Returns county-specific params if available, otherwise global for that type.
 * Returns null if no calibration data exists yet.
 */
export async function getCalibrationParams(
  propertyType: PropertyType,
  countyFips: string | null,
  supabase: SupabaseClient<Database>
): Promise<CalibrationParams | null> {
  // Try county-specific first
  if (countyFips) {
    const { data: countyParams } = await supabase
      .from('calibration_params')
      .select('*')
      .eq('property_type', propertyType)
      .eq('county_fips', countyFips)
      .single();

    if (countyParams) return countyParams as CalibrationParams;
  }

  // Fall back to global for this property type
  const { data: globalParams } = await supabase
    .from('calibration_params')
    .select('*')
    .eq('property_type', propertyType)
    .is('county_fips', null)
    .single();

  return (globalParams as CalibrationParams) ?? null;
}
