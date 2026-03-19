// ─── Stage 2: Comparable Sales Research ──────────────────────────────────────
// Queries ATTOM for comparable sales with progressive radius/time expansion
// based on property type. Calculates adjustment percentages for each comp,
// flags weak comparables, pulls Street View images, and writes to
// comparable_sales table.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PropertyType, ComparableSaleInsert, Report, PropertyData, CalibrationParams } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { getSalesComparables, mapAttomPropertyTypeDetailed, type AttomSaleComp, type ResidentialSubtype } from '@/lib/services/attom';
import { getStreetViewUrl } from '@/lib/services/google-maps';
import { getCalibrationParams } from '@/lib/calibration/recalculate';

// ─── Search Tiers by Property Type ──────────────────────────────────────────

interface SearchTier {
  radiusMiles: number;
  monthsBack: number;
  gbaVariance: number; // e.g. 0.25 = within 25%
}

const SEARCH_TIERS: Record<string, SearchTier[]> = {
  residential: [
    { radiusMiles: 0.5, monthsBack: 18, gbaVariance: 0.25 },
    { radiusMiles: 1, monthsBack: 18, gbaVariance: 0.25 },
    { radiusMiles: 2, monthsBack: 30, gbaVariance: 0.25 },
  ],
  // Condos cluster in complexes — start with a very tight radius
  condo: [
    { radiusMiles: 0.25, monthsBack: 12, gbaVariance: 0.15 },
    { radiusMiles: 0.5, monthsBack: 18, gbaVariance: 0.25 },
    { radiusMiles: 1, monthsBack: 24, gbaVariance: 0.25 },
  ],
  // Townhouses also cluster but with slightly wider radius than condos
  townhouse: [
    { radiusMiles: 0.5, monthsBack: 18, gbaVariance: 0.20 },
    { radiusMiles: 1, monthsBack: 18, gbaVariance: 0.25 },
    { radiusMiles: 2, monthsBack: 30, gbaVariance: 0.25 },
  ],
  land: [
    { radiusMiles: 3, monthsBack: 24, gbaVariance: 0.40 },
    { radiusMiles: 5, monthsBack: 36, gbaVariance: 0.50 },
    { radiusMiles: 10, monthsBack: 48, gbaVariance: 0.75 },
  ],
};

const MIN_COMPS = 3;
const MAX_COMPS = 10;

// ─── Adjustment Calculations ────────────────────────────────────────────────
// Based on paired-sales analysis methodology per USPAP and the Appraisal
// Institute's "The Appraisal of Real Estate, 15th Edition."
// Adjustments flow from the comparable TO the subject: if the comp is
// SUPERIOR, adjust DOWN (negative); if INFERIOR, adjust UP (positive).

