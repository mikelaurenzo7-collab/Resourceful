// ─── Stage 1: Property Data Collection ──────────────────────────────────────
// Geocodes the address, pulls property data from county API (with ATTOM
// fallback), queries FEMA flood zone, merges results, and writes to the
// property_data table.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Report, PropertyData, CountyRule } from '@/types/database';
import type { StageResult } from '../orchestrator';
import { geocodeAddress } from '@/lib/services/google-maps';
import { getPropertyDetail } from '@/lib/services/attom';
import { getPropertyByPIN } from '@/lib/services/cook-county';

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

    const response = await fetch(url.toString());
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

// ─── County Data Router ─────────────────────────────────────────────────────

async function fetchCountyData(report: Report) {
  // Try Cook County API first if we have a PIN and county matches
  if (
    report.county?.toLowerCase().includes('cook') &&
    report.state === 'IL' &&
    report.pin
  ) {
    const cookResult = await getPropertyByPIN(report.pin);
    if (cookResult.data) {
      return {
        source: 'cook_county' as const,
        data: {
          year_built: cookResult.data.yearBuilt,
          building_sqft_gross: cookResult.data.buildingSqFt,
          lot_size_sqft: cookResult.data.landSqFt,
          assessed_value: cookResult.data.totalAssessedValue,
          tax_year_in_appeal: cookResult.data.taxYear,
        },
        raw: cookResult.data as unknown as Record<string, unknown>,
      };
    }
    console.warn('[stage1] Cook County lookup failed, falling back to ATTOM');
  }

  // ATTOM fallback
  const fullAddress = [
    report.property_address,
    report.city,
    report.state,
  ]
    .filter(Boolean)
    .join(', ');

  const attomResult = await getPropertyDetail(fullAddress);
  if (attomResult.error || !attomResult.data) {
    return { source: null, data: null, raw: null, error: attomResult.error };
  }

  const d = attomResult.data;
  return {
    source: 'attom' as const,
    data: {
      year_built: d.summary.yearBuilt || null,
      building_sqft_gross: d.summary.buildingSquareFeet || null,
      lot_size_sqft: d.lot.lotSquareFeet || null,
      property_class: d.summary.propertyClass || null,
      property_class_description: d.summary.propertyClassDescription || null,
      zoning_designation: d.lot.zoning || null,
      assessed_value: d.assessment.assessedValue || null,
      tax_year_in_appeal: d.assessment.assessmentYear || null,
    },
    raw: d as unknown as Record<string, unknown>,
  };
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

  // ── Run data collection in parallel ───────────────────────────────────
  const [geocodeResult, countyData] = await Promise.all([
    geocodeAddress(fullAddress),
    fetchCountyData(report),
  ]);

  if (geocodeResult.error || !geocodeResult.data) {
    return { success: false, error: `Geocoding failed: ${geocodeResult.error}` };
  }

  const geo = geocodeResult.data;

  // Query FEMA now that we have coordinates
  const femaResult = await queryFemaFloodZone(geo.latitude, geo.longitude);

  // ── Fetch assessment ratio from county_rules ──────────────────────────
  const { data: countyRuleData } = await supabase
    .from('county_rules')
    .select('*')
    .eq('county_name', report.county ?? '')
    .eq('state_abbreviation', report.state ?? '')
    .single();
  const countyRule = countyRuleData as CountyRule | null;

  // ── Build data collection notes (anomaly flags) ───────────────────────
  const notes: string[] = [];

  if (!countyData.data) {
    notes.push('WARNING: No property data returned from any source');
  }

  if (femaResult.floodZone && !['X', 'C'].includes(femaResult.floodZone)) {
    notes.push(`FLOOD RISK: Property is in FEMA flood zone ${femaResult.floodZone}`);
  }

  if (!countyRule) {
    notes.push('WARNING: No county_rules record found — assessment ratio unknown');
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

  // ── Merge and upsert property_data ────────────────────────────────────
  const propertyDataPayload = {
    report_id: reportId,
    assessed_value: countyData.data?.assessed_value ?? null,
    assessed_value_source: (countyData.source === 'attom' ? 'attom' : 'county_api') as 'attom' | 'county_api' | null,
    building_sqft_gross: countyData.data?.building_sqft_gross ?? null,
    lot_size_sqft: countyData.data?.lot_size_sqft ?? null,
    year_built: countyData.data?.year_built ?? null,
    property_class: countyData.data?.property_class ?? null,
    property_class_description: countyData.data?.property_class_description ?? null,
    zoning_designation: countyData.data?.zoning_designation ?? null,
    tax_year_in_appeal: countyData.data?.tax_year_in_appeal ?? null,
    assessment_ratio: assessmentRatio,
    assessment_methodology: countyRule?.assessment_methodology ?? null,
    flood_zone_designation: femaResult.floodZone,
    flood_map_panel_number: femaResult.panelNumber,
    attom_raw_response: countyData.source === 'attom' ? (countyData.raw as Record<string, unknown>) : null,
    county_assessor_raw_response: countyData.source === 'cook_county' ? (countyData.raw as Record<string, unknown>) : null,
    fema_raw_response: femaResult as unknown as Record<string, unknown>,
    data_collection_notes: notes.length > 0 ? notes.join('\n') : null,
  };

  // Update report with geocode coordinates
  await supabase
    .from('reports')
    .update({
      latitude: geo.latitude,
      longitude: geo.longitude,
      county_fips: countyRule?.county_fips ?? null,
    })
    .eq('id', reportId);

  // Check if property_data row already exists for this report
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
    `[stage1] Data collection complete. Source: ${countyData.source ?? 'none'}. Notes: ${notes.length} flags.`
  );

  return { success: true };
}
