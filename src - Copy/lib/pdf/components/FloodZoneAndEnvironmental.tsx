import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatDate } from '@/lib/templates/helpers';
import { buildFloodEnvironmentalContext } from '../section-data';
import { DataTable } from './shared';
import { colors, theme } from '../styles/theme';

export default function FloodZoneAndEnvironmental({ data }: { data: ReportTemplateData }) {
  const context = buildFloodEnvironmentalContext(data);

  if (context.facts.length === 0 && context.observations.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.subheading}>Flood Zone & Environmental Context</Text>

      {context.facts.length > 0 && (
        <DataTable
          headers={['Item', 'Details']}
          columnWidths={['30%', '70%']}
          rows={context.facts.map((fact) => [
            fact.label,
            fact.label === 'Panel Effective Date' ? formatDate(fact.value) : fact.value,
          ])}
        />
      )}

      {context.observations.map((observation, index) => (
        <View key={index} style={styles.observationRow}>
          <Text style={[theme.bodyText, { width: 10, marginBottom: 0 }]}>{'\u2022'}</Text>
          <Text style={[theme.bodyText, { flex: 1, marginBottom: 0 }]}>{observation}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
  },
  subheading: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 10,
    color: colors.inkPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
  },
  observationRow: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 10,
  },
});
