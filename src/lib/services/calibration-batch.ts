// ─── Calibration Batch Aggregation ───────────────────────────────────────────
// Aggregates completed calibration entries into calibration_params that
// the pipeline reads to adjust future valuations. This is the learning loop
// that makes the platform increasingly accurate over time.
//
// Runs weekly via cron. For each (property_type, county_fips) combination
// with enough data, computes:
//   - value_bias_pct: systematic over/under-valuation (most impactful)
//   - mean_absolute_error_pct: overall accuracy metric
//   - median_error_pct: robust central tendency
//   - sqft_correction_factor: ATTOM sqft reporting bias (when available)
//   - sample_size: credibility weight
//
// Minimum sample threshold: 5 entries (IAAO standards recommend ≥5 for
// ratio studies). Below this, the data is too noisy to be useful.

import type { SupabaseClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/logger';

const MIN_SAMPLE_SIZE = 5;

interface CalibrationEntryRow {
  property_type: string;
  county_fips: string | null;
  variance_pct: number | null;
  building_sqft: number | null;
  attom_building_sqft: number | null;
  actual_building_sqft: number | null;
  sqft_variance_pct: number | null;
}

interface AggregatedParams {
  property_type: string;
  county_fips: string | null;
  value_bias_pct: number;
  mean_absolute_error_pct: number;
  median_error_pct: number;
  sqft_correction_factor: number;
  sqft_sample_size: number;
  sample_size: number;
}

/**
 * Compute the median of a sorted array of numbers.
 */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Aggregate calibration entries into params for one (property_type, county_fips) scope.
 */
function aggregateGroup(entries: CalibrationEntryRow[]): AggregatedParams | null {
  const firstEntry = entries[0];
  if (!firstEntry) return null;

  // Filter entries with valid variance data
  const withVariance = entries.filter(
    (e): e is CalibrationEntryRow & { variance_pct: number } =>
      e.variance_pct != null && isFinite(e.variance_pct)
  );

  if (withVariance.length < MIN_SAMPLE_SIZE) {
    return null; // Not enough data to be statistically meaningful
  }

  // Value bias: average prediction error (positive = we overvalue, negative = undervalue)
  const errors = withVariance.map(e => e.variance_pct);
  const valueBiasPct = errors.reduce((sum, v) => sum + v, 0) / errors.length;

  // Mean absolute error: average magnitude of error (accuracy metric)
  const absErrors = errors.map(e => Math.abs(e));
  const meanAbsError = absErrors.reduce((sum, v) => sum + v, 0) / absErrors.length;

  // Median error: robust central tendency (less affected by outliers)
  const sortedErrors = [...errors].sort((a, b) => a - b);
  const medianError = median(sortedErrors);

  // Sqft correction: compute from entries that have actual vs ATTOM sqft data
  let sqftCorrectionFactor = 1.0;
  let sqftSampleSize = 0;

  const withSqft = entries.filter(
    e =>
      e.actual_building_sqft != null &&
      e.attom_building_sqft != null &&
      e.actual_building_sqft > 0 &&
      e.attom_building_sqft > 0
  );

  if (withSqft.length >= 3) {
    // Ratio of ATTOM-reported to actual sqft (>1 means ATTOM overreports)
    const ratios = withSqft.map(
      e => (e.attom_building_sqft as number) / (e.actual_building_sqft as number)
    );
    sqftCorrectionFactor = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    // Clamp to reasonable range (0.85 - 1.15 = ±15% correction max)
    sqftCorrectionFactor = Math.max(0.85, Math.min(1.15, sqftCorrectionFactor));
    sqftSampleSize = withSqft.length;
  }

  return {
    property_type: firstEntry.property_type,
    county_fips: firstEntry.county_fips,
    value_bias_pct: Math.round(valueBiasPct * 100) / 100,
    mean_absolute_error_pct: Math.round(meanAbsError * 100) / 100,
    median_error_pct: Math.round(medianError * 100) / 100,
    sqft_correction_factor: Math.round(sqftCorrectionFactor * 1000) / 1000,
    sqft_sample_size: sqftSampleSize,
    sample_size: withVariance.length,
  };
}

/**
 * Run the full calibration batch aggregation.
 * Returns the number of param rows upserted.
 */
export async function runCalibrationBatch(
  supabase: SupabaseClient
): Promise<{ upserted: number; skipped: number; errors: number }> {
  // Fetch all completed calibration entries with meaningful outcome data
  // (won or lost — pending/withdrew/didnt_file don't produce variance data)
  const { data: rawEntries, error: fetchError } = await supabase
    .from('calibration_entries')
    .select(
      'property_type, county_fips, variance_pct, building_sqft, ' +
      'attom_building_sqft, actual_building_sqft, sqft_variance_pct'
    )
    .eq('status', 'completed')
    .in('actual_outcome', ['won', 'lost'])
    .not('variance_pct', 'is', null);

  if (fetchError) {
    apiLogger.error({ err: fetchError.message }, 'Query failed');
    return { upserted: 0, skipped: 0, errors: 1 };
  }

  const entries = (rawEntries ?? []) as unknown as CalibrationEntryRow[];

  if (entries.length === 0) {
    apiLogger.info('[calibration-batch] No completed entries to aggregate');
    return { upserted: 0, skipped: 0, errors: 0 };
  }

  apiLogger.info(`[calibration-batch] Processing ${entries.length} calibration entries`);

  // Group entries by (property_type, county_fips)
  const groups = new Map<string, CalibrationEntryRow[]>();
  for (const entry of entries) {
    // County-specific group
    const countyKey = `${entry.property_type}::${entry.county_fips ?? '__global__'}`;
    const existing = groups.get(countyKey);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(countyKey, [entry]);
    }

    // Also accumulate into property-type-wide group (null county)
    if (entry.county_fips) {
      const typeKey = `${entry.property_type}::__global__`;
      const typeGroup = groups.get(typeKey);
      if (typeGroup) {
        typeGroup.push(entry);
      } else {
        groups.set(typeKey, [{ ...entry, county_fips: null }]);
      }
    }
  }

  let upserted = 0;
  let skipped = 0;
  let errors = 0;

  const groupKeys = Array.from(groups.keys());
  for (const key of groupKeys) {
    const groupEntries = groups.get(key)!;
    const params = aggregateGroup(groupEntries);
    if (!params) {
      skipped++;
      continue;
    }

    // Upsert into calibration_params
    // The unique constraint is on (property_type, coalesce(county_fips, '__global__'))
    // We need to use raw SQL or try update-then-insert
    const { error: upsertError } = await supabase.rpc(
      'upsert_calibration_params' as never,
      {
        p_property_type: params.property_type,
        p_county_fips: params.county_fips,
        p_value_bias_pct: params.value_bias_pct,
        p_mean_absolute_error_pct: params.mean_absolute_error_pct,
        p_median_error_pct: params.median_error_pct,
        p_sqft_correction_factor: params.sqft_correction_factor,
        p_sqft_sample_size: params.sqft_sample_size,
        p_sample_size: params.sample_size,
      } as never
    );

    if (upsertError) {
      apiLogger.error(
        `[calibration-batch] Upsert failed for ${params.property_type}/${params.county_fips}:`,
        upsertError.message
      );
      errors++;
      continue;
    }

    apiLogger.info(
      `[calibration-batch] Updated ${params.property_type}/${params.county_fips ?? 'global'}: ` +
      `bias=${params.value_bias_pct}%, MAE=${params.mean_absolute_error_pct}%, ` +
      `n=${params.sample_size}`
    );
    upserted++;
  }

  apiLogger.info(
    `[calibration-batch] Complete: ${upserted} upserted, ${skipped} skipped (< ${MIN_SAMPLE_SIZE} samples), ${errors} errors`
  );

  return { upserted, skipped, errors };
}