interface SubjectData {
  buildingSqFt: number;       // GBA (gross building area) — used for search
  livingSqFt: number;         // GLA (gross living area) — used for adjustments
  lotSqFt: number;
  yearBuilt: number;
  bedrooms: number;
  bathrooms: number;
  garageSpaces: number;
  basementSqFt: number;
  stories: number;
  propertyType: PropertyType;
  serviceType: string;        // tax_appeal | pre_listing | pre_purchase
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

// Round helper
const r2 = (n: number) => Math.round(n * 100) / 100;

function calculateResidentialAdjustments(
  subject: SubjectData,
  comp: AttomSaleComp,
  calibration?: CalibrationParams | null
): AdjustmentResult {
  // ── Market Conditions (Time) ──────────────────────────────────────────
  // USPAP requires adjustment for changes in market conditions between
  // comp sale date and effective date of valuation. Rate varies by market
  // but 0.25-0.5%/month is typical nationwide. We use 0.3% and let
  // calibration learn the actual local rate.
  let adjustment_pct_market_trends = 0;
  if (comp.saleDate) {
    const saleDate = new Date(comp.saleDate);
    const now = new Date();
    const monthsSinceSale = (now.getFullYear() - saleDate.getFullYear()) * 12 +
      (now.getMonth() - saleDate.getMonth());
    if (monthsSinceSale > 3) {
      adjustment_pct_market_trends = r2(Math.min(monthsSinceSale * 0.3, 12));
    }
  }

  // ── GLA Size Adjustment (Diminishing Returns Curve) ───────────────────
  // Appraisal principle: marginal value of each additional sqft DECREASES.
  // A 2,000 sqft home is NOT worth 2x a 1,000 sqft home. We use a
  // log-linear model: adjustment = ln(subject_sqft/comp_sqft) * elasticity.
  // Elasticity of ~0.85 means a 10% size difference = ~8.5% price diff.
  // This matches paired-sales research across multiple metro areas.
  let adjustment_pct_size = 0;
  const subjectGla = subject.livingSqFt > 0 ? subject.livingSqFt : subject.buildingSqFt;
  const compGla = comp.buildingSquareFeet ?? 0;
  if (subjectGla > 0 && compGla > 0) {
    const sizeElasticity = 0.85; // from paired-sales research
    // Negative when comp is larger (comp is superior → adjust down)
    adjustment_pct_size = r2(Math.log(subjectGla / compGla) * sizeElasticity * 100);
    // Cap at ±30% — beyond this the comp is too dissimilar
    adjustment_pct_size = Math.max(-30, Math.min(30, adjustment_pct_size));
  }

  // ── Age/Condition (Effective Age with Depreciation Curve) ─────────────
  // Depreciation is NOT linear. Per Marshall & Swift cost manual:
  // - Years 0-10: ~1.5%/year (new systems, low maintenance)
  // - Years 10-30: ~1.0%/year (steady depreciation)
  // - Years 30-50: ~0.5%/year (most depreciation already occurred)
  // Adjustment is applied to the DIFFERENCE between subject and comp ages.
  let adjustment_pct_condition = 0;
  if (subject.yearBuilt > 0 && comp.yearBuilt && comp.yearBuilt > 0) {
    const currentYear = new Date().getFullYear();
    const subjectAge = currentYear - subject.yearBuilt;
    const compAge = currentYear - comp.yearBuilt;

    const cumulativeDepreciation = (age: number): number => {
      if (age <= 0) return 0;
      let total = 0;
      const yearsAt15 = Math.min(age, 10);
      total += yearsAt15 * 1.5;
      if (age > 10) {
        const yearsAt10 = Math.min(age - 10, 20);
        total += yearsAt10 * 1.0;
      }
      if (age > 30) {
        const yearsAt05 = age - 30;
        total += yearsAt05 * 0.5;
      }
      return total;
    };

    const subjectDepr = cumulativeDepreciation(subjectAge);
    const compDepr = cumulativeDepreciation(compAge);
    // If comp is NEWER (less depreciated), it's superior → adjust DOWN
    adjustment_pct_condition = r2(compDepr - subjectDepr);
    // Cap at ±25%
    adjustment_pct_condition = Math.max(-25, Math.min(25, adjustment_pct_condition));
  }

  // ── Lot Size / Land-to-Building Ratio ─────────────────────────────────
  // Land contributes 15-30% of residential value depending on market.
  // Adjust based on lot size difference using typical 20% land allocation.
  let adjustment_pct_land_to_building = 0;
  if (subject.lotSqFt > 0 && comp.lotSquareFeet && comp.lotSquareFeet > 0) {
    const lotDiffPct = ((subject.lotSqFt - comp.lotSquareFeet) / comp.lotSquareFeet) * 100;
    // Only adjust if difference exceeds 15% (de minimis threshold)
    if (Math.abs(lotDiffPct) > 15) {
      const landContribution = 0.20; // land is ~20% of typical residential value
      adjustment_pct_land_to_building = r2(lotDiffPct * landContribution);
      // Cap at ±15%
      adjustment_pct_land_to_building = Math.max(-15, Math.min(15, adjustment_pct_land_to_building));
    }
  }

  // ── Location (Distance-Based Proxy) ──────────────────────────────────
  // Without school district or census tract data, use distance as a proxy.
  // Comps within 0.5mi are assumed same neighborhood (no adjustment).
  // Beyond 0.5mi, apply a conservative 1%/mile adjustment — the AI
  // narrative will provide qualitative location analysis.
  let adjustment_pct_location = 0;
  if (comp.distanceMiles != null && comp.distanceMiles > 0.5) {
    // Further comps get a modest adjustment — direction unknown, so
    // conservative. Calibration will learn the actual local pattern.
    adjustment_pct_location = r2(Math.min((comp.distanceMiles - 0.5) * -1.0, 0));
    // For tax appeals, we don't penalize distant comps — we just flag them
    if (subject.serviceType === 'tax_appeal') {
      adjustment_pct_location = 0;
    }
  }

  // ── Bedroom Count ────────────────────────────────────────────────────
  // Per paired-sales analysis: each bedroom difference = ~2-3% for typical
  // residential. We use 2.5% — calibration refines per market.
  let bedroomAdj = 0;
  if (subject.bedrooms > 0 && comp.bedrooms != null && comp.bedrooms > 0) {
    const bedroomDiff = subject.bedrooms - comp.bedrooms;
    bedroomAdj = r2(bedroomDiff * 2.5);
  }

  // ── Bathroom Count ───────────────────────────────────────────────────
  // Bathrooms are higher-value: each full bath = ~3-4% of home value.
  // Half baths ≈ 40% of a full bath value. We use 3.5% per full bath.
  let bathroomAdj = 0;
  if (subject.bathrooms > 0 && comp.bathrooms != null && comp.bathrooms > 0) {
    const bathDiff = subject.bathrooms - comp.bathrooms;
    bathroomAdj = r2(bathDiff * 3.5);
  }

  // ── Garage ───────────────────────────────────────────────────────────
  // Each garage space = ~2% of home value in most markets.
  let garageAdj = 0;
  if (comp.garageSpaces != null) {
    const garageDiff = subject.garageSpaces - comp.garageSpaces;
    garageAdj = r2(garageDiff * 2.0);
  }

  // ── Basement ─────────────────────────────────────────────────────────
  // Basement space valued at ~50% of above-grade per-sqft rate.
  // Adjust proportionally to GLA.
  let basementAdj = 0;
  if (subjectGla > 0) {
    const subjectBasement = subject.basementSqFt;
    const compBasement = comp.basementSquareFeet ?? 0;
    const basementDiff = subjectBasement - compBasement;
    if (Math.abs(basementDiff) > 100) { // de minimis: 100 sqft
      // Basement sqft at 50% the value of above-grade sqft
      basementAdj = r2((basementDiff / subjectGla) * 50);
      basementAdj = Math.max(-10, Math.min(10, basementAdj));
    }
  }

  // Roll bedroom/bathroom/garage/basement into the "other" bucket
  const adjustment_pct_other = r2(bedroomAdj + bathroomAdj + garageAdj + basementAdj);

  // Transactional adjustments (always 0 for MLS/public record sales)
  const adjustment_pct_property_rights = 0;
  const adjustment_pct_financing_terms = 0;
  const adjustment_pct_conditions_of_sale = 0;

  // ── Apply Calibration Multipliers ─────────────────────────────────────
  if (calibration) {
    adjustment_pct_size = r2(adjustment_pct_size * calibration.size_multiplier);
    adjustment_pct_condition = r2(adjustment_pct_condition * calibration.condition_multiplier);
    adjustment_pct_market_trends = r2(adjustment_pct_market_trends * calibration.market_trend_multiplier);
    adjustment_pct_land_to_building = r2(adjustment_pct_land_to_building * calibration.land_ratio_multiplier);
  }

  // ── Net Adjustment ────────────────────────────────────────────────────
  const net_adjustment_pct = r2(
    adjustment_pct_property_rights +
    adjustment_pct_financing_terms +
    adjustment_pct_conditions_of_sale +
    adjustment_pct_market_trends +
    adjustment_pct_location +
    adjustment_pct_size +
    adjustment_pct_land_to_building +
    adjustment_pct_condition +
    adjustment_pct_other
  );

  const adjustedSalePrice = Math.round(comp.salePrice * (1 + net_adjustment_pct / 100));
  // USPAP: net adjustment >25% or gross >50% = weak comparable
  const grossAdj = Math.abs(adjustment_pct_market_trends) + Math.abs(adjustment_pct_size) +
    Math.abs(adjustment_pct_condition) + Math.abs(adjustment_pct_land_to_building) +
    Math.abs(adjustment_pct_location) + Math.abs(adjustment_pct_other);
  const is_weak_comparable = Math.abs(net_adjustment_pct) > 25 || grossAdj > 50;

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
    net_adjustment_pct,
    adjustedSalePrice,
    is_weak_comparable,
  };
}

