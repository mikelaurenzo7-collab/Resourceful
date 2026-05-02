// ─── Property Condition Documentation ────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme } from '../styles/theme';
import { SectionHeader, NarrativeBlock, PhotoGrid } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { getConditionColor } from '@/lib/templates/helpers';

const CONDITION_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  average: 'Average',
  fair: 'Fair',
  poor: 'Poor',
};

export default function ConditionSection({ data }: { data: ReportTemplateData }) {
  const { photos, narratives, property } = data;

  // Only render if there are photos with defects
  const photosWithDefects = photos.filter(
    p => p.ai_analysis?.defects && p.ai_analysis.defects.length > 0
  );
  if (photosWithDefects.length === 0) return null;

  const condNarrative = narratives.find(n => n.section_name === 'condition_assessment');
  const rating = property.overall_condition?.toLowerCase() ?? 'average';
  const badgeColor = getConditionColor(rating);

  // Build photo items for grid
  const photoItems = photos
    .filter(p => p.storage_path)
    .slice(0, 6)
    .map(p => ({
      url: p.storage_path,
      caption: p.ai_analysis?.professional_caption ?? p.caption ?? p.photo_type ?? 'Photo',
    }));

  return (
    <View break>
      <SectionHeader number="XIII" title="Property Condition Documentation" />

      {/* Condition badge */}
      <View style={styles.badgeRow} wrap={false}>
        <Text style={theme.label}>Overall Condition Rating: </Text>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{CONDITION_LABELS[rating] ?? rating}</Text>
        </View>
      </View>

      {/* AI narrative */}
      {condNarrative && <NarrativeBlock content={condNarrative.content} />}

      {/* Photo grid */}
      <PhotoGrid photos={photoItems} />
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
