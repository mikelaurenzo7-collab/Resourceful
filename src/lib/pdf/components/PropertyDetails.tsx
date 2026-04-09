// ─── Property Details (Structured Property Identification) ───────────────────
// Professional property characteristics grid — surfaces all the data fields
// that currently only appear in narrative form.

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatSqFt, formatLotSize, formatNumber } from '@/lib/templates/helpers';

interface DetailRow {
  label: string;
  value: string | null;
}

export default function PropertyDetails({ data }: { data: ReportTemplateData }) {
  const { property, report } = data;

  // ── Site Data ──────────────────────────────────────────
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
  ].filter(r => r.value != null);

  // ── Improvement Data ───────────────────────────────────
  const improvementDetails: DetailRow[] = [
    { label: 'Property Type', value: property.property_class_description ?? report.property_type ?? null },
    { label: 'Property Subtype', value: property.property_subtype },
    { label: 'Year Built', value: property.year_built ? String(property.year_built) : null },
    { label: 'Effective Age', value: property.effective_age ? `${property.effective_age} years` : null },
    { label: 'Remaining Economic Life', value: property.remaining_economic_life ? `${property.remaining_economic_life} years` : null },
    { label: 'Gross Building Area', value: property.building_sqft_gross ? formatSqFt(property.building_sqft_gross) : null },
    { label: 'Living Area', value: property.building_sqft_living_area ? formatSqFt(property.building_sqft_living_area) : null },
    { label: 'Number of Stories', value: property.number_of_stories ? String(property.number_of_stories) : null },
    { label: 'Bedrooms', value: property.bedroom_count ? String(property.bedroom_count) : null },
    { label: 'Full Baths', value: property.full_bath_count ? String(property.full_bath_count) : null },
    { label: 'Half Baths', value: property.half_bath_count ? String(property.half_bath_count) : null },
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
  ].filter(r => r.value != null);

  // ── Assessment Data ────────────────────────────────────
  const assessmentDetails: DetailRow[] = [
    { label: 'Assessed Value', value: property.assessed_value ? formatCurrency(property.assessed_value) : null },
    { label: 'Tax Year', value: property.tax_year_in_appeal ? String(property.tax_year_in_appeal) : null },
    { label: 'Assessment Ratio', value: property.assessment_ratio ? `${(property.assessment_ratio * 100).toFixed(2)}%` : null },
    { label: 'Assessment Methodology', value: property.assessment_methodology },
    { label: 'Land Value (Assessor)', value: property.land_value ? formatCurrency(property.land_value) : null },
  ].filter(r => r.value != null);

  // ── Industrial / Commercial extras ─────────────────────
  const industrialDetails: DetailRow[] = [
    { label: 'Dock Doors', value: property.dock_door_count ? String(property.dock_door_count) : null },
    { label: 'Overhead Doors', value: property.overhead_door_count ? String(property.overhead_door_count) : null },
    { label: 'Clear Height', value: property.clear_height_ft ? `${formatNumber(property.clear_height_ft)} ft` : null },
    { label: 'Sprinkler System', value: property.sprinkler_system ? 'Yes' : null },
  ].filter(r => r.value != null);

  return (
    <View>
      <View style={styles.titleRow} wrap={false}>
        <Text style={theme.headingLG}>Property Identification Summary</Text>
        <View style={theme.sectionDivider} />
      </View>

      {/* Address block */}
      <View style={styles.addressBlock} wrap={false}>
        <Text style={styles.addressText}>
          {[report.property_address, report.city, report.state].filter(Boolean).join(', ')}
        </Text>
        <Text style={[theme.caption, { marginTop: 2 }]}>
          {[
            report.county ? `${report.county} County` : null,
            report.state,
          ].filter(Boolean).join(', ')}
        </Text>
      </View>

      {/* Site Data */}
      {siteDetails.length > 0 && (
        <DetailGrid title="Site Data" rows={siteDetails} />
      )}

      {/* Improvement Data */}
      {improvementDetails.length > 0 && (
        <DetailGrid title="Improvement Data" rows={improvementDetails} />
      )}

      {/* Industrial extras */}
      {industrialDetails.length > 0 && (
        <DetailGrid title="Industrial Features" rows={industrialDetails} />
      )}

      {/* Assessment Data */}
      {assessmentDetails.length > 0 && (
        <DetailGrid title="Assessment Data" rows={assessmentDetails} />
      )}
    </View>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function DetailGrid({ title, rows }: { title: string; rows: DetailRow[] }) {
  // Render as 2-column grid for space efficiency
  const pairs: (DetailRow | null)[][] = [];
  for (let i = 0; i < rows.length; i += 2) {
    pairs.push([rows[i], rows[i + 1] ?? null]);
  }

  return (
    <View style={styles.gridSection} wrap={false}>
      <Text style={styles.gridTitle}>{title}</Text>
      {pairs.map((pair, i) => (
        <View key={i} style={[styles.gridRow, i % 2 !== 0 ? { backgroundColor: colors.rowAlt } : {}]}>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLotDimensions(property: ReportTemplateData['property']): string | null {
  if (property.lot_frontage_ft && property.lot_depth_ft) {
    return `${formatNumber(property.lot_frontage_ft)} ft × ${formatNumber(property.lot_depth_ft)} ft`;
  }
  return null;
}

function formatZoning(property: ReportTemplateData['property']): string | null {
  const parts = [
    property.zoning_designation,
    property.zoning_description,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : null;
}

function formatGarage(property: ReportTemplateData['property']): string | null {
  if (!property.garage_spaces && !property.garage_sqft) return null;
  const parts: string[] = [];
  if (property.garage_spaces) parts.push(`${property.garage_spaces}-car`);
  if (property.garage_sqft) parts.push(formatSqFt(property.garage_sqft));
  return parts.join(', ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  titleRow: {
    marginBottom: 8,
  },
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
  gridSection: {
    marginBottom: 10,
  },
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
