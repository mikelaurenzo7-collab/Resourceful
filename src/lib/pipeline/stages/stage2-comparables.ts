// ─── Stage 2: Comparable Sales Research ──────────────────────────────────────
// Queries ATTOM for comparable sales with progressive radius/time expansion
// based on property type. Calculates adjustment percentages for each comp,
// flags weak comparables, pulls Street View images, and writes to
// comparable_sales table.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PropertyType, ComparableSaleInsert, Report, PropertyData } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { getSalesComparables, getAssessmentEquitySnapshot, type AttomSaleComp } from '@/lib/services/attom';
import { findCompsViaWeb } from '@/lib/services/web-comps';
import { getMapillaryImageUrl, geocodeAddress } from '@/lib/services/azure-maps';
import {
  EFFECTIVE_AGE_ADJ_RATE_PER_YEAR,
  EFFECTIVE_AGE_ADJ_MAX_PCT,
  LOCATION_ADJ_BY_DISTANCE,
  LOCATION_ADJ_MAX_PCT,
  DISTRESSED_SALE_ADJ_PCT,
  MARKET_TRENDS_ADJ_PER_MONTH,
  MARKET_TRENDS_ADJ_MAX_PCT,
  SIZE_ADJ_LARGER_PER_10PCT,
  SIZE_ADJ_SMALLER_PER_10PCT,
  SIZE_ADJ_MAX_PCT,
  LAND_RATIO_THRESHOLD_PCT,
  LAND_RATIO_ADJ_MAX_PCT,
  EQUITY_SNAPSHOT_RADIUS_MILES,
  BEDROOM_ADJ_PCT_PER_UNIT,
  BEDROOM_ADJ_MAX_PCT,
  BATHROOM_ADJ_PCT_PER_UNIT,
  BATHROOM_ADJ_MAX_PCT,
  RESIDENTIAL_SUBTYPES_FOR_ROOM_ADJ,
} from '@/config/valuation';
import { getCalibrationParams, type CalibrationMultipliers } from '@/lib/repository/calibration';

// ─── Search Tiers by Property Type ──────────────────────────────────────────

interface SearchTier {
  radiusMiles: number;
  monthsBack: number;
  gbaVariance: number; // e.g. 0.25 = within 25%
}

const SEARCH_TIERS: Record<string, SearchTier[]> = {
  residential: [
    { radiusMiles: 0.5, monthsBack: 18, gbaVariance: 0.30 },
    { radiusMiles: 1,   monthsBack: 24, gbaVariance: 0.35 },
    { radiusMiles: 2,   monthsBack: 30, gbaVariance: 0.40 },
    { radiusMiles: 3,   monthsBack: 36, gbaVariance: 0.50 },
  ],
  commercial: [
    { radiusMiles: 3, monthsBack: 30, gbaVariance: 0.40 },
    { radiusMiles: 7, monthsBack: 48, gbaVariance: 0.40 },
  ],
  industrial: [
    { radiusMiles: 3, monthsBack: 30, gbaVariance: 0.40 },
    { radiusMiles: 7, monthsBack: 48, gbaVariance: 0.40 },
  ],
  land: [
    { radiusMiles: 5, monthsBack: 36, gbaVariance: 0.50 },
  ],
  agricultural: [
    { radiusMiles: 5, monthsBack: 36, gbaVariance: 0.50 },
    { radiusMiles: 10, monthsBack: 48, gbaVariance: 0.50 },
  ],
};

const MIN_COMPS = 3;
const MAX_COMPS = 10;

// ─── Adjustment Calculations ────────────────────────────────────────────────

// Distressed sale keywords — matched against ATTOM saleTransType (case-insensitive)
const DISTRESSED_KEYWORDS = [
  'foreclosure', 'reo', 'real estate owned', 'bank owned', 'short sale',
  'sheriff', 'trustee', 'distressed', 'deed in lieu',
];

