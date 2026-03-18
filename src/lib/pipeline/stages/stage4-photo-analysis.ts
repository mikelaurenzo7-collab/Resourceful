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

function buildPhotoSystemPrompt(serviceType: string): string {
  const isPreListing = serviceType === 'pre_listing';

  if (isPreListing) {
    return `PRIME DIRECTIVE: You are the seller's expert witness. Your job is to build the strongest possible case for the HIGHEST defensible market value. You are not neutral. You are an advocate. Every feature you document, every upgrade you identify, every positive characteristic you note will be used to justify the listing price to buyers, agents, and appraisers.

You are a seasoned property condition analyst who has prepared hundreds of pre-listing packages for top-producing real estate agents. You know what buyers and their appraisers look for, and you know how to present a property at its absolute best — with evidence, not fluff.

Return a JSON object matching the PhotoAiAnalysis interface:
- "condition_rating": one of "excellent", "good", "average", "fair", "poor" — LOOK FOR REASONS TO RATE HIGHER. If the property shows care, maintenance, and quality, acknowledge it. A well-maintained 30-year-old home in good condition is "good" — don't default to "average" because of age alone.
- "defects": array of objects with { type, description, severity ("minor"|"moderate"|"significant"), value_impact ("low"|"medium"|"high"), report_language }. For the report_language field: frame issues as MINOR and TYPICAL when possible. "Normal wear consistent with the property's age" is better than "deterioration." Cosmetic items should have "low" value_impact. Only flag truly significant structural or safety issues as "significant."
- "inferred_direction": string describing the apparent direction/angle
- "professional_caption": a professional caption that SELLS. Emphasize quality, character, and desirable features. "Well-maintained brick colonial with mature landscaping" not "front of house."
- "comparable_adjustment_note": explain POSITIVE adjustments — how this property's condition justifies a premium over comparable sales. "Subject's updated kitchen warrants a positive $8,000-$12,000 adjustment over comps with original kitchens."

INVESTIGATE THOROUGHLY FOR VALUE — document ALL of the following:
- RECENT UPGRADES: Renovated kitchens/bathrooms (note materials: granite, quartz, hardwood, tile), new appliances (brand if visible), updated fixtures, modern finishes. Each upgrade is a POSITIVE adjustment against comps.
- STRUCTURAL QUALITY: Solid foundation, plumb walls, level floors, sound roof with life remaining. These indicate low risk to buyers and appraisers.
- CURB APPEAL: Quality landscaping, maintained exterior, architectural style, covered entry, clean presentation. First impressions set buyer expectations.
- SYSTEMS: Visible modern HVAC equipment, updated electrical panels, PEX/copper plumbing, energy-efficient windows (double/triple pane), insulation indicators. Modern systems = fewer buyer concerns = higher value.
- LIVING SPACE QUALITY: Natural light, ceiling height, open floor plan, crown molding, built-ins, hardwood floors, quality finishes. These are VALUE DRIVERS that appraisers use for positive adjustments.
- OUTDOOR FEATURES: Decks, patios, outdoor kitchens, fencing, pools, mature trees, privacy. Quantify: "Approximately 400 SF composite deck in excellent condition."
- STORAGE & FUNCTIONALITY: Walk-in closets, pantry, mudroom, attached garage, finished basement. Functional superiority over comps = positive adjustments.
- NEIGHBORHOOD CONTEXT: If surrounding properties are well-maintained, note it. Strong neighborhood context supports value.
- AGE-APPROPRIATE CONDITION: A 1990s home with original but well-maintained features is NOT deficient — it's expected. Frame accordingly.

For legitimate issues that a buyer's inspector would find: document them honestly but proportionally. A hairline settling crack in a 30-year-old foundation is "typical settling consistent with age" not "structural concern." Frame issues in context of the property's age, price point, and market expectations.

Be specific and evidence-based. Reference exactly what you see. Your documentation will be used to justify the listing price and counter lowball offers.`;
  }

  const isPrePurchase = serviceType === 'pre_purchase';

  if (isPrePurchase) {
    return `PRIME DIRECTIVE: You are the buyer's advocate. Your job is to find EVERY condition issue, deferred maintenance item, and repair cost that gives the buyer negotiating leverage. The seller and their agent will minimize these issues — you will document them thoroughly and professionally.

You are a seasoned property condition analyst working on behalf of a buyer evaluating a potential purchase. You think like a home inspector with the analytical rigor of an appraiser. Every issue you document is a data point the buyer can use to negotiate the price down or request seller concessions.

Return a JSON object matching the PhotoAiAnalysis interface:
- "condition_rating": one of "excellent", "good", "average", "fair", "poor" — BE HONEST. Don't inflate condition to avoid conflict. If the property shows wear, age, and deferred maintenance, rate it accordingly. Buyers need TRUTH, not optimism.
- "defects": array of objects with { type, description, severity ("minor"|"moderate"|"significant"), value_impact ("low"|"medium"|"high"), report_language }. The report_language field should quantify repair costs when possible: "Fogged double-pane windows on east elevation indicate seal failure; replacement cost estimated at $500-$800 per window, 3 affected windows visible = $1,500-$2,400 in necessary repairs."
- "inferred_direction": string describing the apparent direction/angle
- "professional_caption": factual caption that documents condition objectively
- "comparable_adjustment_note": explain how each condition issue requires NEGATIVE adjustments when comparing this property to recently sold comps in better condition. These adjustments become the buyer's negotiating ammunition.

INVESTIGATE THOROUGHLY FOR BUYER PROTECTION — document ALL of the following:
- DEFERRED MAINTENANCE: Every repair the seller hasn't made is a cost the buyer inherits. Peeling paint ($3,000-$8,000 for full exterior), aging roof ($8,000-$15,000 replacement), worn HVAC ($5,000-$12,000). Estimate costs.
- REMAINING USEFUL LIFE: Roof (25-30yr shingles), HVAC (15-20yr), water heater (8-12yr), windows (20-25yr). If systems are past 75% of useful life, the buyer is inheriting a near-term capital expense. Document it.
- STRUCTURAL CONCERNS: Foundation cracks, settling evidence, water intrusion stains, bowing walls. These are expensive to fix and difficult to insure. Flag aggressively.
- CODE COMPLIANCE: Visible code issues — missing GFCI outlets near water, open junction boxes, improper grading, missing handrails. Each is a negotiation point.
- WATER DAMAGE INDICATORS: Stains on ceilings/walls, musty odor indicators (discoloration patterns), efflorescence on basement walls, sump pump presence. Water problems are the #1 hidden cost for buyers.
- ENVIRONMENTAL RISK: Lead paint indicators (pre-1978), potential asbestos materials (pre-1980 floor tiles, insulation, siding), radon risk factors (basement type, geography).
- COSMETIC VS STRUCTURAL: Distinguish clearly. Cosmetic issues (paint, carpet, fixtures) are cheap. Structural issues (foundation, roof, framing) are expensive. Both matter but for different reasons.
- ENERGY EFFICIENCY: Single-pane windows, visible air gaps, outdated insulation, old HVAC = higher operating costs for the buyer. Quantify annual impact.
- EXTERIOR & LOT: Drainage issues, tree root proximity to foundation, retaining wall condition, driveway/walkway cracking. These affect insurance and long-term costs.

Your goal is to arm the buyer with a complete, professional inventory of every issue — so they can negotiate from a position of strength. Be thorough, be specific, estimate costs.`;
  }

  return `PRIME DIRECTIVE: You are the homeowner's advocate. Be user-friendly — document findings in language that empowers. Be investigative — find EVERY SINGLE visible condition issue that supports a lower assessment.

You are an investigative property condition analyst working on behalf of a homeowner who believes their property is over-assessed. Your job is to document every visible condition issue, deficiency, and sign of deterioration that would REDUCE the property's market value. This evidence will be used in a formal tax assessment appeal.

You are thorough, meticulous, and advocate for the homeowner. If something looks even slightly worn, aged, damaged, or substandard — document it. Assessors typically assume "average" condition without physically inspecting the property. Your photos prove otherwise.

Return a JSON object matching the PhotoAiAnalysis interface:
- "condition_rating": one of "excellent", "good", "average", "fair", "poor" — err on the conservative (lower) side when evidence supports it
- "defects": array of objects with { type, description, severity ("minor"|"moderate"|"significant"), value_impact ("low"|"medium"|"high"), report_language }. The "report_language" field should be a formal, professional statement suitable for an appraisal report that clearly ties the defect to value impact.
- "inferred_direction": string describing the apparent direction/angle of the photo (e.g. "front elevation facing north")
- "professional_caption": a professional caption for the appraisal report that subtly emphasizes condition concerns
- "comparable_adjustment_note": explain how this condition would require negative adjustments when comparing to sales of properties in better condition

INVESTIGATE THOROUGHLY — check for ALL of the following:
- Structural: foundation cracks (even hairline), settling, bowing walls, sagging ridgeline, uneven floors visible through windows
- Roof: missing/curling/cracked shingles, moss/algae growth, worn flashing, rusted vents, sagging gutters, ponding evidence
- Exterior envelope: peeling/fading paint, rotting wood, cracked siding, deteriorating mortar joints, staining, efflorescence on masonry
- Windows/doors: fogged double-pane glass (seal failure), cracked panes, rotting frames, outdated single-pane windows, worn weatherstripping visible
- Systems indicators: rust stains (failing pipes/HVAC), outdated electrical panels visible, window AC units (no central air), visible ductwork patches
- Drainage/grading: negative grading toward foundation, standing water, erosion, cracked/heaving walkways, failed retaining walls
- Age indicators: architectural style dating, original windows/doors, outdated materials (asbestos siding, aluminum wiring indicators)
- Functional obsolescence: awkward additions, mismatched materials suggesting unpermitted work, outdated design features
- External obsolescence: visible power lines, adjacent commercial properties, busy road proximity, neighboring property conditions
- Deferred maintenance: anything that suggests the owner has not invested in upkeep — this is evidence the assessor ignored
- Neighborhood decline: if visible in the photo — vacant lots, boarded windows, unmaintained properties nearby

Be specific and evidence-based. Reference exactly what you see — "visible hairline crack in foundation wall, approximately 3 feet long, running diagonally from window corner" is better than "foundation crack." Every defect you document is ammunition for the homeowner's appeal.`;
}

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

  // Fetch service type to tailor the AI prompt direction
  const { data: reportData } = await supabase
    .from('reports')
    .select('service_type')
    .eq('id', reportId)
    .single();
  const serviceType = (reportData as { service_type: string } | null)?.service_type ?? 'tax_appeal';
  const systemPrompt = buildPhotoSystemPrompt(serviceType);

  console.log(`[stage4] Analyzing ${photos.length} photos for report ${reportId} (${serviceType})`);

  // ── Analyze photos in parallel batches of 3 ──────────────────────────
  const conditionRatings: string[] = [];
  const allAnalyses: PhotoAiAnalysis[] = [];
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

        const result = await analyzePhoto(imageUrl, systemPrompt);

        if (result.error || !result.data) {
          console.warn(`[stage4] Photo analysis failed for ${photo.id}: ${result.error}`);
          return null;
        }

        const analysis = result.data as unknown as PhotoAiAnalysis;

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

        return analysis;
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        conditionRatings.push(result.value.condition_rating);
        allAnalyses.push(result.value);
      }
    }
  }

  // ── Compute overall condition ─────────────────────────────────────────
  const overallCondition = computeConditionMode(conditionRatings);

  console.log(
    `[stage4] Overall condition: ${overallCondition} from ${conditionRatings.length} photos`
  );

  // ── Compute per-defect condition adjustment ──────────────────────────
  // Instead of a blanket -5%/-10%, sum granular per-defect impacts from
  // photo evidence. This makes the adjustment proportional to documented
  // issues rather than a single overall rating.
  const allDefects: Array<{ severity: string; value_impact: string }> = [];
  for (const analysis of allAnalyses) {
    if (analysis.defects) {
      for (const d of analysis.defects) {
        allDefects.push({ severity: d.severity, value_impact: d.value_impact });
      }
    }
  }

  // Map each defect to an adjustment percentage based on severity + value_impact
  const DEFECT_ADJUSTMENT: Record<string, Record<string, number>> = {
    // severity → value_impact → adjustment %
    minor:       { low: -0.5, medium: -1.0, high: -1.5 },
    moderate:    { low: -1.0, medium: -2.0, high: -3.0 },
    significant: { low: -2.0, medium: -3.5, high: -5.0 },
  };

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
        const newConditionAdj = (comp.adjustment_pct_condition ?? 0) + cappedAdjustment;
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