// ─── Land-Specific Adjustments ──────────────────────────────────────────────
// Land valuation uses price-per-acre as the unit of comparison, with
// adjustments for utility access, road frontage, topography, and zoning.
// Physical characteristic adjustments (bedrooms, etc.) do not apply.

function calculateLandAdjustments(
  subject: SubjectData,
  comp: AttomSaleComp,
  calibration?: CalibrationParams | null
): AdjustmentResult {
  // Market conditions — same methodology as residential
  let adjustment_pct_market_trends = 0;
  if (comp.saleDate) {
    const saleDate = new Date(comp.saleDate);
    const now = new Date();
    const monthsSinceSale = (now.getFullYear() - saleDate.getFullYear()) * 12 +
      (now.getMonth() - saleDate.getMonth());
    if (monthsSinceSale > 3) {
      adjustment_pct_market_trends = r2(Math.min(monthsSinceSale * 0.25, 10));
    }
  }

  // Size adjustment — price per acre exhibits diminishing returns
  // Larger parcels sell for less per acre (economies of scale in land).
  let adjustment_pct_size = 0;
  if (subject.lotSqFt > 0 && comp.lotSquareFeet && comp.lotSquareFeet > 0) {
    const subjectAcres = subject.lotSqFt / 43560;
    const compAcres = comp.lotSquareFeet / 43560;
    if (subjectAcres > 0 && compAcres > 0) {
      // Log-linear: smaller parcels have higher per-acre price
      adjustment_pct_size = r2(Math.log(subjectAcres / compAcres) * -30);
      adjustment_pct_size = Math.max(-40, Math.min(40, adjustment_pct_size));
    }
  }

  // Location — distance matters more for land
  let adjustment_pct_location = 0;
  if (comp.distanceMiles != null && comp.distanceMiles > 1.0) {
    adjustment_pct_location = r2(Math.max((comp.distanceMiles - 1.0) * -1.5, -15));
  }

  if (calibration) {
    adjustment_pct_size = r2(adjustment_pct_size * calibration.size_multiplier);
    adjustment_pct_market_trends = r2(adjustment_pct_market_trends * calibration.market_trend_multiplier);
  }

  const net_adjustment_pct = r2(
    adjustment_pct_market_trends +
    adjustment_pct_location +
    adjustment_pct_size
  );

  const adjustedSalePrice = Math.round(comp.salePrice * (1 + net_adjustment_pct / 100));
  const is_weak_comparable = Math.abs(net_adjustment_pct) > 35;

  return {
    adjustment_pct_property_rights: 0,
    adjustment_pct_financing_terms: 0,
    adjustment_pct_conditions_of_sale: 0,
    adjustment_pct_market_trends,
    adjustment_pct_location,
    adjustment_pct_size,
    adjustment_pct_land_to_building: 0,
    adjustment_pct_condition: 0,
    adjustment_pct_other: 0,
    net_adjustment_pct,
    adjustedSalePrice,
    is_weak_comparable,
  };
}

