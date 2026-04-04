// ─── Cover Page ──────────────────────────────────────────────────────────────

import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatDate } from '@/lib/templates/helpers';

export default function CoverPage({ data }: { data: ReportTemplateData }) {
  const { report, property, concludedValue } = data;
  const address = [report.property_address, report.city, report.state].filter(Boolean).join(', ');
  const assessedValue = property.assessed_value ?? 0;
  const overpayment = Math.max(0, assessedValue - concludedValue);

  const serviceLabel =
    report.service_type === 'tax_appeal' ? 'Property Tax Appeal Report'
    : report.service_type === 'pre_purchase' ? 'Pre-Purchase Analysis Report'
    : 'Pre-Listing Analysis Report';

  return (
    <Page size="LETTER" style={theme.coverPage}>
      {/* Wordmark */}
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmark}>RESOURCEFUL</Text>
      </View>
      <View style={styles.accentRule} />

      {/* Subtitle */}
      <Text style={[theme.headingLG, { color: colors.inkMuted, marginTop: 12 }]}>
        {serviceLabel}
      </Text>

      {/* Property address */}
      <Text style={[theme.headingXL, { fontSize: 22, textAlign: 'center', marginTop: 48 }]}>
        {address}
      </Text>

      {/* Parcel / County / State */}
      <Text style={[theme.label, { textAlign: 'center', marginTop: 8 }]}>
        {[
          report.pin ? `Parcel: ${report.pin}` : null,
          report.county,
          report.state,
        ].filter(Boolean).join('  ·  ')}
      </Text>

      {/* Value summary block */}
      <View style={styles.valueBlock}>
        <View style={styles.valueCol}>
          <Text style={theme.label}>Assessed Value</Text>
          <Text style={styles.valueNum}>{formatCurrency(assessedValue)}</Text>
        </View>
        <View style={styles.valueDivider} />
        <View style={styles.valueCol}>
          <Text style={theme.label}>Concluded Market Value</Text>
          <Text style={[styles.valueNum, { color: colors.accent }]}>{formatCurrency(concludedValue)}</Text>
        </View>
        <View style={styles.valueDivider} />
        <View style={styles.valueCol}>
          <Text style={theme.label}>Estimated Overpayment</Text>
          <Text style={[styles.valueNum, { color: colors.red }]}>{formatCurrency(overpayment)}</Text>
        </View>
      </View>

      {/* Footer info */}
      <View style={styles.coverFooter}>
        <Text style={theme.caption}>Report Prepared: {formatDate(data.reportDate)}</Text>
        <Text style={theme.caption}>Report ID: {report.id}</Text>
        <Text style={[theme.caption, { marginTop: 4 }]}>resourceful.app</Text>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  wordmarkRow: { flexDirection: 'row' },
  wordmark: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 28,
    color: colors.inkPrimary,
    letterSpacing: 2,
  },
  accentRule: {
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    marginTop: 6,
    width: '100%',
  },
  valueBlock: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  valueCol: {
    alignItems: 'center',
    flex: 1,
  },
  valueDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  valueNum: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 20,
    color: colors.inkPrimary,
    marginTop: 4,
  },
  coverFooter: {
    marginTop: 'auto',
    alignItems: 'center',
  },
});
