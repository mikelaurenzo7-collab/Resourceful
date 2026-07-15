// ─── Summary of Salient Facts Section ──────────────────────────────────────
import React from 'react';
import { StyleSheet, Text, View } from '@react-pdf/renderer';

import { getAssignmentDisplayLabel } from '@/lib/assignments/routing';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatDate, formatSqFt } from '@/lib/templates/helpers';
import { buildValueConclusionRows } from '../section-data';
import { colors, theme } from '../styles/theme';
import { DataTable, NarrativeBlock, SectionHeader, ValueCallout } from './shared';

interface SummaryOfSalientFactsProps {
  data: ReportTemplateData;
  content?: string;
}

export default function SummaryOfSalientFacts({ data, content = '' }: SummaryOfSalientFactsProps) {
  const { report, property } = data;
  const approachRows = buildValueConclusionRows(data);
  const buildingArea = property.building_sqft_gross ?? property.building_sqft_living_area;
  const address = [report.property_address, report.city, report.state].filter(Boolean).join(', ');
  const propertyDescription =
    property.property_class_description ?? property.property_subtype ?? report.property_type;
  const assignmentLabel = getAssignmentDisplayLabel(report.service_type, report.desired_outcome);
  const descriptor = [
    report.property_type,
    property.property_subtype,
    property.property_class_description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const isMultifamily = ['multifamily', 'multi-family', 'apartment', 'duplex', 'triplex', 'fourplex']
    .some((term) => descriptor.includes(term));

  const factRows: (string | number | null)[][] = [
    ['Assignment', assignmentLabel],
    ['Property Type / Class', propertyDescription],
    ['Property Address', address],
    ['County', report.county ?? 'Not documented'],
    ['Parcel / PIN', report.pin ?? property.apn ?? 'Not documented'],
    ['Owner of Record', property.owner_name ?? 'Not documented'],
    ['Zoning', property.zoning_description ?? property.zoning_designation ?? 'Not documented'],
    ['Site Area', property.lot_size_sqft != null && property.lot_size_sqft > 0 ? formatSqFt(property.lot_size_sqft) : 'Not documented'],
    ['Building Area', buildingArea != null && buildingArea > 0 ? formatSqFt(buildingArea) : 'Not documented'],
    ['Year Built', property.year_built ?? 'Not documented'],
    ['Effective Age / Remaining Life', [
      property.effective_age != null ? `${property.effective_age} years effective age` : null,
      property.remaining_economic_life != null ? `${property.remaining_economic_life} years remaining` : null,
    ].filter(Boolean).join('; ') || 'Not documented'],
    ['Documented Condition', property.overall_condition ?? 'Not documented'],
    ['Valuation Date', formatDate(data.valuationDate)],
  ];

  return (
    <View>
      <SectionHeader number="I-A" title="Summary of Salient Facts & Valuation Findings" />

      <DataTable
        headers={['Salient Fact', 'Documented Workfile Evidence']}
        columnWidths={['34%', '66%']}
        rows={factRows}
      />

      <Text style={styles.subheading}>Valuation Findings</Text>
      {approachRows.length > 0 ? (
        <DataTable
          headers={['Approach', 'Indication', '$/SF', 'Role']}
          columnWidths={['31%', '23%', '16%', '30%']}
          numericColumns={[1, 2]}
          rows={approachRows.map((row) => [
            row.approach,
            formatCurrency(row.total),
            row.valuePerSqFt != null ? `$${row.valuePerSqFt.toFixed(2)}` : '—',
            row.role,
          ])}
        />
      ) : (
        <Text style={theme.bodyText}>
          No supported valuation-approach indication is available in the current workfile.
        </Text>
      )}

      <ValueCallout
        label={`Resourceful Concluded Market Value as of ${formatDate(data.valuationDate)}`}
        value={formatCurrency(data.concludedValue)}
        color={colors.accent}
      />

      {isMultifamily && (
        <View style={styles.warning} wrap={false}>
          <Text style={styles.warningTitle}>Unit-of-comparison boundary</Text>
          <Text style={styles.warningText}>
            This workfile does not currently carry verified structured dwelling-unit counts for both the
            subject and each comparable. Any displayed $/SF metric is an area-normalized fallback and must
            not be described as a per-unit indication. A genuine per-unit analysis requires source-labeled
            unit counts before release.
          </Text>
        </View>
      )}

      {content && (
        <View style={styles.narrative}>
          <Text style={styles.subheading}>Supporting Summary Narrative</Text>
          <NarrativeBlock content={content} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  subheading: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 9,
    color: colors.inkPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 8,
    marginBottom: 3,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.accent,
  },
  warning: {
    marginTop: 7,
    padding: 7,
    backgroundColor: colors.calloutBg,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  warningTitle: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 8,
    color: colors.inkPrimary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  warningText: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    color: colors.inkMuted,
    lineHeight: 1.35,
  },
  narrative: {
    marginTop: 2,
  },
});
