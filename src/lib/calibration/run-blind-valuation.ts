// ─── Blind Valuation Runner ──────────────────────────────────────────────────
// Runs a lightweight valuation (stages 1-2 equivalent) for calibration purposes.
// Does NOT create a report — just fetches ATTOM data, pulls comps, computes
// adjustments, and returns the concluded value with a breakdown.

import { geocodeAddress } from '@/lib/services/google-maps';
import { getPropertyDetail, getSalesComparables, type AttomSaleComp } from '@/lib/services/attom';
import type { PropertyType } from '@/types/database';

// ─── Search tiers (same as stage2) ──────────────────────────────────────────

interface SearchTier {
  radiusMiles: number;
  monthsBack: number;
  gbaVariance: number;
}

const SEARCH_TIERS: Record<string, SearchTier[]> = {
  residential: [
    { radiusMiles: 0.5, monthsBack: 18, gbaVariance: 0.25 },
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

// ─── Adjustment calculation (mirrors stage2) ────────────────────────────────

interface CompAdjustmentResult {
  address: string;
  salePrice: number;
  adjustedSalePrice: number;
  adjustedPricePerSqft: number | null;
  adjSize: number;
  adjCondition: number;
  adjMarketTrends: number;
  adjLandRatio: number;
  netAdjustment: number;
  isWeak: boolean;
}

// Round helper (mirrors stage2)
const r2 = (n: number) => Math.round(n * 100) / 100;

// Cumulative depreciation per Marshall & Swift cost manual (mirrors stage2)
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

function calculateCompAdjustments(
  subjectSqft: number,
  subjectLotSqft: number,
  subjectYearBuilt: number,
  comp: AttomSaleComp,
  propertyType: PropertyType
): CompAdjustmentResult {
  // ── Land properties use a simplified set of adjustments ──────────────
  if (propertyType === 'land') {
    return calculateLandCompAdjustments(subjectLotSqft, comp);
  }

  // ── Market Conditions (Time) — 0.3%/month after 3 months, cap 12% ──
  let adjMarketTrends = 0;
  if (comp.saleDate) {
    const saleDate = new Date(comp.saleDate);
    const now = new Date();
    const monthsSinceSale = (now.getFullYear() - saleDate.getFullYear()) * 12 +
      (now.getMonth() - saleDate.getMonth());
    if (monthsSinceSale > 3) {
      adjMarketTrends = r2(Math.min(monthsSinceSale * 0.3, 12));
    }
  }

  // ── GLA Size Adjustment (Log-linear with 0.85 elasticity) ───────────
  let adjSize = 0;
  const compGla = comp.buildingSquareFeet ?? 0;
  if (subjectSqft > 0 && compGla > 0) {
    adjSize = r2(Math.log(subjectSqft / compGla) * 0.85 * 100);
    adjSize = Math.max(-30, Math.min(30, adjSize));
  }

  // ── Age/Condition (Marshall & Swift non-linear depreciation) ────────
  let adjCondition = 0;
  if (subjectYearBuilt > 0 && comp.yearBuilt && comp.yearBuilt > 0) {
    const currentYear = new Date().getFullYear();
    const subjectAge = currentYear - subjectYearBuilt;
    const compAge = currentYear - comp.yearBuilt;
    const subjectDepr = cumulativeDepreciation(subjectAge);
    const compDepr = cumulativeDepreciation(compAge);
    adjCondition = r2(compDepr - subjectDepr);
    adjCondition = Math.max(-25, Math.min(25, adjCondition));
  }

  // ── Lot Size (20% land contribution, 15% de minimis threshold) ─────
  let adjLandRatio = 0;
  if (subjectLotSqft > 0 && comp.lotSquareFeet && comp.lotSquareFeet > 0) {
    const lotDiffPct = ((subjectLotSqft - comp.lotSquareFeet) / comp.lotSquareFeet) * 100;
    if (Math.abs(lotDiffPct) > 15) {
      adjLandRatio = r2(lotDiffPct * 0.20);
      adjLandRatio = Math.max(-15, Math.min(15, adjLandRatio));
    }
  }

  const netAdjustment = r2(adjSize + adjCondition + adjMarketTrends + adjLandRatio);
  const adjustedSalePrice = Math.round(comp.salePrice * (1 + netAdjustment / 100));
  const adjustedPricePerSqft = comp.buildingSquareFeet && comp.buildingSquareFeet > 0
    ? Math.round((adjustedSalePrice / comp.buildingSquareFeet) * 100) / 100
    : null;

  // USPAP weak comparable test: net >25% OR gross >50%
  const grossAdj = Math.abs(adjMarketTrends) + Math.abs(adjSize) +
    Math.abs(adjCondition) + Math.abs(adjLandRatio);
  const isWeak = Math.abs(netAdjustment) > 25 || grossAdj > 50;

  return {
    address: comp.address,
    salePrice: comp.salePrice,
    adjustedSalePrice,
    adjustedPricePerSqft,
    adjSize,
    adjCondition,
    adjMarketTrends,
    adjLandRatio,
    netAdjustment,
    isWeak,
  };
}

// Land-specific adjustments (mirrors stage2 calculateLandAdjustments)
function calculateLandCompAdjustments(
  subjectLotSqft: number,
  comp: AttomSaleComp
): CompAdjustmentResult {
  let adjMarketTrends = 0;
  if (comp.saleDate) {
    const saleDate = new Date(comp.saleDate);
    const now = new Date();
    const monthsSinceSale = (now.getFullYear() - saleDate.getFullYear()) * 12 +
      (now.getMonth() - saleDate.getMonth());
    if (monthsSinceSale > 3) {
      adjMarketTrends = r2(Math.min(monthsSinceSale * 0.25, 10));
    }
  }

  let adjSize = 0;
  if (subjectLotSqft > 0 && comp.lotSquareFeet && comp.lotSquareFeet > 0) {
    const subjectAcres = subjectLotSqft / 43560;
    const compAcres = comp.lotSquareFeet / 43560;
    if (subjectAcres > 0 && compAcres > 0) {
      adjSize = r2(Math.log(subjectAcres / compAcres) * -30);
      adjSize = Math.max(-40, Math.min(40, adjSize));
    }
  }

  let adjLocation = 0;
  if (comp.distanceMiles != null && comp.distanceMiles > 1.0) {
    adjLocation = r2(Math.max((comp.distanceMiles - 1.0) * -1.5, -15));
  }

  const netAdjustment = r2(adjMarketTrends + adjSize + adjLocation);
  const adjustedSalePrice = Math.round(comp.salePrice * (1 + netAdjustment / 100));
  const isWeak = Math.abs(netAdjustment) > 35;

  return {
    address: comp.address,
    salePrice: comp.salePrice,
    adjustedSalePrice,
    adjustedPricePerSqft: null, // land uses price-per-acre, not per-sqft
    adjSize,
    adjCondition: 0,
    adjMarketTrends,
    adjLandRatio: adjLocation, // reuse field for location adj
    netAdjustment,
    isWeak,
  };
}

// ─── Main entry point ───────────────────────────────────────────────────────

export interface BlindValuationResult {
  success: true;
  concludedValue: number;
  compCount: number;
  medianAdjustedPsf: number | null;
  comps: CompAdjustmentResult[];
  // Averages for calibration storage
  avgAdjSize: number;
  avgAdjCondition: number;
  avgAdjMarketTrends: number;
  avgAdjLandRatio: number;
  avgNetAdjustment: number;
  // Property info from ATTOM
  attomBuildingSqft: number | null;
  attomLotSqft: number | null;
  yearBuilt: number | null;
  city: string | null;
  state: string | null;
  county: string | null;
  countyFips: string | null;
}

export interface BlindValuationError {
  success: false;
  error: string;
}

export async function runBlindValuation(
  address: string,
  propertyType: PropertyType
): Promise<BlindValuationResult | BlindValuationError> {
  // Step 1: Geocode
  const geoResult = await geocodeAddress(address);
  if (geoResult.error || !geoResult.data) {
    return { success: false, error: `Geocoding failed: ${geoResult.error ?? 'no data'}` };
  }

  const geo = geoResult.data;

  // Step 2: Get property detail from ATTOM
  const attomResult = await getPropertyDetail(address);
  if (attomResult.error || !attomResult.data) {
    return { success: false, error: `ATTOM property lookup failed: ${attomResult.error ?? 'no data'}` };
  }

  const attom = attomResult.data;
  const subjectSqft = attom.summary.buildingSquareFeet || 0;
  const subjectLotSqft = attom.summary.lotSquareFeet || 0;
  const subjectYearBuilt = attom.summary.yearBuilt || 0;

  // Step 3: Search for comparable sales (progressive tiers)
  const tiers = SEARCH_TIERS[propertyType] ?? SEARCH_TIERS.residential;
  let allComps: AttomSaleComp[] = [];

  for (const tier of tiers) {
    const minSqft = Math.round(subjectSqft * (1 - tier.gbaVariance));
    const maxSqft = Math.round(subjectSqft * (1 + tier.gbaVariance));

    const result = await getSalesComparables({
      latitude: geo.latitude,
      longitude: geo.longitude,
      propertyType: propertyType === 'land' ? 'VACANT' : propertyType.toUpperCase(),
      minSqft: Math.max(minSqft, 0),
      maxSqft: maxSqft || 99999,
      radiusMiles: tier.radiusMiles,
      monthsBack: tier.monthsBack,
    });

    if (result.data && result.data.length > 0) {
      allComps = result.data;
    }

    if (allComps.length >= MIN_COMPS) break;
  }

  if (allComps.length === 0) {
    return { success: false, error: 'No comparable sales found after all search tiers' };
  }

  const selectedComps = allComps.slice(0, MAX_COMPS);

  // Step 4: Calculate adjustments for each comp
  const compResults = selectedComps.map(comp =>
    calculateCompAdjustments(subjectSqft, subjectLotSqft, subjectYearBuilt, comp, propertyType)
  );

  // Step 5: Compute concluded value (median adjusted $/sqft * subject sqft)
  const adjustedPsfs = compResults
    .map(c => c.adjustedPricePerSqft)
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b);

  let concludedValue = 0;
  let medianAdjustedPsf: number | null = null;

  if (adjustedPsfs.length > 0 && subjectSqft > 0) {
    const mid = Math.floor(adjustedPsfs.length / 2);
    medianAdjustedPsf = adjustedPsfs.length % 2 === 0
      ? (adjustedPsfs[mid - 1] + adjustedPsfs[mid]) / 2
      : adjustedPsfs[mid];
    concludedValue = Math.round(medianAdjustedPsf * subjectSqft);
  } else {
    // Fallback: median sale price
    const salePrices = compResults.map(c => c.salePrice).sort((a, b) => a - b);
    if (salePrices.length > 0) {
      const mid = Math.floor(salePrices.length / 2);
      concludedValue = salePrices.length % 2 === 0
        ? Math.round((salePrices[mid - 1] + salePrices[mid]) / 2)
        : salePrices[mid];
    }
  }

  // Round to nearest $1,000
  concludedValue = Math.round(concludedValue / 1000) * 1000;

  // Compute averages for calibration storage
  const avg = (vals: number[]) => vals.length > 0
    ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
    : 0;

  return {
    success: true,
    concludedValue,
    compCount: compResults.length,
    medianAdjustedPsf,
    comps: compResults,
    avgAdjSize: avg(compResults.map(c => c.adjSize)),
    avgAdjCondition: avg(compResults.map(c => c.adjCondition)),
    avgAdjMarketTrends: avg(compResults.map(c => c.adjMarketTrends)),
    avgAdjLandRatio: avg(compResults.map(c => c.adjLandRatio)),
    avgNetAdjustment: avg(compResults.map(c => c.netAdjustment)),
    attomBuildingSqft: attom.summary.buildingSquareFeet || null,
    attomLotSqft: attom.summary.lotSquareFeet || null,
    yearBuilt: attom.summary.yearBuilt || null,
    city: attom.address.locality || null,
    state: attom.address.countrySubd || null,
    county: attom.location.countyName || null,
    countyFips: attom.location.countyFips || null,
  };
}
