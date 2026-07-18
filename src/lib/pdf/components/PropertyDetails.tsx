// ─── Property Details (Structured Property Identification) ───────────────────
// Professional property characteristics grid — surfaces the structured records
// while keeping raw assessment and market-value normalization distinct.

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatSqFt, formatLotSize, formatNumber } from '@/lib/templates/helpers';
import { getAssessorImpliedMarketValue } from '@/lib/dashboard/value-comparison';
import FloodZoneAndEnvironmental from './FloodZoneAndEnvironmental';
import { SectionHeader } from './shared';

interface DetailRow {
  label: string;
  value: string | null;
}

function countyDisplayName(county: string | null): string | null {
  if (!county) return null;
  const normalized = county.trim();
  return /\bcounty$/i.test(normalized) ? normalized : `${normalized} County`;
}

export default function PropertyDetails({ data }: { data: ReportTemplateData }) {
  const { property, report } = data;
  const assessorImpliedMarketValue = getAssessorImpliedMarketValue(
    property.assessed_value,
    property.assessment_ratio
  );

  const siteDetails: DetailRow[] = [
    { label: 'Parcel Number (APN)', value: property.apn ?? report.pin ?? null },
    { label: 'Owner of Record', value: property.owner_name },
    { label: 'Legal Description', value: property.legal_description },
    { label: 'Lot Size', value: property.lot_size_sqft ? formatLotSize(property.lot_size_sqft) : null },
    { label: 'Lot Dimensions', value: formatLotDimensions(property) },
    { label: 'Lot Shape', value: property.lot_shape_description },
    { label: 'Zoning', value: formatZoning(property) },
    { label: 'Zoning Conformance', value: property.zoning_conformance },
    { label: 'Flood Zone', value: property.flood_zone_designation },
    { label: 'FEMA Map Panel', value: property.flood_map_panel_number },
  ].filter((row) => row.value != null);

  const improvementDetails: DetailRow[] = [
    { label: 'Property Type', value: property.property_class_description ?? report.property_type ?? null },
    { label: 'Property Subtype', value: property.property_subtype },
    { label: 'Year Built', value: property.year_built != null ? String(property.year_built) : null },
    { label: 'Effective Age', value: property.effective_age != null ? `${property.effective_age} years` : null },
    { label: 'Remaining Economic Life', value: property.remaining_economic_life != null ? `${property.remaining_economic_life} years` : null },
    { label: 'Gross Building Area', value: property.building_sqft_gross ? formatSqFt(property.building_sqft_gross) : null },
    { label: 'Living Area', value: property.building_sqft_living_area ? formatSqFt(property.building_sqft_living_area) : null },
    { label: 'Number of Stories', value: property.number_of_stories != null ? String(property.number_of_stories) : null },
    { label: 'Bedrooms', value: property.bedroom_count != null ? String(property.bedroom_count) : null },
    { label: 'Full Baths', value: property.full_bath_count != null ? String(property.full_bath_count) : null },
    { label: 'Half Baths', value: property.half_bath_count != null ? String(property.half_bath_count) : null },
    { label: 'Basement Area', value: property.basement_sqft ? formatSqFt(property.basement_sqft) : null },
    { label: 'Basement Finished', value: property.basement_finished_sqft ? formatSqFt(property.basement_finished_sqft) : null },
    { label: 'Garage', value: formatGarage(property) },
    { label: 'Construction Type', value: property.construction_type },
    { label: 'Foundation', value: property.foundation_type },
    { label: 'Exterior Finish', value: property.exterior_finish },
    { label: 'Roof Type', value: property.roof_type },
    { label: 'HVAC', value: property.hvac_type },
    { label: 'Quality Grade', value: property.quality_grade ? capitalize(property.quality_grade) : null },
    { label: 'Overall Condition', value: property.overall_condition ? capitalize(property.overall_condition) : null },
  ].filter((row) => row.value != null);

  const assessmentDetails: DetailRow[] = [
    { label: 'Raw Assessed Value', value: property.assessed_value ? formatCurrency(property.assessed_value) : null },
    { label: 'Assessment Source', value: property.assessed_value_source },
    { label: 'Tax Year', value: property.tax_year_in_appeal != null ? String(property.tax_year_in_appeal) : null },
    { label: 'Assessment Level Applied', value: property.assessment_ratio != null ? `${(property.assessment_ratio * 100).toFixed(2)}%` : null },
    { label: 'Assessor-Implied Market Value', value: assessorImpliedMarketValue ? formatCurrency(assessorImpliedMarketValue) : null },
    { label: 'Assessment Methodology', value: property.assessment_methodology },
    { label: 'Land Value (Assessor)', value: property.land_value ? formatCurrency(property.land_value) : null },
  ].filter((row) => row.value != null);

  const industrialDetails: DetailRow[] = [
    { label: 'Dock Doors', value: property.dock_door_count != null ? String(property.dock_door_count) : null },
    { label: 'Overhead Doors', value: property.overhead_door_count != null ? String(property.overhead_door_count) : null },
    { label: 'Clear Height', value: property.clear_height_ft ? `${formatNumber(property.clear_height_ft)} ft` : null },
    { label: 'Sprinkler System', value: typeof property.sprinkler_system === 'boolean' ? (property.sprinkler_system ? 'Yes' : 'No') : null },
  ].filter((row) => row.value != null);

  return (
    <View>
      <SectionHeader number="I-A1" title="Property Identification & Valuation Facts" />

      <View style={styles.addressBlock} wrap={false}>
        <Text style={styles.addressText}>
          {[report.property_address, report.city, report.state].filter(Boolean).join(', ')}
        </Text>
        <Text style={[theme.caption, { marginTop: 2 }]}>
          {[countyDisplayName(report.county), report.state].filter(Boolean).join(', ')}
        </Text>
      </View>

      {siteDetails.length > 0 && <DetailGrid title="Site Data" rows={siteDetails} />}
      <FloodZoneAndEnvironmental data={data} />
      {improvementDetails.length > 0 && <DetailGrid title="Improvement Data" rows={improvementDetails} />}
      {industrialDetails.length > 0 && <DetailGrid title="Industrial Features" rows={industrialDetails} />}
      {assessmentDetails.length > 0 && <DetailGrid title="Assessment Data" rows={assessmentDetails} />}
    </View>
  );
}