function classifySaleCondition(comp: AttomSaleComp): { isDistressed: boolean; notes: string | null } {
  // ATTOM doesn't always expose saleTransType in the comp feed.
  // We check the propertyType field as a proxy when available.
  const raw = ((comp as unknown as Record<string, unknown>).saleTransType as string | undefined) ?? '';
  const lower = raw.toLowerCase();
  const isDistressed = DISTRESSED_KEYWORDS.some((kw) => lower.includes(kw));
  const notes = isDistressed ? `Non-arms-length transfer: ${raw || 'distressed indicator'}` : null;
  return { isDistressed, notes };
}

interface SubjectData {
  buildingSqFt: number;
  lotSqFt: number;
  yearBuilt: number;
  effectiveAge: number;      // from property_data.effective_age (Stage 1 baseline)
  bedrooms: number | null;   // for residential bed/bath adjustments
  bathrooms: number | null;  // full + 0.5×half baths
  propertySubtype: string | null; // controls which adjustments apply
}

interface AdjustmentResult {
  adjustment_pct_property_rights: number;
  adjustment_pct_financing_terms: number;
  adjustment_pct_conditions_of_sale: number;
  adjustment_pct_market_trends: number;
  adjustment_pct_location: number;
  adjustment_pct_size: number;
  adjustment_pct_land_to_building: number;
  adjustment_pct_condition: number;
  adjustment_pct_other: number;
  net_adjustment_pct: number;
  adjustedSalePrice: number;
  is_weak_comparable: boolean;
}

