// ─── Cover Page ──────────────────────────────────────────────────────────────

import React from 'react';
import { Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatDate } from '@/lib/templates/helpers';
import { buildReportProfile } from '../report-profile';

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function CoverPage({ data }: { data: ReportTemplateData }) {
  const { report, property, photos } = data;
  const profile = buildReportProfile(data);
  const address = [report.property_address, report.city, report.state].filter(Boolean).join(', ');
  const propertyDescriptor =
    property.property_class_description ?? property.property_subtype ?? titleCase(report.property_type);
  const subjectPhoto = photos.find(
    (photo) =>
      photo.storage_path &&
      (photo.photo_type === 'exterior_front' || photo.photo_type === 'aerial')
  ) ?? photos.find((photo) => photo.storage_path);
  const clientName = report.client_name ?? 'Property Owner';

  return (
    <Page size="LETTER" style={theme.coverPage}>
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmark}>RESOURCEFUL</Text>
        <Text style={styles.brandDescriptor}>PROPERTY INTELLIGENCE</Text>
      </View>
      <View style={styles.accentRule} />

      <View style={styles.titleBlock}>
        <Text style={styles.documentTitle}>{profile.documentTitle}</Text>
        <Text style={styles.propertyType}>{propertyDescriptor}</Text>
      </View>

      {subjectPhoto?.storage_path ? (
        <View style={styles.photoContainer}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={subjectPhoto.storage_path} style={styles.subjectPhoto} />
          <Text style={styles.photoCaption}>
            {subjectPhoto.ai_analysis?.professional_caption ?? subjectPhoto.caption ?? 'Subject Property'}
          </Text>
        </View>
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={theme.caption}>No verified subject image was available in the workfile.</Text>
        </View>
      )}

      <Text style={styles.address}>{address}</Text>
      <Text style={styles.jurisdictionLine}>
        {[
          report.county,
          report.pin ? `Parcel ${report.pin}` : null,
        ].filter(Boolean).join('  ·  ')}
      </Text>

      <View style={styles.dateBlock}>
        <View style={styles.dateColumn}>
          <Text style={theme.label}>Valuation Date</Text>
          <Text style={styles.dateValue}>{formatDate(data.valuationDate)}</Text>
        </View>
        <View style={styles.dateDivider} />
        <View style={styles.dateColumn}>
          <Text style={theme.label}>Report Date</Text>
          <Text style={styles.dateValue}>{formatDate(data.reportDate)}</Text>
        </View>
      </View>

      <View style={styles.coverFooter}>
        <Text style={styles.preparedFor}>Prepared for {clientName}</Text>
        <Text style={theme.caption}>
          Review tier: {titleCase(report.review_tier)}  ·  Document profile: {profile.id}
        </Text>
        <Text style={styles.boundary}>
          AI-assisted valuation analysis based on the evidence, assumptions, effective date, and review scope documented in this report. It is not a signed or certified appraisal unless a qualified appraiser reviews, executes, and assumes responsibility for the assignment.
        </Text>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  wordmarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  wordmark: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 28,
    color: colors.inkPrimary,
    letterSpacing: 2,
  },
  brandDescriptor: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 7,
    color: colors.inkMuted,
    letterSpacing: 1.2,
  },
  accentRule: {
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    marginTop: 6,
    width: '100%',
  },
  titleBlock: {
    marginTop: 28,
    alignItems: 'center',
  },
  documentTitle: {
    fontFamily: 'Source Serif 4',
    fontWeight: 600,
    fontSize: 25,
    lineHeight: 1.2,
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  propertyType: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 10,
    color: colors.inkMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 7,
  },
  photoContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  subjectPhoto: {
    width: 430,
    height: 255,
    objectFit: 'contain',
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.calloutBg,
  },
  photoCaption: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  photoPlaceholder: {
    width: 430,
    height: 170,
    marginTop: 24,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.calloutBg,
  },
  address: {
    fontFamily: 'Source Serif 4',
    fontWeight: 600,
    fontSize: 19,
    color: colors.inkPrimary,
    textAlign: 'center',
    marginTop: 18,
  },
  jurisdictionLine: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 5,
  },
  dateBlock: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 60,
  },
  dateColumn: {
    flex: 1,
    alignItems: 'center',
  },
  dateDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 24,
  },
  dateValue: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 11,
    color: colors.inkPrimary,
    marginTop: 4,
  },
  coverFooter: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  preparedFor: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 9,
    color: colors.inkPrimary,
    marginBottom: 4,
  },
  boundary: {
    fontFamily: 'Inter',
    fontSize: 7,
    lineHeight: 1.35,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 26,
  },
});
