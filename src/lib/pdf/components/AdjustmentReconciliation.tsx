// ─── Adjustment Reconciliation ───────────────────────────────────────────────

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { SectionHeader, NarrativeBlock, DataTable } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { adjustmentLabel } from '@/lib/templates/helpers';
import { findNarrativeContent } from '@/lib/report-narratives';
import ValueConclusionTable from './ValueConclusionTable';
import { colors, theme } from '../styles/theme';

const ADJ_KEYS = [
  'property_rights', 'financing_terms', 'conditions_of_sale', 'market_trends',
  'location', 'size', 'land_to_building', 'condition', 'other',
] as const;

export default function AdjustmentReconciliation({ data }: { data: ReportTemplateData }) {
  const { comparableSales, narratives } = data;
  const reconcNarrative = findNarrativeContent(narratives, 'reconciliation_narrative');

  const adjRows = ADJ_KEYS.map((key) => {
    const field = `adjustment_pct_${key}` as keyof typeof comparableSales[0];
    const values = comparableSales
      .map((comparable) => comparable[field])
      .filter(
        (value): value is number =>
          typeof value === 'number' && Number.isFinite(value) && value !== 0
      );

    if (values.length === 0) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);

    return [
      adjustmentLabel(key),
      values.length === 1 ? `${values[0].toFixed(1)}%` : `${min.toFixed(1)}% to ${max.toFixed(1)}%`,
      `Structured workfile input applied to ${values.length} of ${comparableSales.length} comparables`,
    ];
  }).filter((row): row is string[] => row !== null);

  return (
    <View break>
      <SectionHeader number="IX" title="Adjustment Reconciliation & Value Conclusion" />

      <Text style={[theme.bodyText, { marginBottom: 8, color: colors.inkMuted }]}>
        Percentage adjustments shown below are structured Resourceful workfile inputs. Each adjustment
        should be traceable to cited transaction terms, market evidence, measurable property differences,
        or a documented analytical method. They are not represented as independent licensed-appraiser
        judgments unless this report expressly identifies that review and adoption.
      </Text>

      {adjRows.length > 0 ? (
        <DataTable
          headers={['Adjustment Category', 'Range Applied', 'Workfile Coverage']}
          columnWidths={['25%', '25%', '50%']}
          rows={adjRows}
        />
      ) : (
        <Text style={[theme.bodyText, { marginBottom: 8 }]}>
          No nonzero structured adjustment inputs were available. Comparable indications should therefore
          be read as unadjusted evidence unless the narrative identifies and supports a separate qualitative
          reconciliation.
        </Text>
      )}

      {reconcNarrative && <NarrativeBlock content={reconcNarrative} />}

      <ValueConclusionTable data={data} />
    </View>
  );
}