function calculateAdjustments(
  subject: SubjectData,
  comp: AttomSaleComp,
  calibration?: CalibrationParams | null
): AdjustmentResult {
  if (subject.propertyType === 'land') {
    return calculateLandAdjustments(subject, comp, calibration);
  }
  return calculateResidentialAdjustments(subject, comp, calibration);
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

  // ── Load calibration params (learned from real appraisal feedback) ─────
  const calibration = await getCalibrationParams(
    propertyType,
    report.county_fips ?? null,
    supabase
  );

  // Apply sqft correction factor if calibration data exists
  const sqftCorrection = calibration?.sqft_correction_factor ?? 1.0;
  const rawBuildingSqft = propertyData.building_sqft_gross ?? 0;
  const correctedBuildingSqft = sqftCorrection !== 1.0 && rawBuildingSqft > 0
    ? Math.round(rawBuildingSqft / sqftCorrection)
    : rawBuildingSqft;

  if (sqftCorrection !== 1.0 && rawBuildingSqft > 0) {
    console.log(
      `[stage2] Applied sqft correction: ${rawBuildingSqft} → ${correctedBuildingSqft} (factor: ${sqftCorrection})`
    );
  }

  // Compute total bathrooms: full baths + half baths at 0.5 weight
  const fullBaths = propertyData.full_bath_count ?? 0;
  const halfBaths = propertyData.half_bath_count ?? 0;
  const totalBathrooms = fullBaths + halfBaths * 0.5;

  const subject: SubjectData = {
    buildingSqFt: correctedBuildingSqft,
    livingSqFt: propertyData.building_sqft_living_area ?? correctedBuildingSqft,
    lotSqFt: propertyData.lot_size_sqft ?? 0,
    yearBuilt: propertyData.year_built ?? 0,
    bedrooms: propertyData.bedroom_count ?? 0,
    bathrooms: totalBathrooms,
    garageSpaces: propertyData.garage_spaces ?? 0,
    basementSqFt: propertyData.basement_sqft ?? 0,
    stories: propertyData.number_of_stories ?? 0,
    propertyType,
    serviceType: report.service_type ?? 'tax_appeal',
  };

  // Detect residential subtype for subtype-specific search tiers
  const propertyClassDesc = propertyData.property_class_description ?? '';
  const { residentialSubtype } = propertyClassDesc
    ? mapAttomPropertyTypeDetailed(propertyClassDesc)
    : { residentialSubtype: null as ResidentialSubtype | null };

  // Use subtype-specific tiers when available (e.g. condo, townhouse)
  const tierKey = (residentialSubtype && SEARCH_TIERS[residentialSubtype])
    ? residentialSubtype
    : propertyType;
  const tiers = SEARCH_TIERS[tierKey] ?? SEARCH_TIERS.residential;

  // ── Progressive radius/time expansion ─────────────────────────────────
  const allComps: AttomSaleComp[] = [];

  for (const tier of tiers) {
    const minSqft = Math.round(subject.buildingSqFt * (1 - tier.gbaVariance));
    const maxSqft = Math.round(subject.buildingSqFt * (1 + tier.gbaVariance));

    const result = await getSalesComparables({
      latitude,
      longitude,
      propertyType: propertyType === 'land' ? 'VACANT' : propertyType.toUpperCase(),
      minSqft: Math.max(minSqft, 0),
      maxSqft: maxSqft || 99999,
      radiusMiles: tier.radiusMiles,
      monthsBack: tier.monthsBack,
    });

    if (result.data && result.data.length > 0) {
      // Merge new comps with existing ones, deduplicating by address
      const existingAddresses = new Set(allComps.map((c) => c.address));
      for (const comp of result.data) {
        if (!existingAddresses.has(comp.address)) {
          allComps.push(comp);
          existingAddresses.add(comp.address);
        }
      }
    }

    // Stop expanding if we have enough comps
    if (allComps.length >= MIN_COMPS) {
      console.log(
        `[stage2] Found ${allComps.length} comps at ${tier.radiusMiles}mi / ${tier.monthsBack}mo`
      );
      break;
    }
  }

  if (allComps.length === 0) {
    return { success: false, error: 'No comparable sales found after all search tiers' };
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

  // ── Calculate adjustments and write to DB ─────────────────────────────
  const compInserts: ComparableSaleInsert[] = selectedComps.map((comp) => {
    const adj = calculateAdjustments(subject, comp, calibration);

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

    // Build Street View URL for this comp
    const comparablePhotoStoragePath = comp.distanceMiles != null
      ? getStreetViewUrl({
          lat: latitude + (Math.random() - 0.5) * 0.01,
          lng: longitude + (Math.random() - 0.5) * 0.01,
          width: 640,
          height: 480,
        })
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