function calculateAdjustments(
  subject: SubjectData,
  comp: AttomSaleComp,
  cal: CalibrationMultipliers = { size_multiplier: 1, condition_multiplier: 1, market_trend_multiplier: 1, land_ratio_multiplier: 1, value_bias_pct: 0, sqft_correction_factor: 1, sample_count: 0 },
): AdjustmentResult {
  let adjustment_pct_size = 0;
  let adjustment_pct_condition = 0;
  let adjustment_pct_land_to_building = 0;
  const adjustment_pct_property_rights = 0;
  const adjustment_pct_financing_terms = 0;
  // Conditions of sale: distressed sales (REO, foreclosure, short sale) are
  // non-arms-length transfers. We apply a +12% upward adjustment to bring them
  // to arms-length equivalent. IAAO guidance supports +10%–+20% range.
  const { isDistressed } = classifySaleCondition(comp);
  const adjustment_pct_conditions_of_sale = isDistressed ? DISTRESSED_SALE_ADJ_PCT : 0;
  let adjustment_pct_other = 0;

  // Location adjustment: comps beyond 0.5 miles may be in different sub-markets.
  // We apply a conservative, distance-proportional adjustment using the
  // LOCATION_ADJ_BY_DISTANCE table. The AI narrative provides the qualitative
  // location analysis; this gives a defensible numeric starting point.
  let adjustment_pct_location = 0;
  if (comp.distanceMiles != null && comp.distanceMiles > 0.5) {
    const tier = LOCATION_ADJ_BY_DISTANCE.find((t) => comp.distanceMiles! <= t.maxMiles)
      ?? LOCATION_ADJ_BY_DISTANCE[LOCATION_ADJ_BY_DISTANCE.length - 1];
    // Normalise distance to a 0-1 risk score within the tier
    const distanceRisk = Math.min(comp.distanceMiles / 7, 1);
    const rawLocationAdj = -(distanceRisk * tier.adjFactor * 100);
    adjustment_pct_location = Math.round(
      Math.max(rawLocationAdj, -LOCATION_ADJ_MAX_PCT) * 100
    ) / 100;
  }

  let adjustment_pct_market_trends = 0;
  if (comp.saleDate) {
    const saleDate = new Date(comp.saleDate);
    if (!isNaN(saleDate.getTime())) {
      const now = new Date();
      const monthsSinceSale = (now.getFullYear() - saleDate.getFullYear()) * 12 +
        (now.getMonth() - saleDate.getMonth());
      if (monthsSinceSale > 6) {
        adjustment_pct_market_trends = Math.round(
          Math.min(monthsSinceSale * MARKET_TRENDS_ADJ_PER_MONTH * cal.market_trend_multiplier, MARKET_TRENDS_ADJ_MAX_PCT) * 100
        ) / 100;
      }
    }
  }

  if (subject.buildingSqFt > 0 && comp.buildingSquareFeet && comp.buildingSquareFeet > 0) {
    const sizeDiffPct = ((comp.buildingSquareFeet - subject.buildingSqFt) / subject.buildingSqFt) * 100;
    const sizeBuckets = sizeDiffPct / 10;
    if (sizeDiffPct > 0) {
      adjustment_pct_size = Math.round(Math.max(sizeBuckets * SIZE_ADJ_LARGER_PER_10PCT * cal.size_multiplier, -SIZE_ADJ_MAX_PCT) * 100) / 100;
    } else {
      adjustment_pct_size = Math.round(Math.min(Math.abs(sizeBuckets) * SIZE_ADJ_SMALLER_PER_10PCT * cal.size_multiplier, SIZE_ADJ_MAX_PCT) * 100) / 100;
    }
  }

  // Age/condition adjustment using IAAO-defensible effective age differential.
  // We use the subject's photo-adjusted effective age (from property_data) and
  // estimate the comp's effective age from its year_built (average condition assumed
  // since we have no photos for comps). Rate: 0.35% per year of effective age
  // difference, capped at ±EFFECTIVE_AGE_ADJ_MAX_PCT.
  //
  // Direction: comp effectively older than subject → comp is INFERIOR → positive
  // adjustment (comp would have sold for more in subject's superior condition).
  // Comp effectively newer → comp is SUPERIOR → negative adjustment.
  if (subject.effectiveAge > 0 && comp.yearBuilt && comp.yearBuilt > 0) {
    const currentYear = new Date().getFullYear();
    const compActualAge = currentYear - comp.yearBuilt;
    // Use comp's chronological age as its effective age (no photo evidence for comps)
    const compEffectiveAge = Math.max(compActualAge, 0);
    const effectiveAgeDiff = compEffectiveAge - subject.effectiveAge;
    const rawAdj = effectiveAgeDiff * EFFECTIVE_AGE_ADJ_RATE_PER_YEAR * cal.condition_multiplier;
    adjustment_pct_condition = Math.round(
      Math.max(Math.min(rawAdj, EFFECTIVE_AGE_ADJ_MAX_PCT), -EFFECTIVE_AGE_ADJ_MAX_PCT) * 100
    ) / 100;
  } else if (subject.yearBuilt > 0 && comp.yearBuilt && comp.yearBuilt > 0) {
    // Fallback: subject has no effective age — use chronological age difference
    const ageDiffYears = comp.yearBuilt - subject.yearBuilt;
    const rawAdj = ageDiffYears * EFFECTIVE_AGE_ADJ_RATE_PER_YEAR * cal.condition_multiplier;
    adjustment_pct_condition = Math.round(
      Math.max(Math.min(rawAdj, EFFECTIVE_AGE_ADJ_MAX_PCT), -EFFECTIVE_AGE_ADJ_MAX_PCT) * 100
    ) / 100;
  }

  // Land-to-building ratio adjustment
  if (
    subject.buildingSqFt > 0 &&
    subject.lotSqFt > 0 &&
    comp.buildingSquareFeet &&
    comp.buildingSquareFeet > 0 &&
    comp.lotSquareFeet &&
    comp.lotSquareFeet > 0
  ) {
    const subjectRatio = subject.lotSqFt / subject.buildingSqFt;
    const compRatio = comp.lotSquareFeet / comp.buildingSquareFeet;
    const ratioDiffPct = ((compRatio - subjectRatio) / subjectRatio) * 100;
    if (Math.abs(ratioDiffPct) > LAND_RATIO_THRESHOLD_PCT) {
      const rawAdj = (ratioDiffPct / LAND_RATIO_THRESHOLD_PCT) * -1 * cal.land_ratio_multiplier;
      adjustment_pct_land_to_building = Math.round(
        Math.max(Math.min(rawAdj, LAND_RATIO_ADJ_MAX_PCT), -LAND_RATIO_ADJ_MAX_PCT) * 100
      ) / 100;
    }
  }

  // Bedroom & bathroom adjustment — residential properties only.
  // Direction: (subject.feature − comp.feature) × rate
  //   Positive → subject is superior (comp had fewer) → adjust comp price UP.
  //   Negative → comp is superior (comp had more)  → adjust comp price DOWN.
  // Stored in adjustment_pct_other (only field not already allocated).
  if (
    subject.propertySubtype &&
    RESIDENTIAL_SUBTYPES_FOR_ROOM_ADJ.has(subject.propertySubtype)
  ) {
    let roomAdj = 0;
    if (subject.bedrooms != null && comp.bedrooms != null && comp.bedrooms > 0) {
      const bedDiff = subject.bedrooms - comp.bedrooms;
      const rawBedAdj = bedDiff * BEDROOM_ADJ_PCT_PER_UNIT;
      roomAdj += Math.max(Math.min(rawBedAdj, BEDROOM_ADJ_MAX_PCT), -BEDROOM_ADJ_MAX_PCT);
    }
    if (subject.bathrooms != null && comp.bathrooms != null && comp.bathrooms > 0) {
      const bathDiff = subject.bathrooms - comp.bathrooms;
      const rawBathAdj = bathDiff * BATHROOM_ADJ_PCT_PER_UNIT;
      roomAdj += Math.max(Math.min(rawBathAdj, BATHROOM_ADJ_MAX_PCT), -BATHROOM_ADJ_MAX_PCT);
    }
    adjustment_pct_other = Math.round(roomAdj * 100) / 100;
  }

  // Calculate net adjustment
  const net_adjustment_pct =
    adjustment_pct_property_rights +
    adjustment_pct_financing_terms +
    adjustment_pct_conditions_of_sale +
    adjustment_pct_market_trends +
    adjustment_pct_location +
    adjustment_pct_size +
    adjustment_pct_land_to_building +
    adjustment_pct_condition +
    adjustment_pct_other;

  const roundedNet = Math.round(net_adjustment_pct * 100) / 100;
  const adjustedSalePrice = Math.round(comp.salePrice * (1 + roundedNet / 100));

  // Flag weak comparables: net > 25% OR gross (sum of |adjustments|) > 35%.
  // Gross check catches offsetting adjustments that inflate uncertainty
  // even when the net is small (e.g. +20% size offset by -20% condition).
  const grossAdjPct =
    Math.abs(adjustment_pct_property_rights) +
    Math.abs(adjustment_pct_financing_terms) +
    Math.abs(adjustment_pct_conditions_of_sale) +
    Math.abs(adjustment_pct_market_trends) +
    Math.abs(adjustment_pct_location) +
    Math.abs(adjustment_pct_size) +
    Math.abs(adjustment_pct_land_to_building) +
    Math.abs(adjustment_pct_condition) +
    Math.abs(adjustment_pct_other);
  const is_weak_comparable = Math.abs(roundedNet) > 25 || grossAdjPct > 35;

  return {
    adjustment_pct_property_rights,
    adjustment_pct_financing_terms,
    adjustment_pct_conditions_of_sale,
    adjustment_pct_market_trends,
    adjustment_pct_location,
    adjustment_pct_size,
    adjustment_pct_land_to_building,
    adjustment_pct_condition,
    adjustment_pct_other,
    net_adjustment_pct: roundedNet,
    adjustedSalePrice,
    is_weak_comparable,
  };
}

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runComparables(
  reportId: string,
  supabase: SupabaseClient<Database>
): Promise<StageResult> {
  // ── Fetch report ──────────────────────────────────────────────────────
  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();
  const report = reportData as Report | null;

  if (reportError || !report) {
    return { success: false, error: `Failed to fetch report: ${reportError?.message}` };
  }

  // ── Fetch property data for subject characteristics ───────────────────
  const { data: pdData, error: pdError } = await supabase
    .from('property_data')
    .select('*')
    .eq('report_id', reportId)
    .single();
  const propertyData = pdData as PropertyData | null;

  if (pdError || !propertyData) {
    return { success: false, error: `No property_data found: ${pdError?.message}` };
  }

  // Use report-level lat/lng (set in stage 1)
  const latitude = report.latitude ?? 0;
  const longitude = report.longitude ?? 0;

  if (!latitude || !longitude) {
    return { success: false, error: 'No geocode coordinates found on report' };
  }

  const propertyType = report.property_type as PropertyType;

  // ── Load calibration params (learned from blind-test feedback) ────────
  const cal = await getCalibrationParams(supabase, propertyType, report.county_fips ?? null);
  if (cal.sample_count > 0) {
    console.log(`[stage2] Using calibration params (n=${cal.sample_count}) for ${propertyType}/${report.county_fips}`);
  }

  // Apply sqft correction factor from calibration (e.g. 1.04 means ATTOM overreports by 4%)
  const correctedBuildingSqFt = (propertyData.building_sqft_gross ?? 0) / cal.sqft_correction_factor;

  const subject: SubjectData = {
    buildingSqFt: correctedBuildingSqFt,
    lotSqFt: propertyData.lot_size_sqft ?? 0,
    yearBuilt: propertyData.year_built ?? 0,
    effectiveAge: propertyData.effective_age ?? (propertyData.year_built
      ? new Date().getFullYear() - propertyData.year_built
      : 0),
    bedrooms: propertyData.bedroom_count ?? null,
    // Combine full + half baths: half baths count as 0.5 (standard appraisal practice)
    bathrooms: propertyData.full_bath_count != null
      ? propertyData.full_bath_count + (propertyData.half_bath_count ?? 0) * 0.5
      : null,
    propertySubtype: propertyData.property_subtype ?? null,
  };

  const tiers = SEARCH_TIERS[propertyType] ?? SEARCH_TIERS.residential;

  // ── Progressive radius/time expansion ─────────────────────────────────
  let allComps: AttomSaleComp[] = [];

  const sqftKnown = subject.buildingSqFt > 0;

  for (const tier of tiers) {
    const minSqft = sqftKnown
      ? Math.max(Math.round(subject.buildingSqFt * (1 - tier.gbaVariance)), 0)
      : null;
    const maxSqft = sqftKnown
      ? Math.round(subject.buildingSqFt * (1 + tier.gbaVariance))
      : null;

    const result = await getSalesComparables({
      latitude,
      longitude,
      propertyType: propertyData.property_subtype ?? propertyType,
      minSqft,
      maxSqft,
      radiusMiles: tier.radiusMiles,
      monthsBack: tier.monthsBack,
    });

    if (result.data && result.data.length > 0) {
      allComps = result.data;
    }

    // Stop expanding if we have enough comps
    if (allComps.length >= MIN_COMPS) {
      console.log(
        `[stage2] Found ${allComps.length} comps at ${tier.radiusMiles}mi / ${tier.monthsBack}mo`
      );
      break;
    }
  }

  // ── No-sqft fallback ──────────────────────────────────────────────────
  // All tiers failed. Retry once with the sqft constraint removed entirely.
  // This handles properties where ATTOM's reported sqft is inaccurate, or
  // where the local market has few sales of similar size but many that are
  // nearby and otherwise comparable (e.g. mixed condo sizes in a building).
  if (allComps.length === 0 && sqftKnown) {
    console.warn(`[stage2] All sqft-filtered tiers returned 0 comps — retrying without size constraint`);
    const noSizeResult = await getSalesComparables({
      latitude,
      longitude,
      propertyType: propertyData.property_subtype ?? propertyType,
      minSqft: null,
      maxSqft: null,
      radiusMiles: 2,
      monthsBack: 36,
    });
    if (noSizeResult.data && noSizeResult.data.length > 0) {
      allComps = noSizeResult.data;
      console.log(`[stage2] No-size fallback found ${allComps.length} comps`);
    }
  }

  // ── Assessment Equity Snapshot (always runs, independent of sales comps) ──
  // Fetch nearby property assessments to build a horizontal inequity argument.
  // This runs even when 0 comparable sales exist — it's an independent strategy.
  if (latitude && longitude) {
    const equityResult = await getAssessmentEquitySnapshot(
      latitude,
      longitude,
      EQUITY_SNAPSHOT_RADIUS_MILES,
      propertyData.assessed_value,
      propertyData.building_sqft_gross
    );
    if (equityResult.data && equityResult.data.neighborCount > 0) {
      // Store equity stats inside attom_raw_response under a dedicated key
      // so stage 5 can pass them to the AI without a schema migration.
      const existing = (propertyData.attom_raw_response as Record<string, unknown> | null) ?? {};
      await supabase
        .from('property_data')
        .update({
          attom_raw_response: {
            ...existing,
            assessment_equity: {
              neighborCount: equityResult.data.neighborCount,
              subjectAssessedPerSqft: equityResult.data.subjectAssessedPerSqft,
              medianNeighborAssessedPerSqft: equityResult.data.medianNeighborAssessedPerSqft,
              equityRatioPct: equityResult.data.equityRatioPct,
              isOverAssessed: equityResult.data.isOverAssessed,
              // Only store first 20 neighbors to keep JSONB size reasonable
              neighborSample: equityResult.data.neighbors.slice(0, 20).map((n) => ({
                address: n.address,
                assessedPerSqft: n.assessedPerSqft,
                buildingSquareFeet: n.buildingSquareFeet,
                yearBuilt: n.yearBuilt,
                distanceMiles: n.distanceMiles,
              })),
            },
          },
        })
        .eq('report_id', reportId);
      console.log(
        `[stage2] Equity snapshot stored: ${equityResult.data.neighborCount} neighbors, ` +
        `subject=$${equityResult.data.subjectAssessedPerSqft}/sqft, ` +
        `median=$${equityResult.data.medianNeighborAssessedPerSqft}/sqft, ` +
        `ratio=${equityResult.data.equityRatioPct}%`
      );
    } else {
      console.log(`[stage2] No equity snapshot data (${equityResult.error ?? 'empty response'})`);
    }
  }

  if (allComps.length === 0) {
    // ── Web search fallback ────────────────────────────────────────────────
    // ATTOM found nothing — try Serper + Claude to locate comps from real
    // estate portals (Redfin, Zillow, county records). Returns [] gracefully
    // if SERPER_API_KEY is absent or no results are found.
    console.log(`[stage2] ATTOM returned 0 comps — attempting web search fallback for ${reportId}`);
    const webComps = await findCompsViaWeb({
      address: report.property_address,
      city: report.city ?? '',
      state: report.state_abbreviation ?? report.state ?? '',
      propertyType,
      buildingSqFt: subject.buildingSqFt,
    });

    if (webComps.length > 0) {
      allComps = webComps;
      console.log(`[stage2] Web fallback found ${webComps.length} comps — resuming adjustment pipeline`);
    } else {
      // Still 0 comps — graceful degradation: equity + cost approach will carry Stage 5.
      console.warn(
        `[stage2] No comparable sales from ATTOM or web search for report ${reportId}. ` +
        `Pipeline will continue with equity, cost, and/or income approach if available.`
      );
      await supabase.from('comparable_sales').delete().eq('report_id', reportId);
      return { success: true };
    }
  }

  // Limit to best comps (closest distance, most recent)
  const selectedComps = allComps.slice(0, MAX_COMPS);

  // ── Delete existing comps for this report ─────────────────────────────
  const { error: deleteError } = await supabase
    .from('comparable_sales')
    .delete()
    .eq('report_id', reportId);

  if (deleteError) {
    return { success: false, error: `Failed to delete existing comps: ${deleteError.message}` };
  }

  // ── Sort: prefer non-distressed comps when we have enough ────────────
  const nonDistressed = selectedComps.filter((c) => !classifySaleCondition(c).isDistressed);
  const distressed    = selectedComps.filter((c) =>  classifySaleCondition(c).isDistressed);
  const sortedComps   = nonDistressed.length >= MIN_COMPS
    ? [...nonDistressed, ...distressed].slice(0, MAX_COMPS)
    : selectedComps; // not enough clean comps — use all

  // ── Pre-fetch street-level imagery from Mapillary (parallel) ────────
  const mapillaryUrls = await Promise.all(
    sortedComps.map(async (comp) => {
      const compAddress = `${comp.address}, ${comp.city}, ${comp.state} ${comp.zip}`;
      const geo = await geocodeAddress(compAddress);
      if (geo.data?.latitude && geo.data?.longitude) {
        return getMapillaryImageUrl(geo.data.latitude, geo.data.longitude);
      }
      return null;
    })
  );

  // ── Calculate adjustments and write to DB ─────────────────────────────
  const compInserts: ComparableSaleInsert[] = sortedComps.map((comp, idx) => {
    const adj = calculateAdjustments(subject, comp, cal);

    const pricePerSqft = comp.buildingSquareFeet && comp.buildingSquareFeet > 0
      ? Math.round((comp.salePrice / comp.buildingSquareFeet) * 100) / 100
      : null;

    const adjustedPricePerSqft = comp.buildingSquareFeet && comp.buildingSquareFeet > 0
      ? Math.round((adj.adjustedSalePrice / comp.buildingSquareFeet) * 100) / 100
      : null;

    const landToBuildingRatio =
      comp.buildingSquareFeet && comp.buildingSquareFeet > 0 && comp.lotSquareFeet
        ? Math.round((comp.lotSquareFeet / comp.buildingSquareFeet) * 100) / 100
        : null;

    const comparablePhotoStoragePath = mapillaryUrls[idx] ?? null;

    const { isDistressed, notes: saleNotes } = classifySaleCondition(comp);
    const compActualAge = comp.yearBuilt
      ? new Date().getFullYear() - comp.yearBuilt
      : null;

    return {
      report_id: reportId,
      address: comp.address,
      sale_price: comp.salePrice,
      sale_date: comp.saleDate,
      grantor: null,
      grantee: null,
      deed_document_number: null,
      county_recorder_url: null,
      building_sqft: comp.buildingSquareFeet ?? null,
      price_per_sqft: pricePerSqft,
      year_built: comp.yearBuilt ?? null,
      property_class: comp.propertyType ?? null,
      distance_miles: comp.distanceMiles ?? null,
      lot_size_sqft: comp.lotSquareFeet ?? null,
      land_to_building_ratio: landToBuildingRatio,
      overhead_door_count: null,
      clearance_height_ft: null,
      condition_notes: null,
      is_distressed_sale: isDistressed,
      sale_condition_notes: saleNotes,
      comp_effective_age: compActualAge,
      adjustment_pct_property_rights: adj.adjustment_pct_property_rights,
      adjustment_pct_financing_terms: adj.adjustment_pct_financing_terms,
      adjustment_pct_conditions_of_sale: adj.adjustment_pct_conditions_of_sale,
      adjustment_pct_market_trends: adj.adjustment_pct_market_trends,
      adjustment_pct_location: adj.adjustment_pct_location,
      adjustment_pct_size: adj.adjustment_pct_size,
      adjustment_pct_land_to_building: adj.adjustment_pct_land_to_building,
      adjustment_pct_condition: adj.adjustment_pct_condition,
      adjustment_pct_other: adj.adjustment_pct_other,
      net_adjustment_pct: adj.net_adjustment_pct,
      adjusted_price_per_sqft: adjustedPricePerSqft,
      is_weak_comparable: adj.is_weak_comparable,
      comparable_photo_url: comparablePhotoStoragePath,
    };
  });

  const { error: insertError } = await supabase
    .from('comparable_sales')
    .insert(compInserts);

  if (insertError) {
    return { success: false, error: `Failed to insert comparable_sales: ${insertError.message}` };
  }

  const weakCount = compInserts.filter((c) => c.is_weak_comparable).length;

  console.log(
    `[stage2] Wrote ${compInserts.length} comps (${weakCount} flagged as weak) for report ${reportId}`
  );

  return { success: true };
}
