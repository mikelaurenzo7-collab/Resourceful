// ─── Disclaimer & Certification ──────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatDate } from '@/lib/templates/helpers';

export default function Disclaimer({ data }: { data: ReportTemplateData }) {
  const { report, reportDate } = data;

  return (
    <View break>
      <SectionHeader number="ADD-B" title="Certification & Limiting Conditions" />

      <Text style={[theme.bodyText, { marginBottom: 10 }]}>
        The analyst certifies that, to the best of their knowledge and belief:
      </Text>

      {[
        'The statements of fact contained in this report are true and correct.',
        'The reported analyses, opinions, and conclusions are limited only by the reported assumptions and limiting conditions.',
        'The analyst has no present or prospective interest in the property that is the subject of this report.',
        'The analyst has no bias with respect to the property that is the subject of this report or to the parties involved with this assignment.',
        'Compensation for completing this assignment is not contingent upon the development or reporting of a predetermined value.',
        'This analysis was prepared using the Sales Comparison Approach consistent with IAAO Standard on Mass Appraisal of Real Property.',
      ].map((item, i) => (
        <Text key={i} style={[theme.tableCell, { fontSize: 9, marginBottom: 4, lineHeight: 1.5 }]}>
          {i + 1}. {item}
        </Text>
      ))}

      <View style={styles.rule} />

      {/* Limiting conditions */}
      <Text style={[theme.headingMD, { marginTop: 12 }]}>Limiting Conditions</Text>
      <Text style={[theme.bodyText, { marginTop: 6 }]}>
        This report is an informational analysis tool prepared for property tax assessment review
        purposes. It is not a certified appraisal as defined by the Uniform Standards of Professional
        Appraisal Practice (USPAP), nor is it legal advice. The user is responsible for independently
        verifying all data, meeting applicable filing deadlines, and confirming all requirements
        directly with the appropriate county assessment office. Resourceful is not a law firm, and
        the contents of this report do not constitute legal representation.
      </Text>

      {/* Footer metadata */}
      <View style={styles.metaBlock}>
        <Text style={theme.caption}>Report ID: {report.id}</Text>
        <Text style={theme.caption}>Generated: {formatDate(reportDate)}</Text>
        <Text style={theme.caption}>resourceful.app</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rule: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 12,
  },
  metaBlock: {
    marginTop: 24,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
});
