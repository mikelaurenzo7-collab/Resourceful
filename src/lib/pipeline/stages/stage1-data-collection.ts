// ─── Stage 1: Property Data Collection ──────────────────────────────────────
// Geocodes the address, determines the correct county via ATTOM + geocode,
// looks up county_rules by FIPS code (authoritative), queries FEMA flood zone,
// merges results, and writes to the property_data table.
//
// COUNTY ROUTING IS CRITICAL: The county_fips determined here drives every
// downstream stage (narratives, filing guide, delivery). We use multiple
// sources to ensure we identify the correct county:
//   1. ATTOM property detail → location.countyFips (most reliable)
//   2. Azure Maps / Census Geocode → county name
//   3. User-provided county_fips (if set at intake)
//   4. User-provided county + state (fallback for county_rules lookup)
//
// ATTOM is the universal data source — covers every county in every state.
// County-specific assessor API adapters can be added via county_rules.assessor_api_url
// but are never required. See data-router.ts for the adapter pattern.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData, PropertyDataInsert, CountyRule, ReportUpdate } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { geocodeAddress } from '@/lib/services/azure-maps';
import { collectPropertyData } from '@/lib/services/data-router';
import { needsEnrichment, enrichCounty } from '@/lib/services/county-enrichment';
import {
  resolvePropertySubtype,
  computeEffectiveAge,
  computePhysicalDepreciation,
  ECONOMIC_LIFE,
} from '@/config/valuation';
import { pipelineLogger } from '@/lib/logger';

// ─── FEMA Flood Zone API ────────────────────────────────────────────────────

interface FemaFloodResult {
  floodZone: string | null;
  panelNumber: string | null;
}

interface FemaFeatureResponse {
  features?: Array<{
    attributes?: {
      FLD_ZONE?: string | null;
      FIRM_PAN?: string | null;
    };
  }>;
}

async function queryFemaFloodZone(lat: number, lng: number): Promise<FemaFloodResult> {
  try {
    const url = new URL('https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query');
    url.searchParams.set('geometry', `${lng},${lat}`);
    url.searchParams.set('geometryType', 'esriGeometryPoint');
    url.searchParams.set('inSR', '4326');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    url.searchParams.set('outFields', 'FLD_ZONE,FIRM_PAN');
    url.searchParams.set('returnGeometry', 'false');
    url.searchParams.set('f', 'json');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      pipelineLogger.warn({ status: response.status }, '[stage1] FEMA API returned');
      return { floodZone: null, panelNumber: null };
    }

    const json = (await response.json()) as FemaFeatureResponse;
    const feature = json.features?.[0]?.attributes;

    return {
      floodZone: feature?.FLD_ZONE ?? null,
      panelNumber: feature?.FIRM_PAN ?? null,
    };
  } catch (err) {
    pipelineLogger.warn({ err }, '[stage1] FEMA flood zone query failed');
    return { floodZone: null, panelNumber: null };
  }
}

// ─── County Rules Lookup ────────────────────────────────────────────────────
// Finds the county_rules row for this property. Uses FIPS code as the primary
// key (authoritative), falls back to county name + state (fuzzy).

async function findCountyRule(
  supabase: SupabaseClient<Database>,
  fips: string | null,
  countyName: string | null,
  state: string | null
): Promise<CountyRule | null> {
  // Strategy 1: FIPS code lookup (authoritative — cannot match wrong county)
  if (fips) {
    const { data } = await supabase
      .from('county_rules')
      .select('*')
      .eq('county_fips', fips)
      .limit(1);
    if (data?.[0]) return data[0] as CountyRule;
  }

  // Strategy 2: County name + state (fallback — case-insensitive)
  if (countyName && state) {
    // Try exact match first
    const { data: exact } = await supabase
      .from('county_rules')
      .select('*')
      .eq('state_abbreviation', state.toUpperCase())
      .ilike('county_name', countyName)
      .limit(1);
    if (exact?.[0]) return exact[0] as CountyRule;

    // Try partial match (handles "X County" matching "X", etc.)
    const stripped = countyName.replace(/\s*(county|parish|borough)\s*/i, '').trim();
    if (stripped) {
      const escaped = stripped.replace(/%/g, '\\%').replace(/_/g, '\\_');
      const { data: partial } = await supabase
        .from('county_rules')
        .select('*')
        .eq('state_abbreviation', state.toUpperCase())
        .ilike('county_name', `%${escaped}%`)
        .limit(1);
      if (partial?.[0]) return partial[0] as CountyRule;
    }
  }

  return null;
}

// ─── Stage Entry Point ──────────────────────────────────────────────────────

