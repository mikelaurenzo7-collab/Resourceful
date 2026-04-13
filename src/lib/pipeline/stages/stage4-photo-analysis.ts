// ─── Stage 4: Photo Vision Analysis ─────────────────────────────────────────
// For each photo in the photos table, calls Anthropic vision API to assess
// property condition. Computes overall condition as mode of individual ratings,
// and reconsiders condition-based adjustments on comparable_sales if condition
// is poor/fair.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PhotoAiAnalysis, Photo, ComparableSale, PropertyData } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { analyzePhoto } from '@/lib/services/anthropic';
import { analyzeDeferredMaintenance } from '@/lib/services/gemini';
import {
  computeEffectiveAge,
  computePhysicalDepreciation,
  ECONOMIC_LIFE,
  CONDITION_DEFECT_ADJUSTMENTS,
  CONDITION_BASE_OFFSET,
  CONDITION_ADJ_MAX_PCT,
  CONDITION_COMPLETENESS_MULTIPLIER,
} from '@/config/valuation';
import { buildPhotoIntelligenceContext } from '@/lib/services/photo-intelligence';
import { pipelineLogger } from '@/lib/logger';

// ─── Photo Analysis System Prompts by Service Type ──────────────────────────

function getPhotoAnalysisPrompt(serviceType: string): string {
  const SERVICE_FRAMING: Record<string, { role: string; mission: string; bias: string }> = {
    tax_appeal: {
      role: 'property tax appeal advocate and certified property condition analyst. Your client is a property owner filing a pro se tax assessment appeal — they are representing themselves against a government assessor who never inspected their property. You work FOR this owner.',
      mission: 'Accurately document visible condition deficiencies that support a LOWER assessed value. Every defect you find saves the owner money.',
      bias: 'When in doubt between two condition ratings (e.g., "average" vs "fair"), select the LOWER one. Err toward the owner. The assessor bears the burden of justifying the assessment.',
    },
    pre_purchase: {
      role: 'buyer-side property condition analyst. Your client is considering purchasing this property and needs to know EVERY deficiency that could justify a lower offer price or become a costly repair. You work FOR the buyer.',
      mission: 'Find every defect, deferred maintenance item, and hidden cost that a buyer needs to know about. Your analysis becomes negotiation leverage.',
      bias: 'When in doubt, flag it. Undisclosed defects cost buyers money. A cautious rating protects the buyer. When in doubt between condition ratings, select the LOWER one.',
    },
    pre_listing: {
      role: 'listing-side property condition analyst. Your client is preparing to sell this property and needs an honest but favorable assessment of condition. You work FOR the seller.',
      mission: 'Document condition accurately while highlighting strengths. Note defects honestly but frame remediable issues as opportunities. Your analysis helps price the property competitively.',
      bias: 'Be accurate but frame positively. Recent updates and good maintenance should be prominently noted. When in doubt between condition ratings, select the HIGHER one. The seller benefits from an honest but favorable presentation.',
    },
  };

  const framing = SERVICE_FRAMING[serviceType] ?? SERVICE_FRAMING.tax_appeal;

  return `You are a ${framing.role}

Your mission: ${framing.mission}

ADVOCACY PHILOSOPHY:
- ${framing.bias}
- Assessors mass-appraise thousands of properties using desktop tools. They rarely inspect. They default to "average" condition because it's the easiest assumption.
- If the owner provided a written description of what the photo shows, treat it as high-trust firsthand testimony. Homeowners know their own property.
- For deferred maintenance: if the owner describes or the photo shows an unresolved issue, document it as an active deficiency, not a theoretical one. Deferred maintenance is real, ongoing economic harm — leaks cause mold, cracks worsen, neglected roofs fail. Document the compounding nature of deferred repairs.

GIVE FAIR, PROPORTIONATE DEDUCTIONS — NOT INFLATED, BUT NEVER UNDERSTATED:
- Minor cosmetic issues (peeling paint, dated finishes, minor wear): document accurately
- Moderate issues (aging systems, functional but outdated features, moderate deterioration): document with clear value impact
- Significant issues (structural concerns, major system failures, health/safety deficiencies): document with strong value impact language
- Severe issues (active water intrusion, structural movement, hazardous materials, major deferred repairs): these warrant aggressive deductions — do not soften these

Return a JSON object matching the PhotoAiAnalysis interface:
- "condition_rating": one of "excellent", "good", "average", "fair", "poor"
- "defects": array of objects with { type, description, severity ("minor"|"moderate"|"significant"), value_impact ("low"|"medium"|"high"), report_language }. The "report_language" field must be formal appraisal language that clearly ties the defect to market value impact.
- "inferred_direction": string describing the apparent direction/angle of the photo
- "professional_caption": a professional caption for the report
- "comparable_adjustment_note": explain specifically how this condition evidence affects value comparisons

DOCUMENT THOROUGHLY — investigate for:
- Structural: foundation cracks (even hairline), settling, bowing walls, sagging ridgeline, uneven surfaces
- Roof: missing/curling/cracked shingles, moss/algae growth, worn flashing, rusted vents, sagging gutters, ponding evidence
- Water damage & leaks: staining on ceilings/walls, efflorescence on masonry, mold/mildew, water intrusion paths, damaged drywall
- Exterior envelope: peeling/fading/failing paint, rotting wood, cracked siding, deteriorating mortar
- Windows/doors: fogged double-pane glass (seal failure), cracked panes, rotting frames, outdated single-pane
- Systems indicators: rust stains (failing pipes/HVAC), outdated panels, window AC units (no central air), visible ductwork issues
- Drainage/grading: negative grading toward foundation, erosion, cracked/heaving walkways, failed retaining walls
- Deferred maintenance: items visibly neglected over months/years — accumulated wear that compounds value loss over time
- Functional obsolescence: awkward layout, mismatched materials, outdated design, ceiling height limitations
- External obsolescence: power lines, adjacent commercial, busy road proximity, neighboring property deterioration

Be specific and evidence-based. "Visible hairline crack in foundation wall, approximately 3 feet long, running diagonally from window corner" beats "foundation crack."

Remember: this owner hired you. Give them your full professional advocacy.`;
}

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
  agricultural: ['exterior_front', 'exterior_rear', 'exterior_east', 'exterior_west', 'aerial'],
};

