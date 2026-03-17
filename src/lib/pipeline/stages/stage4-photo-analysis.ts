// ─── Stage 4: Photo Review (Human-in-the-Loop) ────────────────────────────────
// Instead of AI vision analysis, this stage pauses the pipeline and routes
// photos to the admin for manual review. The admin annotates each photo with
// condition ratings, defects, and descriptions. Once the admin completes
// review, the pipeline resumes and applies condition-based adjustments to
// comparable sales using the admin's annotations.
//
// This approach:
// 1. Eliminates AI vision API costs
// 2. Ensures photo evidence accuracy (critical for county appeals)

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PhotoAiAnalysis, Photo, ComparableSale } from '@/types/database';
import type { StageResult } from '../orchestrator';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute the mode (most frequent value) from an array of condition ratings.
 * In case of tie, returns the worse condition (conservative estimate).
 */
const CONDITION_ORDER = ['poor', 'fair', 'average', 'good', 'excellent'] as const;

function computeConditionMode(values: string[]): string {
  if (values.length === 0) return 'average';

  const freq: Record<string, number> = {};
  for (const v of values) {
    freq[v] = (freq[v] ?? 0) + 1;
  }

  let maxCount = 0;
  let mode = values[0];
  for (const [val, count] of Object.entries(freq)) {
    const valIdx = CONDITION_ORDER.indexOf(val as any);
    const modeIdx = CONDITION_ORDER.indexOf(mode as any);
    if (count > maxCount || (count === maxCount && valIdx < modeIdx)) {
      maxCount = count;
      mode = val;
    }
  }

  return mode;
}

// ─── Defect-to-Adjustment Mapping ────────────────────────────────────────────
// Maps each defect's severity + value_impact to a percentage adjustment.
// These compound across all defects to produce the total condition adjustment.
export const DEFECT_ADJUSTMENT: Record<string, Record<string, number>> = {
  // severity → value_impact → adjustment %
  minor:       { low: -0.5, medium: -1.0, high: -1.5 },
  moderate:    { low: -1.0, medium: -2.0, high: -3.0 },
  significant: { low: -2.0, medium: -3.5, high: -5.0 },
};

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runPhotoAnalysis(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch photos for this report ──────────────────────────────────────
  const { data: photosData, error: photoError } = await supabase
    .from('photos')
    .select('*')
    .eq('report_id', reportId)
    .order('sort_order', { ascending: true });

  if (photoError) {
    return { success: false, error: `Failed to fetch photos: ${photoError.message}` };
  }

  const photos = (photosData ?? []) as Photo[];

  if (photos.length === 0) {
    console.log('[stage4] No photos found for this report. Skipping photo analysis.');
    return { success: true };
  }

  // ── Check if photos have already been reviewed by admin ───────────────
  const reviewedPhotos = photos.filter((p) => p.ai_analysis != null);
  const allReviewed = reviewedPhotos.length === photos.length;

  if (!allReviewed) {
    // Photos need human review — pause the pipeline
    console.log(
      `[stage4] ${photos.length} photos awaiting admin review for report ${reportId}. ` +
      `Pausing pipeline (${reviewedPhotos.length}/${photos.length} already reviewed).`
    );
    return { success: true, paused: true, pauseReason: 'photo_review' };
  }

  // ── All photos reviewed — apply condition adjustments ──────────────────
  console.log(
    `[stage4] All ${photos.length} photos reviewed by admin. Applying condition adjustments.`
  );

  const conditionRatings: string[] = [];
  for (const photo of reviewedPhotos) {
    const analysis = photo.ai_analysis as unknown as PhotoAiAnalysis;
    if (analysis?.condition_rating) {
      conditionRatings.push(analysis.condition_rating);
    }
  }

  // ── Compute overall condition ─────────────────────────────────────────
  const overallCondition = computeConditionMode(conditionRatings);

  console.log(
    `[stage4] Overall condition: ${overallCondition} from ${conditionRatings.length} photos`
  );

  // ── Compute per-defect condition adjustment ──────────────────────────
  const allDefects: Array<{ severity: string; value_impact: string }> = [];
  for (const photo of photos) {
    const analysis = photo.ai_analysis as unknown as PhotoAiAnalysis | null;
    if (analysis?.defects) {
      for (const d of analysis.defects) {
        allDefects.push({ severity: d.severity, value_impact: d.value_impact });
      }
    }
  }

  let defectBasedAdjustment = 0;
  for (const defect of allDefects) {
    const severityMap = DEFECT_ADJUSTMENT[defect.severity] ?? DEFECT_ADJUSTMENT.minor;
    defectBasedAdjustment += severityMap[defect.value_impact] ?? severityMap.low;
  }

  // Also apply a base condition offset for overall poor/fair ratings
  const baseConditionOffset =
    overallCondition === 'poor' ? -3 :
    overallCondition === 'fair' ? -1.5 : 0;

  const totalConditionAdjustment = Math.round(
    (defectBasedAdjustment + baseConditionOffset) * 100
  ) / 100;

  // Cap the total adjustment at -25% to avoid unreasonable values
  const cappedAdjustment = Math.max(totalConditionAdjustment, -25);

  console.log(
    `[stage4] Condition adjustment: ${cappedAdjustment}% ` +
    `(${allDefects.length} defects: ${defectBasedAdjustment}%, ` +
    `base offset for "${overallCondition}": ${baseConditionOffset}%)`
  );

  // ── Apply condition adjustment to comparable sales ──────────────────
  if (cappedAdjustment !== 0) {
    const { data: compsData } = await supabase
      .from('comparable_sales')
      .select('*')
      .eq('report_id', reportId);
    const comps = (compsData ?? []) as ComparableSale[];

    if (comps.length > 0) {
      for (const comp of comps) {
        const newConditionAdj = comp.adjustment_pct_condition + cappedAdjustment;
        const newNet =
          comp.adjustment_pct_property_rights +
          comp.adjustment_pct_financing_terms +
          comp.adjustment_pct_conditions_of_sale +
          comp.adjustment_pct_market_trends +
          comp.adjustment_pct_location +
          comp.adjustment_pct_size +
          comp.adjustment_pct_land_to_building +
          newConditionAdj +
          comp.adjustment_pct_other;

        const roundedNet = Math.round(newNet * 100) / 100;
        const newAdjustedPricePerSqft =
          comp.building_sqft && comp.building_sqft > 0 && comp.sale_price
            ? Math.round(((comp.sale_price * (1 + roundedNet / 100)) / comp.building_sqft) * 100) / 100
            : null;

        const { error: compUpdateError } = await supabase
          .from('comparable_sales')
          .update({
            adjustment_pct_condition: newConditionAdj,
            net_adjustment_pct: roundedNet,
            is_weak_comparable: Math.abs(roundedNet) > 25,
            adjusted_price_per_sqft: newAdjustedPricePerSqft,
          })
          .eq('id', comp.id);

        if (compUpdateError) {
          console.warn(`[stage4] Failed to update comp ${comp.id}: ${compUpdateError.message}`);
        }
      }

      console.log(
        `[stage4] Applied ${cappedAdjustment}% condition adjustment to ${comps.length} comps`
      );
    }
  }

  return { success: true };
}