export async function runDataCollection(
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

  const fullAddress = [
    report.property_address,
    report.city,
    report.state,
  ]
    .filter(Boolean)
    .join(', ');

  // ── Geocode + Property Data Collection ──────────────────────────────────
  // Data router tries free public records first, then ATTOM as fallback.
  // When the user uploaded a tax bill, we already have their assessed value.
  const hasTaxBill = !!report.has_tax_bill && !!report.tax_bill_assessed_value;

  // Look up county rules early so data router can use them
  const earlyCountyRule = report.county && report.state
    ? await findCountyRule(supabase, report.county_fips ?? null, report.county, report.state)
    : null;

  const [geocodeResult, dataResult] = await Promise.all([
    geocodeAddress(fullAddress),
    collectPropertyData({
      address: report.property_address,
      city: report.city ?? '',
      state: report.state ?? '',
      county: report.county ?? null,
      pin: report.pin,
      countyFips: report.county_fips ?? null,
      countyRules: earlyCountyRule,
    }),
  ]);

  if (geocodeResult.error || !geocodeResult.data) {
    return { success: false, error: `Geocoding failed: ${geocodeResult.error}` };
  }

  // Reject null island (0,0) — indicates a silent geocoding failure
  if (geocodeResult.data.latitude === 0 && geocodeResult.data.longitude === 0) {
    return { success: false, error: `Geocoding returned null island (0,0) for "${fullAddress}" — address may be invalid` };
  }

  // Data collection may return partial data — that's OK if we have tax bill
  if (dataResult.error || !dataResult.data) {
    if (!hasTaxBill) {
      return { success: false, error: `Property data collection failed: ${dataResult.error}` };
    }
    pipelineLogger.warn('[stage1] Data collection failed but tax bill data available — continuing with partial data');
  }

  const geo = geocodeResult.data;
  // Build an attom-compatible object from the collected data for downstream compatibility
  const collected = dataResult.data;
  const attom = collected ? {
    location: {
      countyFips: collected.countyFips ?? '',
      countyName: collected.countyName ?? '',
      latitude: collected.latitude ?? 0,
      longitude: collected.longitude ?? 0,
    },
    summary: {
      propertyType: collected.property_class_description ?? '',
      propertyClass: collected.property_class ?? null,
      propertyClassDescription: collected.property_class_description ?? null,
      yearBuilt: collected.year_built ?? 0,
      buildingSquareFeet: collected.building_sqft_gross ?? 0,
      livingSquareFeet: collected.building_sqft_living_area ?? null,
      lotSquareFeet: collected.lot_size_sqft ?? 0,
      bedrooms: collected.bedroom_count ?? 0,
      bathrooms: collected.full_bath_count ?? 0,
      stories: collected.number_of_stories ?? 0,
    },
    assessment: {
      assessedValue: collected.assessed_value ?? 0,
      marketValue: 0,
      landValue: 0,
      improvementValue: 0,
      assessmentYear: collected.tax_year_in_appeal ?? 0,
      taxAmount: 0,
    },
    lot: {
      lotSquareFeet: collected.lot_size_sqft ?? 0,
      zoning: collected.zoning_designation ?? null,
      legalDescription: null,
    },
  } : null;

  // ── Determine county FIPS (the authoritative county identifier) ────────
  // Priority: collected data > user-provided FIPS > geocode county name
  const collectedFips = collected?.countyFips || null;
  const resolvedFips = collectedFips || report.county_fips || null;
  const resolvedCountyName = collected?.countyName || geo.county || report.county;
  const resolvedState = geo.state || report.state;

  pipelineLogger.info(
    { fips: resolvedFips, county: resolvedCountyName, state: resolvedState, collectedFips, userFips: report.county_fips, geocodeCounty: geo.county },
    '[stage1] County resolution'
  );

  // ── Look up county_rules ───────────────────────────────────────────────
  let countyRule = await findCountyRule(supabase, resolvedFips, resolvedCountyName, resolvedState);

  // ── Auto-enrich county if data is sparse ──────────────────────────────
  // When a report comes in for a county with generic/missing data, auto-research
  // the county's appeal process using web search + AI. The enriched data persists
  // so subsequent reports get it instantly.
  if (countyRule && needsEnrichment(countyRule)) {
    pipelineLogger.info({ county_name: countyRule.county_name }, '[stage1] County needs enrichment — auto-researching...');
    const enrichResult = await enrichCounty(countyRule, supabase as never);
    if (enrichResult.enriched) {
      // Re-fetch the enriched county rule
      countyRule = await findCountyRule(supabase, resolvedFips, resolvedCountyName, resolvedState);
      pipelineLogger.info({ enrichResult: enrichResult.fieldsUpdated.join(', ') }, '[stage1] County enriched');
    }
  } else if (countyRule?.last_verified_date) {
    // ── 180-day stale data check — re-enrich if data is older than 6 months ──
    const lastVerified = new Date(countyRule.last_verified_date);
    const daysSinceVerified = Math.floor((Date.now() - lastVerified.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceVerified > 180) {
      pipelineLogger.info({ county_name: countyRule.county_name, daysSinceVerified }, '[stage1] County data is days old — re-enriching...');
      // Force re-enrichment by temporarily clearing pro_se_tips (triggers needsEnrichment)
      const enrichResult = await enrichCounty(
        { ...countyRule, pro_se_tips: null } as typeof countyRule,
        supabase as never
      );
      if (enrichResult.enriched) {
        countyRule = await findCountyRule(supabase, resolvedFips, resolvedCountyName, resolvedState);
        pipelineLogger.info({ daysSinceVerified, enrichResult: enrichResult.fieldsUpdated.join(', ') }, '[stage1] County re-enriched after days');
      }
    }
  }

  // ── Build data collection notes ────────────────────────────────────────
  const notes: string[] = [];

  if (!countyRule) {
    notes.push(
      `WARNING: No county_rules record found for fips=${resolvedFips}, ` +
      `county="${resolvedCountyName}", state=${resolvedState}. ` +
      `Filing guide and assessment ratios will use defaults.`
    );
  }

  // Query FEMA now that we have coordinates
  const femaResult = await queryFemaFloodZone(geo.latitude, geo.longitude);

  if (femaResult.floodZone && !['X', 'C'].includes(femaResult.floodZone)) {
    notes.push(`FLOOD RISK: Property is in FEMA flood zone ${femaResult.floodZone}`);
  }

  // ── Determine assessment ratio based on property type ──────────────────
  let assessmentRatio: number | null = null;
  if (countyRule) {
    switch (report.property_type) {
      case 'commercial':
        assessmentRatio = countyRule.assessment_ratio_commercial;
        break;
      case 'industrial':
        assessmentRatio = countyRule.assessment_ratio_industrial;
        break;
      default:
        assessmentRatio = countyRule.assessment_ratio_residential;
        break;
    }
  }

  // ── Build property_data — prefer tax bill values when available ────────
  const taxBillAssessed = report.tax_bill_assessed_value;
  const taxBillTaxAmount = report.tax_bill_tax_amount;
  const taxBillTaxYear = report.tax_bill_tax_year;

  if (hasTaxBill) {
    notes.push(
      `TAX BILL DATA: User provided assessed value ($${taxBillAssessed}) ` +
      `${taxBillTaxAmount ? `and tax amount ($${taxBillTaxAmount})` : ''} ` +
      `${taxBillTaxYear ? `for tax year ${taxBillTaxYear}` : ''}. ` +
      `Using tax bill as primary assessment source.`
    );
  }

  // Record data source provenance for downstream narrative framing
  if (collected?.data_source_map) {
    const sourceEntries = Object.entries(collected.data_source_map)
      .map(([field, info]) => `${field}: ${(info as { source: string; confidence: string }).source} (${(info as { source: string; confidence: string }).confidence})`)
      .join(', ');
    if (sourceEntries) {
      notes.push(`DATA PROVENANCE: ${sourceEntries}`);
    }
  }

  // ── Compute valuation intelligence fields ─────────────────────────────
  const propertySubtype = resolvePropertySubtype(
    attom?.summary.propertyClass,
    report.property_type
  );
  const yearBuilt = attom?.summary.yearBuilt || null;
  // Stage 1 baseline: assume average condition (refined by photos in Stage 4)
  const baselineEffectiveAge = computeEffectiveAge(yearBuilt, 'average');
  const baselineDepreciationPct = computePhysicalDepreciation(baselineEffectiveAge, propertySubtype);
  const economicLife = ECONOMIC_LIFE[propertySubtype] ?? 0;
  const remainingEconomicLife = economicLife > 0
    ? Math.max(economicLife - baselineEffectiveAge, 0)
    : null;

  const propertyDataPayload = {
    report_id: reportId,
    assessed_value: (hasTaxBill && taxBillAssessed)
      ? taxBillAssessed
      : (attom?.assessment.assessedValue || null),
    assessed_value_source: (hasTaxBill ? 'tax_bill' : 'attom') as string,
    building_sqft_gross: attom?.summary.buildingSquareFeet || null,
    building_sqft_living_area: attom?.summary.livingSquareFeet || null,
    lot_size_sqft: attom?.lot.lotSquareFeet || null,
    year_built: yearBuilt,
    bedroom_count: attom?.summary.bedrooms || null,
    full_bath_count: attom?.summary.bathrooms ? Math.floor(attom.summary.bathrooms) : null,
    half_bath_count: attom?.summary.bathrooms ? (attom.summary.bathrooms % 1 >= 0.5 ? 1 : 0) : null,
    number_of_stories: attom?.summary.stories || null,
    property_class: attom?.summary.propertyClass || null,
    property_class_description: attom?.summary.propertyClassDescription || null,
    zoning_designation: attom?.lot.zoning || null,
    tax_year_in_appeal: (hasTaxBill && taxBillTaxYear)
      ? ((/^\d{4}$/.test(taxBillTaxYear)) ? parseInt(taxBillTaxYear, 10) : null)
      : (attom?.assessment.assessmentYear || null),
    assessment_ratio: assessmentRatio,
    assessment_methodology: countyRule?.assessment_methodology ?? null,
    flood_zone_designation: femaResult.floodZone,
    flood_map_panel_number: femaResult.panelNumber,
    attom_raw_response: attom as unknown as Record<string, unknown>,
    county_assessor_raw_response: null,
    fema_raw_response: femaResult as unknown as Record<string, unknown>,
    data_collection_notes: notes.length > 0 ? notes.join('\n') : null,
    // Valuation intelligence (migration 009)
    property_subtype: propertySubtype,
    effective_age: baselineEffectiveAge > 0 ? baselineEffectiveAge : null,
    effective_age_source: 'year_built_baseline',
    physical_depreciation_pct: baselineEffectiveAge > 0 ? baselineDepreciationPct : null,
    remaining_economic_life: remainingEconomicLife,
    // Cost approach inputs (migration 010)
    // land_value: ATTOM splits total assessed value into land + improvement.
    // This is the assessor's land value — used as the site component in cost approach.
    land_value: attom?.assessment.landValue || null,
    // quality_grade: not exposed in ATTOM basic feed — defaults to 'average'.
    // Can be overridden via admin tools or future ATTOM premium field mapping.
    quality_grade: 'average',
    // Regrid parcel intelligence (migration 022)
    parcel_boundary_geojson: collected?.parcel_boundary_geojson ?? null,
    lot_frontage_ft: collected?.lot_frontage_ft ?? null,
    lot_depth_ft: collected?.lot_depth_ft ?? null,
    lot_shape_description: collected?.lot_shape_description ?? null,
    legal_description: collected?.legal_description ?? null,
    owner_name: collected?.owner_name ?? null,
    owner_mailing_address: collected?.owner_mailing_address ?? null,
    zoning_description: collected?.zoning_description ?? null,
    apn: collected?.apn ?? null,
    regrid_parcel_id: collected?.regrid_parcel_id ?? null,
    parcel_data_source: collected?.parcel_data_source ?? null,
  };

  // ── Update report with geocode coordinates + resolved county FIPS ──────
  // IMPORTANT: Only write county_fips if we actually resolved one.
  // Never overwrite a valid user-provided FIPS with null.
  // Guard against null island (0,0) — if geocode returned invalid coords, fail fast
  if (geo.latitude === 0 && geo.longitude === 0) {
    return { success: false, error: 'Geocoding returned invalid coordinates (0,0). Check the property address.' };
  }

  const reportUpdate: ReportUpdate = {
    latitude: geo.latitude,
    longitude: geo.longitude,
  };

  if (resolvedFips) {
    reportUpdate.county_fips = resolvedFips;
  }

  // Backfill county name from ATTOM if the user didn't provide one
  if (attom?.location.countyName && !report.county) {
    reportUpdate.county = attom.location.countyName;
  }

  const { error: geoUpdateError } = await supabase
    .from('reports')
    .update(reportUpdate)
    .eq('id', reportId);

  if (geoUpdateError) {
    return { success: false, error: `Failed to update report coordinates: ${geoUpdateError.message}` };
  }

  // ── Upsert property_data ───────────────────────────────────────────────
  const { data: existingData } = await supabase
    .from('property_data')
    .select('id')
    .eq('report_id', reportId)
    .single();
  const existing = existingData as Pick<PropertyData, 'id'> | null;

  if (existing) {
    const { error: updateError } = await supabase
      .from('property_data')
      .update(propertyDataPayload)
      .eq('id', existing.id);

    if (updateError) {
      return { success: false, error: `Failed to update property_data: ${updateError.message}` };
    }
  } else {
    const { error: insertError } = await supabase
      .from('property_data')
      .insert(propertyDataPayload as PropertyDataInsert);

    if (insertError) {
      return { success: false, error: `Failed to insert property_data: ${insertError.message}` };
    }
  }

  pipelineLogger.info(
    { reportId, county: countyRule?.county_name ?? resolvedCountyName ?? 'unknown', fips: resolvedFips, subtype: propertySubtype, effectiveAge: baselineEffectiveAge, depreciationPct: baselineDepreciationPct, noteCount: notes.length },
    '[stage1] Data collection complete'
  );

  return { success: true };
}
