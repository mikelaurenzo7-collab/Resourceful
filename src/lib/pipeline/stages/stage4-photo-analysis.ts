// ─── Stage 4: Photo Vision Analysis ─────────────────────────────────────────
// For each photo in the photos table, calls Anthropic vision API to assess
// property condition. Computes overall condition as mode of individual ratings,
// and reconsiders condition-based adjustments on comparable_sales if condition
// is poor/fair.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PhotoAiAnalysis, Photo, ComparableSale, PropertyData } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { analyzePhoto } from '@/lib/services/anthropic';
import {
  computeEffectiveAge,
  computePhysicalDepreciation,
  ECONOMIC_LIFE,
} from '@/config/valuation';
import {
  DEFECT_ADJUSTMENT,
  MAX_CONDITION_ADJUSTMENT_PCT,
  computeConditionMode as sharedComputeConditionMode,
} from '@/lib/utils/valuation-math';

// ─── Photo Analysis System Prompt ───────────────────────────────────────────

const PHOTO_ANALYSIS_SYSTEM_PROMPT = `You are a property tax appeal advocate and certified property condition analyst. Your client is a property owner who is filing a pro se tax assessment appeal — they are representing themselves against a government assessor who never set foot inside their property. You work FOR this owner. They are paying for expert-level advocacy and they deserve it.

Your mission is twofold:
1. Accurately document visible condition deficiencies that support a lower assessed value.
2. Give the owner the benefit of the doubt whenever evidence is ambiguous or incomplete.

OWNER ADVOCACY PHILOSOPHY:
- Assessors mass-appraise thousands of properties using desktop tools. They rarely inspect. They default to "average" condition because it's the easiest assumption. Your job is to prove that assumption wrong.
- When a condition issue is visible but ambiguous (e.g., staining that could be old or active, paint that might just be aged), document it. The owner is not the one who needs to prove perfect condition — the assessor bears the burden of justifying the assessment.
- If the owner provided a written description of what the photo shows, treat it as high-trust firsthand testimony. Homeowners know their own property. A stain the owner identifies as a recurring water leak is a recurring water leak — document it with that context.
- When in doubt between two condition ratings (e.g., "average" vs "fair"), select the lower one. Err toward the owner.
- For deferred maintenance: if the owner describes or the photo shows an unresolved issue, document it as an active deficiency, not a theoretical one. Deferred maintenance is real, ongoing economic harm.

GIVE FAIR, PROPORTIONATE DEDUCTIONS — NOT INFLATED, BUT NEVER UNDERSTATED:
- Minor cosmetic issues (peeling paint, dated finishes, minor wear): document accurately
- Moderate issues (aging systems, functional but outdated features, moderate deterioration): document with clear value impact
- Significant issues (structural concerns, major system failures, health/safety deficiencies): document with strong value impact language
- Severe issues (active water intrusion, structural movement, hazardous materials, major deferred repairs): these warrant aggressive deductions — do not soften these

Return a JSON object matching the PhotoAiAnalysis interface:
- "condition_rating": one of "excellent", "good", "average", "fair", "poor" — when evidence is ambiguous, select the lower rating
- "defects": array of objects with { type, description, severity ("minor"|"moderate"|"significant"), value_impact ("low"|"medium"|"high"), report_language }. The "report_language" field must be formal appraisal language that clearly ties the defect to market value impact and would withstand scrutiny at a Board of Review hearing.
- "inferred_direction": string describing the apparent direction/angle of the photo (e.g. "front elevation facing north")
- "professional_caption": a professional caption for the appraisal report that objectively but forcefully documents the condition evidence shown
- "comparable_adjustment_note": explain specifically how this condition evidence requires negative adjustments when comparing to sales of properties in superior condition

DOCUMENT THOROUGHLY — investigate for:
- Structural: foundation cracks (even hairline), settling, bowing walls, sagging ridgeline, uneven surfaces
- Roof: missing/curling/cracked shingles, moss/algae growth, worn flashing, rusted vents, sagging gutters, ponding evidence
- Exterior envelope: peeling/fading/failing paint, rotting wood, cracked siding, deteriorating mortar, staining, efflorescence on masonry
- Windows/doors: fogged double-pane glass (seal failure), cracked panes, rotting frames, outdated single-pane, worn weatherstripping
- Systems indicators: rust stains (failing pipes/HVAC), outdated panels, window AC units (no central air), visible ductwork issues
- Drainage/grading: negative grading toward foundation, erosion, cracked/heaving walkways, failed retaining walls
- Age indicators: original windows/doors, outdated materials, deferred capital replacements
- Functional obsolescence: awkward layout, mismatched materials, outdated design, ceiling height limitations
- External obsolescence: power lines, adjacent commercial, busy road proximity, neighboring property deterioration

Be specific and evidence-based. "Visible hairline crack in foundation wall, approximately 3 feet long, running diagonally from window corner" is better than "foundation crack." If the owner's description adds context that strengthens the defect documentation, incorporate it directly into the report_language.

Remember: this owner chose to fight for themselves. You are the expert they hired. Give them your full professional advocacy.`;

