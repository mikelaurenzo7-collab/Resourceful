// ─── Calibration Repository ──────────────────────────────────────────────────
// Loads learned calibration parameters that adjust pipeline valuation outputs
// based on blind-test feedback. Falls back to neutral multipliers (1.0) when
// no calibration data exists for a given scope.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PropertyType } from '@/types/database';
import { logger } from '@/lib/logger';

export interface CalibrationMultipliers {
  size_multiplier: number;
  condition_multiplier: number;
  market_trend_multiplier: number;
  land_ratio_multiplier: number;
  value_bias_pct: number;
  sqft_correction_factor: number;
  sample_count: number;
}

const NEUTRAL: CalibrationMultipliers = {
  size_multiplier: 1.0,
  condition_multiplier: 1.0,
  market_trend_multiplier: 1.0,
  land_ratio_multiplier: 1.0,
  value_bias_pct: 0.0,
  sqft_correction_factor: 1.0,
  sample_count: 0,
};

// calibration_params is defined in migration 005 but not in the generated
// Database type yet. We cast the row to this internal shape.
// Column names match migration 005 exactly.
interface CalibrationParamsRow {
  size_multiplier: number;
  condition_multiplier: number;
  market_trend_multiplier: number;
  land_ratio_multiplier: number;
  value_bias_pct: number;
  sqft_correction_factor: number;
  sample_size: number;  // migration column name
}

function rowToMultipliers(row: CalibrationParamsRow): CalibrationMultipliers {
  return {
    size_multiplier: Number(row.size_multiplier) || 1.0,
    condition_multiplier: Number(row.condition_multiplier) || 1.0,
    market_trend_multiplier: Number(row.market_trend_multiplier) || 1.0,
    land_ratio_multiplier: Number(row.land_ratio_multiplier) || 1.0,
    value_bias_pct: Number(row.value_bias_pct) || 0.0,
    sqft_correction_factor: Number(row.sqft_correction_factor) || 1.0,
    sample_count: Number(row.sample_size) || 0,
  };
}

/**
 * Load the best-available calibration params for a property type + county.
 * Resolution order:
 *   1. County-specific params (property_type + county_fips)
 *   2. Property-type-wide params (property_type, county_fips IS NULL)
 *   3. Neutral defaults (all multipliers = 1.0)
 */
export async function getCalibrationParams(
  supabase: SupabaseClient<Database>,
  propertyType: PropertyType,
  countyFips: string | null,
): Promise<CalibrationMultipliers> {
  try {
    // Use the generic .from() with explicit cast since calibration_params
    // is not yet in the generated Database type
    const db = supabase as unknown as SupabaseClient;

    // Try county-specific first
    if (countyFips) {
      const { data: countyParams } = await db
        .from('calibration_params')
        .select('*')
        .eq('property_type', propertyType)
        .eq('county_fips', countyFips)
        .single();

      if (countyParams) {
        return rowToMultipliers(countyParams as CalibrationParamsRow);
      }
    }

    // Fall back to property-type-wide
    const { data: typeParams } = await db
      .from('calibration_params')
      .select('*')
      .eq('property_type', propertyType)
      .is('county_fips', null)
      .single();

    if (typeParams) {
      return rowToMultipliers(typeParams as CalibrationParamsRow);
    }

    return NEUTRAL;
  } catch (err) {
    logger.warn({ err, propertyType, countyFips }, 'Failed to load calibration params');
    return NEUTRAL;
  }
}