function DetailGrid({ title, rows }: { title: string; rows: DetailRow[] }) {
  const pairs: (DetailRow | null)[][] = [];
  for (let i = 0; i < rows.length; i += 2) {
    pairs.push([rows[i], rows[i + 1] ?? null]);
  }

  return (
    <View style={styles.gridSection}>
      <Text style={styles.gridTitle} wrap={false}>{title}</Text>
      {pairs.map((pair, index) => (
        <View
          key={index}
          wrap={false}
          style={[styles.gridRow, index % 2 !== 0 ? { backgroundColor: colors.rowAlt } : {}]}
        >
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>{pair[0]!.label}</Text>
            <Text style={styles.cellValue}>{pair[0]!.value}</Text>
          </View>
          {pair[1] && (
            <View style={styles.gridCell}>
              <Text style={styles.cellLabel}>{pair[1].label}</Text>
              <Text style={styles.cellValue}>{pair[1].value}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function formatLotDimensions(property: ReportTemplateData['property']): string | null {
  if (property.lot_frontage_ft && property.lot_depth_ft) {
    return `${formatNumber(property.lot_frontage_ft)} ft × ${formatNumber(property.lot_depth_ft)} ft`;
  }
  return null;
}

function formatZoning(property: ReportTemplateData['property']): string | null {
  const parts = [property.zoning_designation, property.zoning_description].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : null;
}

function formatGarage(property: ReportTemplateData['property']): string | null {
  if (!property.garage_spaces && !property.garage_sqft) return null;
  const parts: string[] = [];
  if (property.garage_spaces) parts.push(`${property.garage_spaces}-car`);
  if (property.garage_sqft) parts.push(formatSqFt(property.garage_sqft));
  return parts.join(', ');
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  addressBlock: {
    backgroundColor: colors.calloutBg,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    marginBottom: 12,
  },
  addressText: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 12,
    color: colors.inkPrimary,
  },
  gridSection: { marginBottom: 10 },
  gridTitle: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 10,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.inkPrimary,
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  gridCell: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    gap: 6,
  },
  cellLabel: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 8.5,
    color: colors.inkMuted,
    width: 100,
  },
  cellValue: {
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 9,
    color: colors.inkPrimary,
    flex: 1,
  },
});
