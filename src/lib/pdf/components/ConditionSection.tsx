// ─── Detailed Condition Evidence ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme } from '../styles/theme';
import { SectionHeader, DataTable } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { getConditionColor } from '@/lib/templates/helpers';

const CONDITION_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  average: 'Average',
  fair: 'Fair',
  poor: 'Poor',
};

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function ConditionSection({ data }: { data: ReportTemplateData }) {
  const { photos, property } = data;
  const photosWithDefects = photos.filter(
    (photo) => (photo.ai_analysis?.defects?.length ?? 0) > 0
  );
  if (photosWithDefects.length === 0) return null;

  const rating = property.overall_condition?.toLowerCase() ?? 'average';
  const badgeColor = getConditionColor(rating);
  const defectRows = photosWithDefects.flatMap((photo, photoIndex) => {
    const photoLabel =
      photo.ai_analysis?.professional_caption?.trim() ||
      photo.caption?.trim() ||
      (photo.photo_type ? titleCase(photo.photo_type) : `Photo ${photoIndex + 1}`);

    return (photo.ai_analysis?.defects ?? []).map((defect) => [
      photoLabel,
      titleCase(defect.type),
      titleCase(defect.severity),
      titleCase(defect.value_impact),
      defect.description,
    ]);
  });

  return (
    <View>
      <SectionHeader number="III-G" title="Detailed Condition Evidence Table" />

      <View style={styles.badgeRow} wrap={false}>
        <Text style={theme.label}>Overall stored condition rating: </Text>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{CONDITION_LABELS[rating] ?? titleCase(rating)}</Text>
        </View>
      </View>

      <Text style={[theme.bodyText, { marginBottom: 8 }]}>
        The table below preserves structured observations associated with submitted photographs. These
        observations support visible-condition analysis only. They are not engineering diagnoses,
        contractor estimates, code determinations, or proof that a defect existed on the valuation date
        unless the report identifies corroborating dated evidence.
      </Text>

      <DataTable
        headers={['Photo / Area', 'Observation', 'Severity', 'Value Relevance', 'Description']}
        columnWidths={['20%', '17%', '12%', '14%', '37%']}
        rows={defectRows}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 9,
    color: '#ffffff',
  },
});
