// ─── Stage 1: Property Data Collection ──────────────────────────────────────
// Geocodes the address, determines the correct county via ATTOM + geocode,
// looks up county_rules by FIPS code (authoritative), queries FEMA flood zone,
// merges results, and writes to the property_data table.
//
// COUNTY ROUTING IS CRITICAL: The county_fips determined here drives every
// downstream stage (narratives, filing guide, delivery). We use multiple
// sources to ensure we identify the correct county:
//   1. ATTOM property detail → location.countyFips (most reliable)
//   2. Google Geocode → county name
//   3. User-provided county_fips (if set at intake)
//   4. User-provided county + state (fallback for county_rules lookup)
//
// ATTOM is the universal data source — covers every county in every state.
// County-specific assessor API adapters can be added via county_rules.assessor_api_url
// but are never required. See data-router.ts for the adapter pattern.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData, CountyRule } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { geocodeAddress } from '@/lib/services/google-maps';
import { getPropertyDetail } from '@/lib/services/attom';

// ─── FEMA Flood Zone API ────────────────────────────────────────────────────

interface FemaFloodResult {
  floodZone: string | null;
  panelNumber: string | null;
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
      console.warn(`[stage1] FEMA API returned ${response.status}`);
      return { floodZone: null, panelNumber: null };
    }

    const json = (await response.json()) as any;
    const feature = json.features?.[0]?.attributes;

    return {
      floodZone: feature?.FLD_ZONE ?? null,
      panelNumber: feature?.FIRM_PAN ?? null,
    };
  } catch (err) {
    console.warn(`[stage1] FEMA flood zone query failed: ${err}`);
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
      .single();
    if (data) return data as CountyRule;
  }

  // Strategy 2: County name + state (fallback — case-insensitive)
  if (countyName && state) {
    // Try exact match first
    const { data: exact } = await supabase
      .from('county_rules')
      .select('*')
      .eq('state_abbreviation', state.toUpperCase())
      .ilike('county_name', countyName)
      .single();
    if (exact) return exact as CountyRule;

    // Try partial match (handles "X County" matching "X", etc.)
    const stripped = countyName.replace(/\s*(county|parish|borough)\s*/i, '').trim();
    if (stripped) {
      const { data: partial } = await supabase
        .from('county_rules')
        .select('*')
        .eq('state_abbreviation', state.toUpperCase())
        .ilike('county_name', `%${stripped}%`)
        .limit(1)
        .single();
      if (partial) return partial as CountyRule;
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

  // ── Geocode (always needed) + ATTOM (skip assessment lookup if tax bill) ─
  // When the user uploaded a tax bill, we already have their assessed value
  // and tax amount — no need to call ATTOM for that data. We still call ATTOM
  // for building details, comps, and location info unless we can skip it.
  const hasTaxBill = !!report.has_tax_bill && !!report.tax_bill_assessed_value;

  const [geocodeResult, attomResult] = await Promise.all([
    geocodeAddress(fullAddress),
    getPropertyDetail(fullAddress),
  ]);

  if (geocodeResult.error || !geocodeResult.data) {
    return { success: false, error: `Geocoding failed: ${geocodeResult.error}` };
  }

  // ATTOM is still needed for building details and comps even with a tax bill,
  // but if it fails and we have tax bill data, we can continue with partial data.
  if (attomResult.error || !attomResult.data) {
    if (!hasTaxBill) {
      return { success: false, error: `ATTOM property lookup failed: ${attomResult.error}` };
    }
    console.warn(
      `[stage1] ATTOM lookup failed but tax bill data available — continuing with partial data`
    );
  }

  const geo = geocodeResult.data;
  const attom = attomResult.data;

  // ── Determine county FIPS (the authoritative county identifier) ────────
  // Priority: ATTOM location > user-provided FIPS > geocode county name
  // ATTOM FIPS is most reliable because it comes from verified property records.
  const attomFips = attom?.location.countyFips || null;
  const resolvedFips = attomFips || report.county_fips || null;
  const resolvedCountyName = attom?.location.countyName || geo.county || report.county;
  const resolvedState = geo.state || report.state;

  console.log(
    `[stage1] County resolution: fips=${resolvedFips}, county="${resolvedCountyName}", state=${resolvedState} ` +
    `(sources: attom_fips=${attomFips}, user_fips=${report.county_fips}, geocode_county=${geo.county})`
  );

  // ── Look up county_rules ───────────────────────────────────────────────
  const countyRule = await findCountyRule(supabase, resolvedFips, resolvedCountyName, resolvedState);

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

  const propertyDataPayload = {
    report_id: reportId,
    assessed_value: (hasTaxBill && taxBillAssessed)
      ? taxBillAssessed
      : (attom?.assessment.assessedValue || null),
    assessed_value_source: (hasTaxBill ? 'tax_bill' : 'attom') as string,
    building_sqft_gross: attom?.summary.buildingSquareFeet || null,
    building_sqft_living_area: attom?.summary.livingSquareFeet || null,
    lot_size_sqft: attom?.lot.lotSquareFeet || null,
    year_built: attom?.summary.yearBuilt || null,
    property_class: attom?.summary.propertyClass || null,
    property_class_description: attom?.summary.propertyClassDescription || null,
    zoning_designation: attom?.lot.zoning || null,
    tax_year_in_appeal: (hasTaxBill && taxBillTaxYear)
      ? parseInt(taxBillTaxYear, 10) || null
      : (attom?.assessment.assessmentYear || null),
    assessment_ratio: assessmentRatio,
    assessment_methodology: countyRule?.assessment_methodology ?? null,
    flood_zone_designation: femaResult.floodZone,
    flood_map_panel_number: femaResult.panelNumber,
    attom_raw_response: attom as unknown as Record<string, unknown>,
    county_assessor_raw_response: null,
    fema_raw_response: femaResult as unknown as Record<string, unknown>,
    data_collection_notes: notes.length > 0 ? notes.join('\n') : null,
  };

  if (hasTaxBill) {
    notes.push(
      `TAX BILL DATA: User provided assessed value ($${taxBillAssessed}) ` +
      `${taxBillTaxAmount ? `and tax amount ($${taxBillTaxAmount})` : ''} ` +
      `${taxBillTaxYear ? `for tax year ${taxBillTaxYear}` : ''}. ` +
      `Using tax bill as primary assessment source.`
    );
  }

  // ── Update report with geocode coordinates + resolved county FIPS ──────
  // IMPORTANT: Only write county_fips if we actually resolved one.
  // Never overwrite a valid user-provided FIPS with null.
  const reportUpdate: Record<string, unknown> = {
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
      .insert(propertyDataPayload as any);

    if (insertError) {
      return { success: false, error: `Failed to insert property_data: ${insertError.message}` };
    }
  }

  console.log(
    `[stage1] Data collection complete for report ${reportId}. ` +
    `County: ${countyRule?.county_name ?? resolvedCountyName ?? 'unknown'} (${resolvedFips ?? 'no FIPS'}). ` +
    `Notes: ${notes.length} flags.`
  );

  return { success: true };
}
