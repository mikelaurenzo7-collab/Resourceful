// ─── Stage 4: Photo Vision Analysis ─────────────────────────────────────────
// For each photo in the photos table, calls Anthropic vision API to assess
// property condition. Computes overall condition as mode of individual ratings,
// and reconsiders condition-based adjustments on comparable_sales if condition
// is poor/fair.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PhotoAiAnalysis, Photo, ComparableSale } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { analyzePhoto } from '@/lib/services/anthropic';

// ─── Photo Analysis System Prompt ───────────────────────────────────────────

const PHOTO_ANALYSIS_SYSTEM_PROMPT = `You are a licensed property appraiser analyzing property photographs for a formal assessment report. For each photo, provide a structured analysis.

Return a JSON object matching the PhotoAiAnalysis interface:
- "condition_rating": one of "excellent", "good", "average", "fair", "poor"
- "defects": array of objects with { type, description, severity ("minor"|"moderate"|"significant"), value_impact ("low"|"medium"|"high"), report_language }
- "inferred_direction": string describing the inferred direction/angle of the photo
- "professional_caption": a professional caption suitable for an appraisal report
- "comparable_adjustment_note": note about how this condition might affect comparable adjustments

Focus on:
- Structural integrity indicators (foundation cracks, sagging, water damage)
- Roof condition (missing shingles, wear, moss/algae)
- Exterior material condition (paint, siding, masonry)
- Window/door condition
- Landscaping and drainage
- Overall maintenance level
- Any code violations or safety concerns visible

Be specific and objective. Reference visible evidence, not assumptions.`;

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

  console.log(`[stage4] Analyzing ${photos.length} photos for report ${reportId}`);

  // ── Analyze each photo ────────────────────────────────────────────────
  const conditionRatings: string[] = [];

  for (const photo of photos) {
    // Get a signed URL if the photo is in Supabase storage
    let imageUrl: string | null = null;

    if (photo.storage_path) {
      const { data: signedUrl } = await supabase
        .storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 3600); // 1 hour

      imageUrl = signedUrl?.signedUrl ?? null;
    }

    if (!imageUrl) {
      console.warn(`[stage4] No URL available for photo ${photo.id}, skipping`);
      continue;
    }

    const result = await analyzePhoto(imageUrl, PHOTO_ANALYSIS_SYSTEM_PROMPT);

    if (result.error || !result.data) {
      console.warn(`[stage4] Photo analysis failed for ${photo.id}: ${result.error}`);
      continue;
    }

    const analysis = result.data as unknown as PhotoAiAnalysis;
    conditionRatings.push(analysis.condition_rating);

    // Update photo record with analysis results (ai_analysis is JSONB)
    const { error: photoUpdateError } = await supabase
      .from('photos')
      .update({
        ai_analysis: analysis as any,
        caption: analysis.professional_caption,
      })
      .eq('id', photo.id);

    if (photoUpdateError) {
      console.warn(`[stage4] Failed to update photo ${photo.id}: ${photoUpdateError.message}`);
    }

    console.log(
      `[stage4] Photo ${photo.id} (${photo.photo_type}): condition=${analysis.condition_rating}, defects=${analysis.defects.length}`
    );
  }

  // ── Compute overall condition ─────────────────────────────────────────
  const overallCondition = computeConditionMode(conditionRatings);

  console.log(
    `[stage4] Overall condition: ${overallCondition} from ${conditionRatings.length} photos`
  );

  // ── Reconsider condition-based comp adjustments if poor/fair ───────────
  if (overallCondition === 'poor' || overallCondition === 'fair') {
    console.log(
      `[stage4] Condition is ${overallCondition} — adjusting comparable sales for condition`
    );

    const { data: compsData } = await supabase
      .from('comparable_sales')
      .select('*')
      .eq('report_id', reportId);
    const comps = (compsData ?? []) as ComparableSale[];

    if (comps.length > 0) {
      // Apply additional condition adjustment: -5% for fair, -10% for poor
      const conditionAdjustment = overallCondition === 'poor' ? -10 : -5;

      for (const comp of comps) {
        const newConditionAdj = comp.adjustment_pct_condition + conditionAdjustment;
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
        `[stage4] Applied ${conditionAdjustment}% condition adjustment to ${comps.length} comps`
      );
    }
  }

  return { success: true };
}
