// ─── Stage 4: Photo Evidence Analysis ────────────────────────────────────────
//
// User-uploaded photos are first-class appeal evidence. This stage documents
// visible condition, preserves owner testimony, and creates an aggregate
// deferred-maintenance workfile for Stage 5 and the final report.
//
// Critical boundary: photo AI does not directly rewrite comparable-sale
// adjustments, effective age, depreciation, or concluded value. Those valuation
// judgments require market/cost support and human review.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Photo, PhotoAiAnalysis, PropertyDataUpdate } from '@/types/database';
import type { StageResult } from '../../orchestrator';
import { analyzePhoto } from '@/lib/services/anthropic';
import { analyzeDeferredMaintenance } from '@/lib/services/gemini';
import { buildPhotoIntelligenceContext } from '@/lib/services/photo-intelligence';
import { pipelineLogger } from '@/lib/logger';

const CONDITION_ORDER = ['poor', 'fair', 'average', 'good', 'excellent'] as const;
type ConditionRating = (typeof CONDITION_ORDER)[number];

const REQUIRED_PHOTO_TYPES: Record<string, string[]> = {
  residential: [
    'exterior_front',
    'exterior_rear',
    'exterior_east',
    'exterior_west',
    'interior_kitchen',
    'interior_bathroom',
    'interior_living',
    'deferred_maintenance',
  ],
  commercial: [
    'exterior_front',
    'exterior_rear',
    'exterior_east',
    'exterior_west',
    'interior_living',
    'interior_bathroom',
    'deferred_maintenance',
    'interior_garage',
    'aerial',
  ],
  industrial: [
    'exterior_front',
    'exterior_rear',
    'exterior_east',
    'exterior_west',
    'interior_living',
    'interior_bathroom',
    'deferred_maintenance',
    'interior_garage',
    'structural_detail',
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

function inferMimeType(storagePath: string): string {
  const extension = storagePath.split('.').pop()?.toLowerCase() ?? 'jpeg';
  return STORAGE_MIME_TYPES[extension] ?? 'image/jpeg';
}

function isConditionRating(value: string): value is ConditionRating {
  return CONDITION_ORDER.includes(value as ConditionRating);
}

/**
 * Use the median successful image rating. This avoids directional tie-breaking
 * for an advocate, buyer, or seller while remaining resistant to one outlier.
 */
function computeOverallCondition(values: string[]): ConditionRating {
  const ranked = values
    .filter(isConditionRating)
    .map((value) => CONDITION_ORDER.indexOf(value))
    .sort((a, b) => a - b);

  if (ranked.length === 0) return 'average';

  const middle = Math.floor(ranked.length / 2);
  const rank = ranked.length % 2 === 1
    ? ranked[middle]
    : Math.round((ranked[middle - 1] + ranked[middle]) / 2);

  return CONDITION_ORDER[rank] ?? 'average';
}

function getPhotoPrompt(serviceType: string): string {
  const serviceMission = serviceType === 'pre_purchase'
    ? 'Document all visible condition risks that a buyer should investigate, price, or use in negotiations.'
    : serviceType === 'pre_listing'
      ? 'Document condition accurately, including strengths, maintenance needs, and evidence that affects sale preparation.'
      : 'Document every visible, supportable condition fact that may strengthen a property-tax appeal.';

  return `You are preparing property-condition evidence for an AI-assisted valuation workfile.

SERVICE MISSION:
${serviceMission}

EVIDENCE STANDARD:
- Be exhaustive without exaggeration.
- Separate visible observation from owner statement, inference, and recommended inspection.
- Do not lower or raise a condition rating to favor a party.
- Do not diagnose concealed conditions, structural failure, mold, asbestos, code violations, or system age from appearance alone.
- Do not assign a percentage or dollar value adjustment from a photo alone.
- Explain what additional evidence would support market impact: contractor estimate, inspection, permit record, comparable condition adjustment, or paired-sale support.
- Preserve favorable and unfavorable evidence. Advocacy means finding and presenting the strongest truthful case, not biasing observations.
- Describe location, scale, apparent extent, and image limitations precisely.

Return the required structured photo analysis. The report_language and comparable_adjustment_note fields should be usable in a hearing exhibit while clearly stating verification limits.`;
}

async function downloadPhoto(
  supabase: SupabaseClient<Database>,
  photo: Photo,
  cache: Map<string, { data: string; mimeType: string }>
): Promise<{ data: string; mimeType: string } | null> {
  const cached = cache.get(photo.id);
  if (cached) return cached;
  if (!photo.storage_path) return null;

  const { data: blob, error } = await supabase.storage.from('photos').download(photo.storage_path);
  if (error || !blob) {
    pipelineLogger.warn(
      { photoId: photo.id, error: error?.message },
      '[stage4] Failed to download photo evidence'
    );
    return null;
  }

  const image = {
    data: Buffer.from(await blob.arrayBuffer()).toString('base64'),
    mimeType: inferMimeType(photo.storage_path),
  };
  cache.set(photo.id, image);
  return image;
}

export async function runPhotoAnalysis(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('property_type, service_type, county_fips')
    .eq('id', reportId)
    .single();

  if (reportError || !report) {
    return { success: false, error: `Failed to load report for photo analysis: ${reportError?.message ?? 'not found'}` };
  }

  const propertyType = report.property_type ?? 'residential';
  const serviceType = report.service_type ?? 'tax_appeal';
  const countyFips = report.county_fips ?? null;

  const { data: propertyData, error: propertyError } = await supabase
    .from('property_data')
    .select('year_built, condition_notes')
    .eq('report_id', reportId)
    .single();

  if (propertyError || !propertyData) {
    return { success: false, error: `Failed to load property data for photo analysis: ${propertyError?.message ?? 'not found'}` };
  }

  const { data: photoRows, error: photoError } = await supabase
    .from('photos')
    .select('*')
    .eq('report_id', reportId)
    .order('sort_order', { ascending: true });

  if (photoError) {
    return { success: false, error: `Failed to fetch photos: ${photoError.message}` };
  }

  const photos = (photoRows ?? []) as Photo[];
  if (photos.length === 0) {
    pipelineLogger.info({ reportId }, '[stage4] No user photos supplied; photo stage skipped');
    return { success: true };
  }

  const uploadedTypes = new Set(
    photos.map((photo) => photo.photo_type).filter((value): value is string => Boolean(value))
  );
  const requiredTypes = REQUIRED_PHOTO_TYPES[propertyType] ?? REQUIRED_PHOTO_TYPES.residential;
  const missingTypes = requiredTypes.filter((type) => !uploadedTypes.has(type));
  const describedCount = photos.filter((photo) => (photo.caption?.trim().length ?? 0) >= 10).length;

  pipelineLogger.info(
    {
      reportId,
      photoCount: photos.length,
      describedCount,
      missingTypes,
      evidencePackageComplete: missingTypes.length === 0,
    },
    '[stage4] Photo evidence package inventoried'
  );

  const photoIntelligence = await buildPhotoIntelligenceContext(
    countyFips,
    propertyType,
    Number(propertyData.year_built) || null
  );
  const basePrompt = getPhotoPrompt(serviceType);
  const prompt = photoIntelligence
    ? `${basePrompt}\n\nHISTORICAL CONTEXT FOR COMPARISON ONLY:\n${photoIntelligence}`
    : basePrompt;

  const imageCache = new Map<string, { data: string; mimeType: string }>();
  const analyses = new Map<string, PhotoAiAnalysis>();
  const conditionRatings: string[] = [];
  const BATCH_SIZE = 3;

  for (let index = 0; index < photos.length; index += BATCH_SIZE) {
    const batch = photos.slice(index, index + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (photo) => {
        const image = await downloadPhoto(supabase, photo, imageCache);
        if (!image) return null;

        const result = await analyzePhoto(image, prompt, photo.caption?.trim() || undefined);
        if (result.error || !result.data) {
          pipelineLogger.warn(
            { photoId: photo.id, error: result.error },
            '[stage4] Photo evidence analysis failed'
          );
          return null;
        }

        const analysis = result.data.analysis as PhotoAiAnalysis;
        const { error: updateError } = await supabase
          .from('photos')
          .update({
            ai_analysis: analysis,
            caption: photo.caption?.trim() || analysis.professional_caption,
          })
          .eq('id', photo.id);

        if (updateError) {
          pipelineLogger.warn(
            { photoId: photo.id, error: updateError.message },
            '[stage4] Failed to persist photo evidence analysis'
          );
        }

        return { photoId: photo.id, analysis };
      })
    );

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      analyses.set(result.value.photoId, result.value.analysis);
      conditionRatings.push(result.value.analysis.condition_rating);
    }
  }

  if (analyses.size === 0) {
    return {
      success: false,
      error: 'Photos were uploaded but none could be analyzed. Review storage access, image formats, and OpenAI configuration.',
    };
  }

  const overallCondition = computeOverallCondition(conditionRatings);
  const significantPhotoIds = new Set(
    [...analyses.entries()]
      .filter(([, analysis]) => analysis.defects?.some((defect) => defect.severity === 'significant'))
      .map(([photoId]) => photoId)
  );

  const aggregateCandidates = photos.filter(
    (photo) => photo.photo_type === 'deferred_maintenance' || significantPhotoIds.has(photo.id)
  );

  let aggregateNotes: string | null = null;
  if (aggregateCandidates.length > 0) {
    const images: { data: string; mimeType: string }[] = [];
    for (const photo of aggregateCandidates.slice(0, 10)) {
      const image = await downloadPhoto(supabase, photo, imageCache);
      if (image) images.push(image);
    }

    if (images.length > 0) {
      const ownerContext = aggregateCandidates
        .map((photo) => photo.caption?.trim())
        .filter(Boolean)
        .join(' | ')
        .slice(0, 2500) || 'No owner descriptions supplied.';

      const aggregate = await analyzeDeferredMaintenance(images, ownerContext, propertyType);
      if (aggregate) {
        const cost = aggregate.estimatedCostToCure == null
          ? 'Cost to cure requires a qualified estimate.'
          : `Preliminary cost-to-cure indication: $${aggregate.estimatedCostToCure.toLocaleString()}; verify with a qualified contractor.`;
        const category = aggregate.primaryDefectType
          ? `Primary visible category: ${aggregate.primaryDefectType}.`
          : '';

        // Stage 5 currently recognizes the historical marker below. The text is
        // explicit that OpenAI generated the analysis; no Gemini runtime is used.
        aggregateNotes = [
          `DEFERRED MAINTENANCE ANALYSIS [Gemini Vision compatibility marker; generated by OpenAI GPT-5.6 Sol — ${images.length} photos analyzed]:`,
          `Severity: ${aggregate.severity}.`,
          aggregate.appraiserDescription,
          cost,
          category,
          `Basis and limitations: ${aggregate.justification}`,
        ].filter(Boolean).join(' ');
      }
    }
  }

  const propertyUpdate: PropertyDataUpdate = {
    overall_condition: overallCondition,
  };
  if (aggregateNotes) propertyUpdate.condition_notes = aggregateNotes;

  const { error: propertyUpdateError } = await supabase
    .from('property_data')
    .update(propertyUpdate)
    .eq('report_id', reportId);

  if (propertyUpdateError) {
    return { success: false, error: `Failed to persist photo evidence summary: ${propertyUpdateError.message}` };
  }

  pipelineLogger.info(
    {
      reportId,
      analyzedPhotoCount: analyses.size,
      overallCondition,
      aggregatePhotoCount: aggregateCandidates.length,
      valuationWriteThrough: false,
    },
    '[stage4] Photo evidence complete; valuation adjustments remain review-gated'
  );

  return { success: true };
}
