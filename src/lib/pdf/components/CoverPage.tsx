// ─── Cover Page ──────────────────────────────────────────────────────────────

import React from 'react';
import { Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatDate } from '@/lib/templates/helpers';

export default function CoverPage({ data }: { data: ReportTemplateData }) {
  const { report, property, concludedValue, photos } = data;
  const address = [report.property_address, report.city, report.state].filter(Boolean).join(', ');
  const assessedValue = property.assessed_value ?? 0;
  const overpayment = Math.max(0, assessedValue - concludedValue);

  const serviceLabel =
    report.service_type === 'tax_appeal' ? 'Property Tax Appeal Report'
    : report.service_type === 'pre_purchase' ? 'Pre-Purchase Analysis Report'
    : 'Pre-Listing Analysis Report';

  // Find the best subject photo for cover
  const subjectPhoto = photos.find(
    p => p.storage_path && (p.photo_type === 'exterior_front' || p.photo_type === 'aerial')
  ) ?? photos.find(p => p.storage_path);

  const clientName = report.client_name ?? report.client_email ?? 'Property Owner';

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

      {/* Subject photo */}
      {subjectPhoto?.storage_path && (
        <View style={styles.photoContainer}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={subjectPhoto.storage_path} style={styles.subjectPhoto} />
          <Text style={[theme.caption, { textAlign: 'center', marginTop: 3 }]}>
            {subjectPhoto.ai_analysis?.professional_caption ?? 'Subject Property'}
          </Text>
        </View>
      )}

      {/* Property address */}
      <Text style={[theme.headingXL, { fontSize: 22, textAlign: 'center', marginTop: subjectPhoto ? 16 : 48 }]}>
        {address}
      </Text>

      {/* Parcel / County / State */}
      <Text style={[theme.label, { textAlign: 'center', marginTop: 8 }]}>
        {[
          report.pin ? `Parcel: ${report.pin}` : null,
          report.county ? `${report.county} County` : null,
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
        <Text style={[theme.caption, { fontWeight: 500 }]}>Prepared for: {clientName}</Text>
        <Text style={theme.caption}>Report Date: {formatDate(data.reportDate)}</Text>
        <Text style={theme.caption}>Report ID: {report.id}</Text>
        <Text style={[theme.caption, { marginTop: 6, fontWeight: 500 }]}>resourceful.app</Text>
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
    marginTop: 28,
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
  photoContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  subjectPhoto: {
    width: 420,
    height: 240,
    objectFit: 'cover',
    borderRadius: 2,
  },
});