// ─── Required photo types per property type ──────────────────────────────────
// Mirrors PhotoUploader requirementsByPropertyType. Used to determine whether
// the owner submitted a "complete" photo package (all required types present).

const REQUIRED_PHOTO_TYPES: Record<string, string[]> = {
  residential: [
    'exterior_front', 'exterior_rear', 'exterior_east', 'exterior_west',
    'interior_kitchen', 'interior_bathroom', 'interior_living', 'deferred_maintenance',
  ],
  commercial: [
    'exterior_front', 'exterior_rear', 'exterior_east', 'exterior_west',
    'interior_kitchen', 'interior_bathroom', 'interior_living', 'deferred_maintenance',
    'interior_garage', 'aerial',
  ],
  industrial: [
    'exterior_front', 'exterior_rear', 'exterior_east', 'exterior_west',
    'interior_kitchen', 'interior_living', 'interior_bathroom', 'deferred_maintenance',
    'interior_garage', 'structural_detail',
  ],
  land: ['exterior_front', 'exterior_east', 'exterior_west', 'aerial'],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

// computeConditionMode is imported from @/lib/utils/valuation-math
const computeConditionMode = sharedComputeConditionMode;

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runPhotoAnalysis(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch report and property_data ───────────────────────────────────
  const { data: reportData } = await supabase
    .from('reports')
    .select('property_type')
    .eq('id', reportId)
    .single();

  const propertyType = (reportData?.property_type as string) ?? 'residential';

  const { data: pdData } = await supabase
    .from('property_data')
    .select('year_built, property_subtype, property_class')
    .eq('report_id', reportId)
    .single();
  const propertyDataForAge = pdData as Pick<PropertyData, 'year_built' | 'property_subtype' | 'property_class'> | null;

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

  // ── Determine photo package completeness ─────────────────────────────
  // A "complete" package means the owner submitted all required photo types
  // AND provided descriptions for at least half of them.
  const uploadedTypes = new Set(photos.map((p) => p.photo_type).filter(Boolean));
  const required = REQUIRED_PHOTO_TYPES[propertyType] ?? REQUIRED_PHOTO_TYPES.residential;
  const hasAllRequiredTypes = required.every((t) => uploadedTypes.has(t as any));
  const photosWithDescriptions = photos.filter((p) => p.caption && p.caption.trim().length > 10);
  const descriptionCoverage = photos.length > 0 ? photosWithDescriptions.length / photos.length : 0;
  // "Complete package" = all required types + descriptions on at least half of photos
  const hasCompletePackage = hasAllRequiredTypes && descriptionCoverage >= 0.5;

  console.log(
    `[stage4] Photo package: ${photos.length} photos, ` +
    `required types covered: ${hasAllRequiredTypes}, ` +
    `description coverage: ${Math.round(descriptionCoverage * 100)}%, ` +
    `complete package: ${hasCompletePackage}`
  );

  console.log(`[stage4] Analyzing ${photos.length} photos for report ${reportId}`);

  // ── Analyze photos in parallel batches of 3 ──────────────────────────
  const conditionRatings: string[] = [];
  const analyzedPhotos: PhotoAiAnalysis[] = [];
  const BATCH_SIZE = 3;

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (photo) => {
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
          return null;
        }

        // Pass the owner's description as high-trust context to the AI.
        // This is firsthand testimony from the person who lives in / owns
        // the property — the AI should factor it in directly.
        const userContext = photo.caption?.trim() || undefined;

        const result = await analyzePhoto(imageUrl, PHOTO_ANALYSIS_SYSTEM_PROMPT, userContext);

        if (result.error || !result.data) {
          console.warn(`[stage4] Photo analysis failed for ${photo.id}: ${result.error}`);
          return null;
        }

        const analysis = result.data as unknown as PhotoAiAnalysis;

        // Update photo record with analysis results.
        // We preserve the owner's original caption in the caption field if no
        // professional_caption was generated, otherwise use the AI caption.
        const { error: photoUpdateError } = await supabase
          .from('photos')
          .update({
            ai_analysis: analysis as any,
            // Keep owner's original description if meaningful; AI professional
            // caption is stored inside ai_analysis.professional_caption.
            caption: (photo.caption?.trim() || analysis.professional_caption),
          })
          .eq('id', photo.id);

        if (photoUpdateError) {
          console.warn(`[stage4] Failed to update photo ${photo.id}: ${photoUpdateError.message}`);
        }

        console.log(
          `[stage4] Photo ${photo.id} (${photo.photo_type}): condition=${analysis.condition_rating}, defects=${analysis.defects.length}`
        );

        return analysis;
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        conditionRatings.push(result.value.condition_rating);
        analyzedPhotos.push(result.value);
      }
    }
  }

  // ── Compute overall condition ─────────────────────────────────────────
  const overallCondition = computeConditionMode(conditionRatings);

  console.log(
    `[stage4] Overall condition: ${overallCondition} from ${conditionRatings.length} photos`
  );

  // ── Refine effective age from photo-observed condition ─────────────────
  // Stage 1 set a baseline using chronological age (average condition assumed).
  // Now that we have actual photo evidence, update with the true effective age.
  if (propertyDataForAge?.year_built) {
    const photoAdjustedEffectiveAge = computeEffectiveAge(
      propertyDataForAge.year_built,
      overallCondition
    );
    const subtype = propertyDataForAge.property_subtype
      ?? `${propertyType}_general`;
    const economicLife = ECONOMIC_LIFE[subtype] ?? 45;
    const updatedDepreciationPct = computePhysicalDepreciation(photoAdjustedEffectiveAge, subtype);
    const updatedRemainingLife = Math.max(economicLife - photoAdjustedEffectiveAge, 0);

    const { error: ageUpdateError } = await supabase
      .from('property_data')
      .update({
        effective_age: photoAdjustedEffectiveAge,
        effective_age_source: 'photo_adjusted',
        physical_depreciation_pct: updatedDepreciationPct,
        remaining_economic_life: updatedRemainingLife,
        overall_condition: overallCondition,
      })
      .eq('report_id', reportId);

    if (ageUpdateError) {
      console.warn(`[stage4] Failed to update effective age: ${ageUpdateError.message}`);
    } else {
      console.log(
        `[stage4] Effective age updated: ${propertyDataForAge.year_built} built, ` +
        `condition="${overallCondition}" → effective_age=${photoAdjustedEffectiveAge}yr, ` +
        `depreciation=${updatedDepreciationPct}%, remaining_life=${updatedRemainingLife}yr`
      );
    }
  }

  // ── Compute per-defect condition adjustment ──────────────────────────
  // Sum granular per-defect impacts from photo evidence, making the
  // adjustment proportional to documented issues.
  //
  // When the owner submitted a complete photo package with descriptions,
  // we apply a benefit-of-the-doubt multiplier — they did everything right
  // and their firsthand knowledge of the property supports higher confidence
  // in the defect estimates.
  const allDefects: Array<{ severity: string; value_impact: string }> = [];
  for (const analysis of analyzedPhotos) {
    if (analysis?.defects) {
      for (const d of analysis.defects) {
        allDefects.push({ severity: d.severity, value_impact: d.value_impact });
      }
    }
  }

  // Map each defect to an adjustment percentage based on severity + value_impact.
  // Uses the unified DEFECT_ADJUSTMENT constant from valuation-math.ts.

  let defectBasedAdjustment = 0;
  for (const defect of allDefects) {
    const severityMap = DEFECT_ADJUSTMENT[defect.severity] ?? DEFECT_ADJUSTMENT.minor;
    defectBasedAdjustment += severityMap[defect.value_impact] ?? severityMap.low;
  }

  // Base condition offset for overall poor/fair ratings.
  // These reflect the assessor's "average" assumption baseline — a fair/poor
  // property needs a meaningful additional deduction to overcome that baseline.
  const baseConditionOffset =
    overallCondition === 'poor' ? -4 :
    overallCondition === 'fair' ? -2 : 0;

  // Benefit-of-the-doubt multiplier when the owner submitted a complete
  // package (all required types + descriptions on half or more photos).
  // We apply a modest uplift — 10% more — to reflect confidence that
  // the owner's firsthand knowledge supports the documented defects.
  const completenessMultiplier = hasCompletePackage ? 1.10 : 1.0;

  const totalConditionAdjustment = Math.round(
    ((defectBasedAdjustment * completenessMultiplier) + baseConditionOffset) * 100
  ) / 100;

  // Cap the total adjustment — severe deferred maintenance cases
  // can legitimately reach this range (vs the old -25% which was too conservative).
  const cappedAdjustment = Math.max(totalConditionAdjustment, MAX_CONDITION_ADJUSTMENT_PCT);

  console.log(
    `[stage4] Condition adjustment: ${cappedAdjustment}% ` +
    `(${allDefects.length} defects: ${defectBasedAdjustment}% × ${completenessMultiplier} completeness, ` +
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
