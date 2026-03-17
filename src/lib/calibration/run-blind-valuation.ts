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

function calculateCompAdjustments(
  subjectSqft: number,
  subjectLotSqft: number,
  subjectYearBuilt: number,
  comp: AttomSaleComp
): CompAdjustmentResult {
  let adjSize = 0;
  let adjCondition = 0;
  let adjLandRatio = 0;

  // Market trend: 0.3% per month, capped at 10%
  let adjMarketTrends = 0;
  if (comp.saleDate) {
    const saleDate = new Date(comp.saleDate);
    const now = new Date();
    const monthsSinceSale = (now.getFullYear() - saleDate.getFullYear()) * 12 +
      (now.getMonth() - saleDate.getMonth());
    if (monthsSinceSale > 6) {
      adjMarketTrends = Math.round(Math.min(monthsSinceSale * 0.3, 10) * 100) / 100;
    }
  }

  // Size: -3% per 10% larger, +5% per 10% smaller
  if (subjectSqft > 0 && comp.buildingSquareFeet && comp.buildingSquareFeet > 0) {
    const sizeDiffPct = ((comp.buildingSquareFeet - subjectSqft) / subjectSqft) * 100;
    const sizeBuckets = sizeDiffPct / 10;
    adjSize = sizeDiffPct > 0
      ? Math.round(sizeBuckets * -3 * 100) / 100
      : Math.round(Math.abs(sizeBuckets) * 5 * 100) / 100;
  }

  // Age/condition: +/-5% per decade
  if (subjectYearBuilt > 0 && comp.yearBuilt && comp.yearBuilt > 0) {
    const decadeDiff = (comp.yearBuilt - subjectYearBuilt) / 10;
    adjCondition = Math.round(decadeDiff * -5 * 100) / 100;
  }

  // Land-to-building ratio
  if (subjectSqft > 0 && subjectLotSqft > 0 &&
      comp.buildingSquareFeet && comp.buildingSquareFeet > 0 &&
      comp.lotSquareFeet && comp.lotSquareFeet > 0) {
    const subjectRatio = subjectLotSqft / subjectSqft;
    const compRatio = comp.lotSquareFeet / comp.buildingSquareFeet;
    const ratioDiffPct = ((compRatio - subjectRatio) / subjectRatio) * 100;
    if (Math.abs(ratioDiffPct) > 20) {
      adjLandRatio = Math.round((ratioDiffPct / 20) * -1 * 100) / 100;
    }
  }

  const netAdjustment = Math.round((adjSize + adjCondition + adjMarketTrends + adjLandRatio) * 100) / 100;
  const adjustedSalePrice = Math.round(comp.salePrice * (1 + netAdjustment / 100));
  const adjustedPricePerSqft = comp.buildingSquareFeet && comp.buildingSquareFeet > 0
    ? Math.round((adjustedSalePrice / comp.buildingSquareFeet) * 100) / 100
    : null;
  const isWeak = Math.abs(netAdjustment) > 25;

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
    calculateCompAdjustments(subjectSqft, subjectLotSqft, subjectYearBuilt, comp)
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
