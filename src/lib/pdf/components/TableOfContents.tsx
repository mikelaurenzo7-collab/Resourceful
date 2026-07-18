// ─── Table of Contents ───────────────────────────────────────────────────────
// Displays the exact ordered section plan consumed by the report renderer.

import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { getAssignmentDisplayLabel } from '@/lib/assignments/routing';
import { formatDate } from '@/lib/templates/helpers';
import {
  buildReportRenderPlan,
  type ReportRenderPlan,
} from '../report-render-plan';
import { PageFooter } from './shared';

function labelFor(number: string): string {
  if (!number) return '';
  if (number.startsWith('EX-')) return `Exhibit ${number.slice(3)}`;
  if (number.startsWith('ADD-')) return `Addendum ${number.slice(4)}`;
  return `Section ${number}`;
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function TableOfContents({
  data,
  plan,
}: {
  data: ReportTemplateData;
  plan?: ReportRenderPlan;
}) {
  const { property, comparableSales, report } = data;
  const renderPlan = plan ?? buildReportRenderPlan(data);
  const { profile, sections } = renderPlan;
  const assignmentLabel = getAssignmentDisplayLabel(report.service_type, report.desired_outcome);
  const photoCount = data.photos.filter((photo) => Boolean(photo.storage_path)).length;
  const mapCount = [data.maps.regional, data.maps.neighborhood, data.maps.parcel]
    .filter((map) => Boolean(map?.url)).length;

  const supportedApproaches = [
    profile.hasSalesApproach ? 'Sales Comparison' : null,
    profile.hasIncomeApproach ? 'Income Capitalization' : null,
    profile.hasCostApproach ? 'Cost' : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <Page size="LETTER" style={theme.page} wrap>
      <PageFooter />
      <View style={styles.header} fixed>
        <Text style={theme.headingXL}>Table of Contents & Evidence Inventory</Text>
        <View style={theme.sectionDivider} />
      </View>

      {sections.map((entry) => (
        <View key={entry.id} style={styles.tocRow} wrap={false}>
          <Text style={[styles.tocNumber, entry.number.startsWith('ADD-') ? styles.addendumLabel : {}]}>
            {labelFor(entry.number)}
          </Text>
          <View style={styles.tocDots} />
          <View style={styles.titleBlock}>
            <Text style={styles.tocTitle}>{entry.title}</Text>
            {entry.detail && <Text style={styles.tocDetail}>{entry.detail}</Text>}
          </View>
        </View>
      ))}

      <View style={styles.metaBlock} wrap={false}>
        <Text style={styles.metaHeading}>Assignment Control</Text>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Document Profile</Text>
          <Text style={theme.tableCell}>{profile.id}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Assignment</Text>
          <Text style={theme.tableCell}>{assignmentLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Property</Text>
          <Text style={theme.tableCell}>
            {[report.property_address, report.city, report.state].filter(Boolean).join(', ')}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Property Type</Text>
          <Text style={theme.tableCell}>
            {property.property_class_description ?? property.property_subtype ?? titleCase(report.property_type)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Valuation Date</Text>
          <Text style={theme.tableCell}>{formatDate(data.valuationDate)}</Text>
        </View>
        {profile.isTaxAppeal && property.tax_year_in_appeal != null && (
          <View style={styles.metaRow}>
            <Text style={theme.label}>Assessment Year</Text>
            <Text style={theme.tableCell}>{property.tax_year_in_appeal}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={theme.label}>Supported Approaches</Text>
          <Text style={theme.tableCell}>
            {supportedApproaches.length > 0
              ? supportedApproaches.join(', ')
              : 'Alternative evidence path documented in report'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Evidence Counts</Text>
          <Text style={theme.tableCell}>
            {comparableSales.length} sales · {data.comparableRentals.length} rentals · {photoCount} photos · {mapCount} maps
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Report ID</Text>
          <Text style={theme.tableCell}>{report.id}</Text>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 14,
    backgroundColor: colors.background,
  },
  tocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tocNumber: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 8.5,
    color: colors.inkMuted,
    width: 76,
  },
  addendumLabel: {
    color: colors.accent,
    fontWeight: 600,
  },
  tocDots: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    borderStyle: 'dotted',
    marginHorizontal: 8,
    height: 8,
  },
  titleBlock: {
    width: 270,
  },
  tocTitle: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 9.5,
    color: colors.inkPrimary,
  },
  tocDetail: {
    fontFamily: 'Inter',
    fontSize: 6.5,
    color: colors.inkMuted,
    marginTop: 1,
  },
  metaBlock: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.accent,
  },
  metaHeading: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.inkPrimary,
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    gap: 12,
  },
});
