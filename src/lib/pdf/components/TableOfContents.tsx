// ─── Table of Contents ───────────────────────────────────────────────────────
// Dynamic inventory of the sections and evidence actually included in the report.

import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import {
  getAssignmentDisplayLabel,
  resolveAssignmentKind,
} from '@/lib/assignments/routing';
import { supportsIncomeApproach } from '@/lib/valuation/property-type-policy';

interface TocEntry {
  number: string;
  title: string;
  indent?: boolean;
}

export default function TableOfContents({ data }: { data: ReportTemplateData }) {
  const { property, comparableSales, comparableRentals, incomeAnalysis, report, photos, filingGuide, narratives, maps } = data;
  const assignmentKind = resolveAssignmentKind(report.service_type, report.desired_outcome);
  const assignmentLabel = getAssignmentDisplayLabel(report.service_type, report.desired_outcome);
  const narrativeSections = new Set(narratives.map((n) => n.section_name));

  const hasIncome = incomeAnalysis != null && supportsIncomeApproach({
    propertyType: report.property_type,
    propertySubtype: property.property_subtype,
    propertyClassDescription: property.property_class_description,
  });
  const hasCostApproach = property.cost_approach_value != null && property.cost_approach_value > 0;
  const hasSales = comparableSales.length > 0;
  const hasPhotoExhibit = photos.some((photo) => Boolean(photo.storage_path));
  const hasPhotoDefects = photos.some((photo) => (photo.ai_analysis?.defects?.length ?? 0) > 0);
  const hasCertification = narrativeSections.has('certification_and_limiting_conditions');
  const mapCount = [maps.regional, maps.neighborhood, maps.parcel].filter(Boolean).length;
  const documentedPhotoCount = photos.filter((photo) => Boolean(photo.storage_path)).length;

  const hasAddendumA =
    (assignmentKind === 'tax_appeal' && filingGuide != null) ||
    (assignmentKind === 'pre_listing' && narrativeSections.has('pricing_strategy_guide')) ||
    (assignmentKind === 'pre_purchase' && narrativeSections.has('negotiation_guide')) ||
    (assignmentKind === 'independent_valuation' && narrativeSections.has('valuation_use_guide'));

  const addendumATitle = assignmentKind === 'pre_listing'
    ? 'Pricing Strategy Guide'
    : assignmentKind === 'pre_purchase'
      ? 'Negotiation Strategy Guide'
      : assignmentKind === 'independent_valuation'
        ? 'Valuation Use & Next-Step Guide'
        : 'County Filing Instructions';

  const sections: TocEntry[] = [
    { number: '', title: 'Letter of Transmittal' },
    { number: '', title: 'Branded Property Cover' },
    { number: 'I-A', title: 'Summary of Salient Facts & Valuation Findings' },
    { number: 'I-B', title: 'Property Identification Summary' },
    { number: 'I-C', title: 'Executive Summary & Location Evidence' },
    ...(hasPhotoExhibit
      ? [{ number: 'EX-1', title: 'Subject Maps & Photo Exhibit' }]
      : []),
    ...(narrativeSections.has('assignment_and_scope')
      ? [{ number: 'I-D', title: 'Assignment, Intended Use & Scope of Work' }]
      : []),
    ...(narrativeSections.has('property_history')
      ? [{ number: 'I-E', title: 'Property History' }]
      : []),
    ...(narrativeSections.has('assessment_data')
      ? [{ number: 'I-F', title: 'Assessment Data' }]
      : []),
    { number: 'II', title: 'Property Description' },
    { number: 'III', title: 'Site Description' },
    { number: 'IV', title: 'Improvement Description' },
    { number: 'V-A', title: 'Area Analysis — County', indent: true },
    { number: 'V-B', title: 'Area Analysis — City', indent: true },
    { number: 'V-C', title: 'Area Analysis — Neighborhood', indent: true },
    { number: 'VI', title: 'Market Analysis' },
    { number: 'VII-A', title: 'Highest & Best Use — As Vacant', indent: true },
    { number: 'VII-B', title: 'Highest & Best Use — As Improved', indent: true },
    ...(hasSales
      ? [
          { number: 'VIII-A', title: 'Comparable Sales Summary & Map' },
          { number: 'VIII-B', title: 'Individual Comparable Sale Profiles' },
        ]
      : []),
    { number: 'IX', title: 'Approach Reconciliation & Value Conclusion' },
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

  sections.push({ number: '', title: '' });
  if (hasAddendumA) {
    sections.push({ number: 'ADD-A', title: addendumATitle });
  }
  sections.push({
    number: 'ADD-B',
    title: hasCertification
      ? 'Certification & Limiting Conditions'
      : 'Limitations & Use Disclosures',
  });

  return (
    <Page size="LETTER" style={theme.page}>
      <View style={styles.header}>
        <Text style={theme.headingXL}>Table of Contents</Text>
        <View style={theme.sectionDivider} />
        <Text style={styles.intro}>
          Sections appear only when the corresponding workfile evidence or assignment-specific guidance is available.
        </Text>
      </View>

      {sections.map((entry, index) => {
        if (!entry.title && !entry.number) {
          return <View key={index} style={{ height: 8 }} />;
        }

        return (
          <View key={index} style={[styles.tocRow, entry.indent ? { paddingLeft: 16 } : {}]}>
            <Text style={[styles.tocNumber, entry.number.startsWith('ADD') ? styles.addendumLabel : {}]}>
              {entry.number ? `Section ${entry.number}` : ''}
            </Text>
            <View style={styles.tocDots} />
            <Text style={styles.tocTitle}>{entry.title}</Text>
          </View>
        );
      })}

      <View style={styles.metaBlock}>
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
        {report.pin && (
          <View style={styles.metaRow}>
            <Text style={theme.label}>Parcel Number</Text>
            <Text style={theme.tableCell}>{report.pin}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={theme.label}>Property Type</Text>
          <Text style={theme.tableCell}>
            {property.property_class_description ?? report.property_type ?? 'Not classified'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={theme.label}>Sales Evidence</Text>
          <Text style={theme.tableCell}>
            {hasSales ? `${comparableSales.length} transactions with individual evidence profiles` : 'No comparable sales included'}
          </Text>
        </View>
        {hasIncome && (
          <View style={styles.metaRow}>
            <Text style={theme.label}>Rental Evidence</Text>
            <Text style={theme.tableCell}>{comparableRentals.length} rental records analyzed</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={theme.label}>Visual Evidence</Text>
          <Text style={theme.tableCell}>
            {documentedPhotoCount} subject images; {mapCount} map exhibits
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
    marginBottom: 10,
  },
  intro: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: colors.inkMuted,
    marginTop: 4,
  },
  tocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tocNumber: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 8,
    color: colors.inkMuted,
    width: 78,
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
    marginHorizontal: 7,
    height: 7,
  },
  tocTitle: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 8.5,
    color: colors.inkPrimary,
    maxWidth: 310,
  },
  metaBlock: {
    marginTop: 'auto',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    paddingVertical: 2,
    gap: 12,
  },
});
