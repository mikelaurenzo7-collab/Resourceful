import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatCurrencyWords, formatDate } from '@/lib/templates/helpers';
import { buildValueConclusionRows } from '../section-data';
import { DataTable, ValueCallout } from './shared';
import { colors, theme } from '../styles/theme';

export default function ValueConclusionTable({ data }: { data: ReportTemplateData }) {
  const rows = buildValueConclusionRows(data);

  if (rows.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.subheading}>Value Conclusion Summary</Text>

      <DataTable
        headers={['Approach', 'Indication', '$/SF', 'Role']}
        columnWidths={['31%', '23%', '16%', '30%']}
        numericColumns={[1, 2]}
        rows={rows.map((row) => [
          row.approach,
          formatCurrency(row.total),
          row.valuePerSqFt != null ? `$${row.valuePerSqFt.toFixed(2)}` : '—',
          row.role,
        ])}
      />

      <ValueCallout
        label={`Resourceful Concluded Market Value as of ${formatDate(data.valuationDate)}`}
        value={formatCurrency(data.concludedValue)}
        color={colors.accent}
      />

      <Text style={[theme.caption, { marginTop: 4, color: colors.inkMuted }]}>
        {formatCurrencyWords(data.concludedValue)}.
      </Text>
      <Text style={[theme.caption, styles.boundary]}>
        This conclusion is an AI-assisted synthesis of the documented Resourceful workfile and the
        approaches displayed above. It is not represented as a signed or licensed appraisal unless a
        separately identified licensed appraiser has reviewed, adopted, certified, and signed the report.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 10,
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
  boundary: {
    marginTop: 5,
    lineHeight: 1.4,
  },
});
