// ─── Table of Contents ───────────────────────────────────────────────────────
// Dynamic TOC that lists all sections included in the report.

import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';

interface TocEntry {
  number: string;
  title: string;
  indent?: boolean;
}

export default function TableOfContents({ data }: { data: ReportTemplateData }) {
  const { property, comparableSales, incomeAnalysis, report, photos, filingGuide, narratives } = data;

  const narrativeSections = new Set(narratives.map((n) => n.section_name));

  const hasIncome = incomeAnalysis != null;
  const hasCostApproach = property.cost_approach_value != null && property.cost_approach_value > 0;
  const hasPhotoDefects = photos.some(p => (p.ai_analysis?.defects?.length ?? 0) > 0);
  const hasAddendumA =
    (report.service_type === 'tax_appeal' && filingGuide != null) ||
    (report.service_type === 'pre_listing' && narrativeSections.has('pricing_strategy_guide')) ||
    (report.service_type === 'pre_purchase' && narrativeSections.has('negotiation_guide'));

  const addendumATitle =
    report.service_type === 'pre_listing'
      ? 'Pricing Strategy Guide'
      : report.service_type === 'pre_purchase'
        ? 'Negotiation Strategy Guide'
        : 'County Filing Instructions';

  // Build section list dynamically
  const sections: TocEntry[] = [
    { number: '', title: 'Letter of Transmittal' },
    { number: '', title: 'Property Identification Summary' },
    ...(narrativeSections.has('assignment_and_scope')
      ? [{ number: 'A', title: 'Assignment & Scope' }]
      : []),
    ...(narrativeSections.has('summary_of_salient_facts')
      ? [{ number: 'B', title: 'Summary of Salient Facts' }]
      : []),
    ...(narrativeSections.has('property_history')
      ? [{ number: 'C', title: 'Property History' }]
      : []),
    ...(narrativeSections.has('assessment_data')
      ? [{ number: 'D', title: 'Assessment Data' }]
      : []),
    { number: 'I', title: 'Executive Summary' },
    { number: 'II', title: 'Property Description' },
    { number: 'III', title: 'Site Description' },
    { number: 'IV', title: 'Improvement Description' },
    { number: 'V-A', title: 'Area Analysis — County', indent: true },
    { number: 'V-B', title: 'Area Analysis — City', indent: true },
    { number: 'V-C', title: 'Area Analysis — Neighborhood', indent: true },
    { number: 'VI', title: 'Market Analysis' },
    { number: 'VII-A', title: 'Highest & Best Use — As Vacant', indent: true },
    { number: 'VII-B', title: 'Highest & Best Use — As Improved', indent: true },
    { number: 'VIII', title: 'Sales Comparison Approach' },
    { number: 'IX', title: 'Adjustment Reconciliation' },
  ];

  if (property.assessment_ratio != null) {
    sections.push({ number: 'X', title: 'Assessment Ratio Analysis' });
  }

  if (hasCostApproach) {
    sections.push({ number: 'XI', title: 'Cost Approach Analysis' });
  }

  if (hasIncome) {
    sections.push({ number: 'XII', title: 'Income Capitalization Approach' });
  }

  if (hasPhotoDefects) {
    sections.push({ number: 'XIII', title: 'Property Condition Documentation' });
  }

  // Addenda
  sections.push({ number: '', title: '' }); // spacer
  if (hasAddendumA) {
    sections.push({ number: 'ADD-A', title: addendumATitle });
  }
  sections.push({ number: 'ADD-B', title: 'Certification & Limiting Conditions' });

  return (
    <Page size="LETTER" style={theme.page}>
      <View style={styles.header}>
        <Text style={theme.headingXL}>Table of Contents</Text>
        <View style={theme.sectionDivider} />
      </View>

      {sections.map((entry, i) => {
        // Spacer row
        if (!entry.title && !entry.number) {
          return <View key={i} style={{ height: 12 }} />;
        }

        return (
          <View key={i} style={[styles.tocRow, entry.indent ? { paddingLeft: 16 } : {}]}>
            <Text style={[styles.tocNumber, entry.number.startsWith('ADD') ? styles.addendumLabel : {}]}>
              {entry.number ? `Section ${entry.number}` : ''}
            </Text>
            <View style={styles.tocDots} />
            <Text style={styles.tocTitle}>{entry.title}</Text>
          </View>
        );
      })}

      {/* Report metadata footer */}
      <View style={styles.metaBlock}>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Property</Text>
          <Text style={theme.tableCell}>
            {[report.property_address, report.city, report.state].filter(Boolean).join(', ')}
          </Text>
        </View>
        {report.pin && (
          <View style={styles.metaRow}>
            <Text style={theme.label}>Parcel Number</Text>
            <Text style={theme.tableCell}>{report.pin}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={theme.label}>Property Type</Text>
          <Text style={theme.tableCell}>
            {property.property_class_description ?? report.property_type ?? 'Residential'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Comparable Sales</Text>
          <Text style={theme.tableCell}>{comparableSales.length} transactions analyzed</Text>
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
    marginBottom: 16,
  },
  tocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tocNumber: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 9,
    color: colors.inkMuted,
    width: 80,
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
  tocTitle: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 10,
    color: colors.inkPrimary,
    maxWidth: 300,
  },
  metaBlock: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    gap: 12,
  },
});
