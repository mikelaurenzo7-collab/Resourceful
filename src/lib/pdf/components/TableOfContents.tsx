// ─── Table of Contents ───────────────────────────────────────────────────────
// Derived from the actual case profile and evidence inventory.

import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { getAssignmentDisplayLabel } from '@/lib/assignments/routing';
import { formatDate } from '@/lib/templates/helpers';
import { buildReportProfile } from '../report-profile';
import { PageFooter } from './shared';

interface TocEntry {
  number: string;
  title: string;
  detail?: string;
}

const SPECIAL_NARRATIVE_KEYS = new Set([
  'summary_of_salient_facts',
  'executive_summary',
  'assignment_and_scope',
  'reconciliation_narrative',
  'hearing_script',
  'certification_and_limiting_conditions',
]);

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

export default function TableOfContents({ data }: { data: ReportTemplateData }) {
  const { property, comparableSales, report, photos, filingGuide } = data;
  const profile = buildReportProfile(data);
  const assignmentLabel = getAssignmentDisplayLabel(report.service_type, report.desired_outcome);
  const hasMaps = Boolean(data.maps.regional?.url || data.maps.neighborhood?.url || data.maps.parcel?.url);
  const photoCount = photos.filter((photo) => Boolean(photo.storage_path)).length;
  const hasPhotoDefects = photos.some((photo) => (photo.ai_analysis?.defects?.length ?? 0) > 0);
  const hasAddendumA =
    (profile.assignmentKind === 'tax_appeal' && filingGuide != null) ||
    (profile.assignmentKind === 'pre_listing' && data.narratives.some((n) => n.section_name === 'pricing_strategy_guide')) ||
    (profile.assignmentKind === 'pre_purchase' && data.narratives.some((n) => n.section_name === 'negotiation_guide')) ||
    (profile.assignmentKind === 'independent_valuation' && data.narratives.some((n) => n.section_name === 'valuation_use_guide'));
  const addendumATitle = profile.assignmentKind === 'pre_listing'
    ? 'Pricing Strategy Guide'
    : profile.assignmentKind === 'pre_purchase'
      ? 'Negotiation Strategy Guide'
      : profile.assignmentKind === 'independent_valuation'
        ? 'Valuation Use & Next-Step Guide'
        : 'Verified County Filing Instructions';

  const sections: TocEntry[] = [
    { number: '', title: 'Letter of Transmittal' },
  ];

  const hasNarrative = (key: string) => data.narratives.some(
    (narrative) => narrative.section_name === key && Boolean(narrative.content?.trim())
  );

  if (hasNarrative('summary_of_salient_facts')) {
    sections.push({ number: 'I-A', title: 'Summary of Salient Facts' });
  }
  sections.push({ number: 'I-A1', title: 'Property Identification & Valuation Facts' });
  if (hasNarrative('executive_summary')) {
    sections.push({ number: 'I-B', title: 'Executive Valuation Summary' });
  }
  if (hasMaps) {
    sections.push({ number: 'EX-1', title: 'Subject Maps & Parcel Context' });
  }
  if (photoCount > 0) {
    sections.push({
      number: 'EX-2',
      title: 'Subject Photo Exhibit',
      detail: `${photoCount} images`,
    });
  }
  if (hasNarrative('assignment_and_scope')) {
    sections.push({ number: 'II', title: 'Assignment & Scope of Work' });
  }

  for (const section of profile.narrativeSections) {
    if (SPECIAL_NARRATIVE_KEYS.has(section.key)) continue;
    sections.push({
      number: section.number,
      title: section.title,
      detail: section.required ? 'Required for this profile' : undefined,
    });
  }

  if (hasPhotoDefects) {
    sections.push({ number: 'III-G', title: 'Detailed Condition Evidence Table' });
  }
  if (comparableSales.length > 0) {
    sections.push({
      number: 'VII-B1',
      title: 'Comparable Sales Grid',
      detail: `${comparableSales.length} transactions`,
    });
    sections.push({
      number: 'VII-C1',
      title: 'Comparable Sale Evidence Profiles',
      detail: `${comparableSales.length} profiles`,
    });
  }
  if (profile.hasIncomeApproach) {
    sections.push({ number: 'VII-D1', title: 'Income Capitalization Calculation' });
  }
  if (profile.hasCostApproach) {
    sections.push({ number: 'VII-E1', title: 'Cost Approach Calculation' });
  }
  if (profile.isTaxAppeal && property.assessment_ratio != null) {
    sections.push({ number: 'VIII-A1', title: 'Assessment Level Context' });
  }
  sections.push({ number: 'VIII-B', title: 'Reconciliation & Final Value Conclusion' });

  if (hasAddendumA) {
    sections.push({ number: 'ADD-A', title: addendumATitle });
  }
  if (hasNarrative('hearing_script')) {
    sections.push({ number: 'ADD-B', title: 'Hearing / Reviewer Preparation Guide' });
  }
  sections.push({ number: 'ADD-C', title: 'Certification Boundary & Limiting Conditions' });

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

      {sections.map((entry, index) => (
        <View key={`${entry.number}-${entry.title}-${index}`} style={styles.tocRow} wrap={false}>
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
            {supportedApproaches.length > 0 ? supportedApproaches.join(', ') : 'Alternative evidence path documented in report'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Evidence Counts</Text>
          <Text style={theme.tableCell}>
            {comparableSales.length} sales · {data.comparableRentals.length} rentals · {photoCount} photos · {hasMaps ? 'maps included' : 'no maps'}
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
