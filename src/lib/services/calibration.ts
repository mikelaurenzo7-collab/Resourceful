// ─── Calibration Service ─────────────────────────────────────────────────────
// Creates calibration entries that compare our predicted values against actual
// appeal outcomes. This is the feedback loop that makes our platform
// increasingly accurate over time — our key competitive advantage.
//
// As calibration data accumulates, we can:
// - Detect systematic bias by county (e.g., "we undervalue Cook County by 4%")
// - Identify which evidence types (photos, comps) drive better outcomes
// - Adjust model parameters for future reports
// - Build genuinely independent valuations that don't depend on county data

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData } from '@/types/database';

/**
 * Create a calibration entry after a user reports their appeal outcome.
 * Compares our concluded value (prediction) against the actual result.
 */
export async function createCalibrationEntry(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<void> {
  // Fetch report and property data
  const { data: reportData } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();

  const report = reportData as Report | null;
  if (!report || !report.appeal_outcome) {
    console.warn(`[calibration] No report or outcome for ${reportId}`);
    return;
  }

  const { data: pdData } = await supabase
    .from('property_data')
    .select('assessed_value, concluded_value, photo_count, photo_defect_count, building_sqft_gross')
    .eq('report_id', reportId)
    .single();

  const propertyData = pdData as Pick<PropertyData, 'assessed_value' | 'concluded_value' | 'photo_count' | 'photo_defect_count' | 'building_sqft_gross'> | null;

  if (!propertyData?.concluded_value) {
    console.warn(`[calibration] No concluded value for report ${reportId}`);
    return;
  }

  // Calculate prediction error
  // For 'won' appeals: compare our prediction to the board's decision
  // For 'lost' appeals: the assessed value stood — our prediction was too aggressive
  let actualValue: number | null = null;
  let predictionError: number | null = null;

  if (report.appeal_outcome === 'won' && report.actual_savings_cents != null) {
    // Board agreed property is worth less — calculate what they set it at
    const assessedValue = propertyData.assessed_value ?? 0;
    actualValue = assessedValue - (report.actual_savings_cents / 100);
    if (propertyData.concluded_value > 0) {
      predictionError = ((propertyData.concluded_value - actualValue) / actualValue) * 100;
    }
  } else if (report.appeal_outcome === 'lost') {
    // Board upheld assessed value — we were wrong
    actualValue = propertyData.assessed_value ?? null;
    if (actualValue && propertyData.concluded_value > 0) {
      predictionError = ((propertyData.concluded_value - actualValue) / actualValue) * 100;
    }
  }

  // Insert calibration entry
  // Column names must match migration 005 + 021 schema exactly
  const { error } = await supabase
    .from('calibration_entries' as never)
    .insert({
      // Migration 005 columns
      source_report_id: reportId,
      county_fips: report.county_fips,
      property_type: report.property_type,
      property_address: report.property_address ?? null,
      city: report.city ?? null,
      state: report.state ?? null,
      county: report.county ?? null,
      system_concluded_value: propertyData.concluded_value,
      actual_appraised_value: actualValue,
      variance_pct: predictionError,
      variance_dollars: actualValue != null ? (actualValue - propertyData.concluded_value) : null,
      building_sqft: propertyData.building_sqft_gross,
      status: 'completed',
      // Migration 021 columns (outcome-based)
      assessed_value: propertyData.assessed_value,
      actual_outcome: report.appeal_outcome,
      photo_count: propertyData.photo_count ?? 0,
      photo_defect_count: propertyData.photo_defect_count ?? 0,
      case_strength_score: report.case_strength_score,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    } as never);

  if (error) {
    console.error(`[calibration] Failed to insert entry for ${reportId}:`, error.message);
    return;
  }

  console.log(
    `[calibration] Entry created for report ${reportId}: ` +
    `outcome=${report.appeal_outcome}, ` +
    `predicted=${propertyData.concluded_value}, ` +
    `actual=${actualValue ?? 'N/A'}, ` +
    `error=${predictionError != null ? predictionError.toFixed(1) + '%' : 'N/A'}`
  );
}