const STORAGE_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
};

function inferMimeTypeFromStoragePath(storagePath: string): string {
  const ext = storagePath.split('.').pop()?.toLowerCase() ?? 'jpeg';
  return STORAGE_MIME_TYPES[ext] ?? 'image/jpeg';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute the mode (most frequent value) from an array of condition ratings.
 * Tie-breaking depends on service type:
 * - tax_appeal / pre_purchase → pick LOWER condition (conservative, benefits owner/buyer)
 * - pre_listing → pick HIGHER condition (favorable, benefits seller)
 */
const CONDITION_ORDER = ['poor', 'fair', 'average', 'good', 'excellent'] as const;

function computeConditionMode(values: string[], serviceType: string = 'tax_appeal'): string {
  if (values.length === 0) return 'average';

  const freq: Record<string, number> = {};
  for (const v of values) {
    freq[v] = (freq[v] ?? 0) + 1;
  }

  // Find the most frequent condition rating(s)
  let maxCount = 0;
  const candidates: string[] = [];
  for (const [val, count] of Object.entries(freq)) {
    if (count > maxCount) {
      maxCount = count;
      candidates.length = 0;
      candidates.push(val);
    } else if (count === maxCount) {
      candidates.push(val);
    }
  }

  if (candidates.length === 1) return candidates[0];

  // Tie-breaking: sort by condition order and pick based on service type.
  // pre_listing → higher condition benefits the seller
  // tax_appeal / pre_purchase → lower condition benefits the owner/buyer
  const sorted = candidates.sort((a, b) =>
    CONDITION_ORDER.indexOf(a as (typeof CONDITION_ORDER)[number]) -
    CONDITION_ORDER.indexOf(b as (typeof CONDITION_ORDER)[number])
  );
  return serviceType === 'pre_listing' ? sorted[sorted.length - 1] : sorted[0];
}

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runPhotoAnalysis(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch report and property_data ───────────────────────────────────
  const { data: reportData } = await supabase
    .from('reports')
    .select('property_type, service_type, county_fips')
    .eq('id', reportId)
    .single();

  const propertyType = (reportData?.property_type as string) ?? 'residential';
  const serviceType = (reportData?.service_type as string) ?? 'tax_appeal';
  const countyFips = (reportData as Record<string, unknown>)?.county_fips as string | null;

  const { data: pdData } = await supabase
    .from('property_data')
    .select('year_built, property_subtype, property_class')
    .eq('report_id', reportId)
    .single();
  const propertyDataForAge = pdData as Pick<PropertyData, 'year_built' | 'property_subtype' | 'property_class'> | null;

  // ── Load proprietary photo intelligence for this area ──────────────────
  // Adds context from our own analyzed photos: "Properties in this county
  // built in the 1960s average Fair condition with 2.3 defects."
  const photoIntelContext = await buildPhotoIntelligenceContext(
    countyFips,
    propertyType,
    Number(pdData?.year_built) || null
  );

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
    pipelineLogger.info('[stage4] No photos found for this report. Skipping photo analysis.');
    return { success: true };
  }

  // ── Determine photo package completeness ─────────────────────────────
  // A "complete" package means the owner submitted all required photo types
  // AND provided descriptions for at least half of them.
  const uploadedTypes = new Set<string>(
    photos
      .map((photo) => photo.photo_type)
      .filter((photoType): photoType is NonNullable<Photo['photo_type']> => photoType != null)
  );
  const required = REQUIRED_PHOTO_TYPES[propertyType] ?? REQUIRED_PHOTO_TYPES.residential;
  const hasAllRequiredTypes = required.every((photoType) => uploadedTypes.has(photoType));
  const photosWithDescriptions = photos.filter((p) => p.caption && p.caption.trim().length > 10);
  const descriptionCoverage = photos.length > 0 ? photosWithDescriptions.length / photos.length : 0;
  // "Complete package" = all required types + descriptions on at least half of photos
  const hasCompletePackage = hasAllRequiredTypes && descriptionCoverage >= 0.5;

  pipelineLogger.info(
    { photoCount: photos.length, hasAllRequiredTypes, descriptionCoveragePct: Math.round(descriptionCoverage * 100), hasCompletePackage },
    '[stage4] Photo package summary'
  );

  pipelineLogger.info({ length: photos.length, reportId }, '[stage4] Analyzing photos for report');

  // ── Analyze photos in parallel batches of 3 ──────────────────────────
  const conditionRatings: string[] = [];
  const analyzedPhotos: PhotoAiAnalysis[] = [];
  const downloadedImages = new Map<string, { data: string; mimeType: string }>();
  const BATCH_SIZE = 3;

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (photo) => {
        let imageData = downloadedImages.get(photo.id);

        if (!imageData && photo.storage_path) {
          const { data: blob, error: downloadError } = await supabase
            .storage
            .from('photos')
            .download(photo.storage_path);

          if (downloadError || !blob) {
            pipelineLogger.warn({ id: photo.id, error: downloadError?.message }, '[stage4] Failed to download photo for analysis');
            return null;
          }

          const arrayBuffer = await blob.arrayBuffer();
          imageData = {
            data: Buffer.from(arrayBuffer).toString('base64'),
            mimeType: inferMimeTypeFromStoragePath(photo.storage_path),
          };
          downloadedImages.set(photo.id, imageData);
        }

        if (!imageData) {
          pipelineLogger.warn({ id: photo.id }, '[stage4] No URL available for photo , skipping');
          return null;
        }

        // Pass the owner's description as high-trust context to the AI.
        // This is firsthand testimony from the person who lives in / owns
        // the property — the AI should factor it in directly.
        const userContext = photo.caption?.trim() || undefined;

        // Build prompt with proprietary intelligence context if available
        const basePrompt = getPhotoAnalysisPrompt(serviceType);
        const fullPrompt = photoIntelContext
          ? `${basePrompt}\n\n${photoIntelContext}`
          : basePrompt;
        const result = await analyzePhoto(imageData, fullPrompt, userContext);

        if (result.error || !result.data) {
          pipelineLogger.warn({ id: photo.id, error: result.error }, '[stage4] Photo analysis failed for');
          return null;
        }

        const analysis = result.data.analysis as unknown as PhotoAiAnalysis;

        // Update photo record with analysis results.
        // We preserve the owner's original caption in the caption field if no
        // professional_caption was generated, otherwise use the AI caption.
        const { error: photoUpdateError } = await supabase
          .from('photos')
          .update({
            ai_analysis: analysis,
            // Keep owner's original description if meaningful; AI professional
            // caption is stored inside ai_analysis.professional_caption.
            caption: (photo.caption?.trim() || analysis.professional_caption),
          })
          .eq('id', photo.id);

        if (photoUpdateError) {
          pipelineLogger.warn({ id: photo.id, message: photoUpdateError.message }, '[stage4] Failed to update photo');
        }

        pipelineLogger.info(
          { photoId: photo.id, photoType: photo.photo_type, conditionRating: analysis.condition_rating, defectCount: analysis.defects.length },
          '[stage4] Photo analyzed'
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

  // ── Gemini Vision: Aggregate deferred maintenance analysis ────────────
  // Anthropic analyzed each photo individually above. Now send ALL deferred-
  // maintenance photos to Gemini Vision simultaneously for a whole-property
  // aggregate assessment. Gemini excels at multi-image spatial reasoning and
  // produces appraiser-grade severity + cost-to-cure estimates.
  // This is non-fatal — if Gemini fails, we continue with Anthropic-only results.
  let geminiDeferredMaintenance: string | null = null;
  try {
    // Collect deferred-maintenance photos + any photos where Anthropic found significant defects.
    // analyzedPhotos is not indexed to match photos (failed analyses are skipped), so check
    // whether ANY analyzed photo had significant defects to decide if non-DM photos should be included.
    const hasSignificantDefects = analyzedPhotos.some(
      a => a?.defects?.some(d => d.severity === 'significant')
    );
    const deferredPhotos = photos.filter((p) => {
      if (p.photo_type === 'deferred_maintenance') return true;
      // If Anthropic found significant defects anywhere, also include exterior photos
      // to give Gemini a fuller picture of the property's condition
      if (hasSignificantDefects && p.photo_type?.startsWith('exterior_')) return true;
      return false;
    });

    if (deferredPhotos.length > 0) {
      // Cap at 10 images to stay within Gemini's context window
      const photosToAnalyze = deferredPhotos.slice(0, 10);

      // Download base64 data from Supabase Storage
      const base64Images: { data: string; mimeType: string }[] = [];
      for (const photo of photosToAnalyze) {
        let imageData = downloadedImages.get(photo.id);

        if (!imageData && photo.storage_path) {
          const { data: blob, error: dlError } = await supabase
            .storage
            .from('photos')
            .download(photo.storage_path);

          if (dlError || !blob) {
            pipelineLogger.warn({ id: photo.id, error: dlError?.message }, '[stage4] Failed to download photo for Gemini');
            continue;
          }

          const arrayBuffer = await blob.arrayBuffer();
          imageData = {
            data: Buffer.from(arrayBuffer).toString('base64'),
            mimeType: inferMimeTypeFromStoragePath(photo.storage_path),
          };
          downloadedImages.set(photo.id, imageData);
        }

        if (imageData) {
          base64Images.push(imageData);
        }
      }

      if (base64Images.length > 0) {
        // Build aggregate caption from all deferred maintenance photo descriptions
        const aggregateCaption = photosToAnalyze
          .map(p => p.caption?.trim())
          .filter(Boolean)
          .join(' | ')
          .slice(0, 2000) || 'Property deferred maintenance photos';

        pipelineLogger.info(
          { imageCount: base64Images.length, propertyType },
          '[stage4] Sending deferred maintenance photos to Gemini Vision'
        );

        const geminiResult = await analyzeDeferredMaintenance(
          base64Images,
          aggregateCaption,
          propertyType
        );

        if (geminiResult) {
          // Format as structured condition notes for Stage 5 narrative consumption
          const costStr = geminiResult.estimatedCostToCure
            ? `Estimated cost to cure: $${geminiResult.estimatedCostToCure.toLocaleString()}.`
            : '';
          const defectStr = geminiResult.primaryDefectType
            ? `Primary defect category: ${geminiResult.primaryDefectType}.`
            : '';
          geminiDeferredMaintenance = [
            `DEFERRED MAINTENANCE ANALYSIS [Gemini Vision — ${base64Images.length} photos analyzed]:`,
            `Severity: ${geminiResult.severity}.`,
            geminiResult.appraiserDescription,
            costStr,
            defectStr,
            `Basis: ${geminiResult.justification}`,
          ].filter(Boolean).join(' ');

          pipelineLogger.info(
            { severity: geminiResult.severity, costToCure: geminiResult.estimatedCostToCure, defectType: geminiResult.primaryDefectType },
            '[stage4] Gemini deferred maintenance analysis complete'
          );
        }
      }
    }
  } catch (geminiError) {
    // Non-fatal — Gemini analysis enriches but isn't required
    pipelineLogger.warn(
      { err: geminiError instanceof Error ? geminiError.message : String(geminiError) },
      '[stage4] Gemini deferred maintenance analysis failed (non-fatal, continuing with Anthropic results)'
    );
  }

  // ── Compute overall condition ─────────────────────────────────────────
  const overallCondition = computeConditionMode(conditionRatings, serviceType);

  pipelineLogger.info(
    { overallCondition, ratingCount: conditionRatings.length },
    '[stage4] Overall condition determined'
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
        ...(geminiDeferredMaintenance ? { condition_notes: geminiDeferredMaintenance } : {}),
      })
      .eq('report_id', reportId);

    if (ageUpdateError) {
      pipelineLogger.warn({ message: ageUpdateError.message }, '[stage4] Failed to update effective age');
    } else {
      pipelineLogger.info(
        { yearBuilt: propertyDataForAge.year_built, condition: overallCondition, effectiveAge: photoAdjustedEffectiveAge, depreciationPct: updatedDepreciationPct, remainingLife: updatedRemainingLife },
        '[stage4] Effective age updated'
      );
    }
  } else if (geminiDeferredMaintenance) {
    // No year_built to compute effective age, but still store Gemini analysis
    await supabase
      .from('property_data')
      .update({
        overall_condition: overallCondition,
        condition_notes: geminiDeferredMaintenance,
      })
      .eq('report_id', reportId);
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
  // Ranges reflect market evidence: appraisers typically apply 5-25% condition
  // adjustments in comparable sales grids.
  // Use centralized defect adjustment scales from valuation.ts
  let defectBasedAdjustment = 0;
  for (const defect of allDefects) {
    const severityMap = CONDITION_DEFECT_ADJUSTMENTS[defect.severity] ?? CONDITION_DEFECT_ADJUSTMENTS.minor;
    defectBasedAdjustment += severityMap[defect.value_impact] ?? severityMap.low;
  }

  const baseConditionOffset = CONDITION_BASE_OFFSET[overallCondition] ?? 0;
  const completenessMultiplier = hasCompletePackage ? CONDITION_COMPLETENESS_MULTIPLIER : 1.0;

  const totalConditionAdjustment = Math.round(
    ((defectBasedAdjustment * completenessMultiplier) + baseConditionOffset) * 100
  ) / 100;

  const cappedAdjustment = Math.max(totalConditionAdjustment, -CONDITION_ADJ_MAX_PCT);

  pipelineLogger.info(
    { conditionAdjustmentPct: cappedAdjustment, defectCount: allDefects.length, defectAdj: defectBasedAdjustment, completeness: completenessMultiplier, condition: overallCondition, baseOffset: baseConditionOffset },
    '[stage4] Condition adjustment computed'
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
          pipelineLogger.warn({ id: comp.id, message: compUpdateError.message }, '[stage4] Failed to update comp');
        }
      }

      pipelineLogger.info(
        { conditionAdjustmentPct: cappedAdjustment, compCount: comps.length },
        '[stage4] Condition adjustment applied to comps'
      );
    }
  }

  return { success: true };
}
