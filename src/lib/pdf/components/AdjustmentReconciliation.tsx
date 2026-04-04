// ─── Adjustment Reconciliation ───────────────────────────────────────────────

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, NarrativeBlock, DataTable, ValueCallout } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, adjustmentLabel } from '@/lib/templates/helpers';

const ADJ_KEYS = [
  'property_rights', 'financing_terms', 'conditions_of_sale', 'market_trends',
  'location', 'size', 'land_to_building', 'condition', 'other',
] as const;

export default function AdjustmentReconciliation({ data }: { data: ReportTemplateData }) {
  const { comparableSales, concludedValue, narratives } = data;
  const reconcNarrative = narratives.find(n => n.section_name === 'reconciliation');

  // Build adjustment range table
  const adjRows = ADJ_KEYS.map(key => {
    const field = `adjustment_pct_${key}` as keyof typeof comparableSales[0];
    const vals = comparableSales
      .map(c => c[field] as number)
      .filter(v => v != null && v !== 0);
    if (vals.length === 0) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return [
      adjustmentLabel(key),
      vals.length === 1 ? `${vals[0].toFixed(1)}%` : `${min.toFixed(1)}% to ${max.toFixed(1)}%`,
      `Applied across ${vals.length} of ${comparableSales.length} comparables`,
    ];
  }).filter((r): r is string[] => r !== null);

  return (
    <View break>
      <SectionHeader number="IX" title="Adjustment Reconciliation" />

      {adjRows.length > 0 && (
        <DataTable
          headers={['Adjustment Category', 'Range Applied', 'Rationale']}
          columnWidths={['25%', '25%', '50%']}
          rows={adjRows}
        />
      )}

      {/* Reconciliation narrative */}
      {reconcNarrative && <NarrativeBlock content={reconcNarrative.content} />}

      {/* Concluded value callout */}
      <ValueCallout
        label="Concluded Market Value"
        value={formatCurrency(concludedValue)}
        color={colors.accent}
      />
    </View>
  );
}
