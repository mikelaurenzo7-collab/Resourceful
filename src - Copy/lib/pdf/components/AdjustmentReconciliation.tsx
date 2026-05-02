// ─── Adjustment Reconciliation ───────────────────────────────────────────────

import React from 'react';
import { View } from '@react-pdf/renderer';
import { SectionHeader, NarrativeBlock, DataTable } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { adjustmentLabel } from '@/lib/templates/helpers';
import { findNarrativeContent } from '@/lib/report-narratives';
import ValueConclusionTable from './ValueConclusionTable';

const ADJ_KEYS = [
  'property_rights', 'financing_terms', 'conditions_of_sale', 'market_trends',
  'location', 'size', 'land_to_building', 'condition', 'other',
] as const;

export default function AdjustmentReconciliation({ data }: { data: ReportTemplateData }) {
  const { comparableSales, narratives } = data;
  const reconcNarrative = findNarrativeContent(narratives, 'reconciliation_narrative');

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
      <SectionHeader number="IX" title="Adjustment Reconciliation & Value Conclusion" />

      {adjRows.length > 0 && (
        <DataTable
          headers={['Adjustment Category', 'Range Applied', 'Rationale']}
          columnWidths={['25%', '25%', '50%']}
          rows={adjRows}
        />
      )}

      {/* Reconciliation narrative */}
      {reconcNarrative && <NarrativeBlock content={reconcNarrative} />}

      <ValueConclusionTable data={data} />
    </View>
  );
}
