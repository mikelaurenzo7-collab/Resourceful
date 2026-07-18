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

  const adjRows = ADJ_KEYS.map((key) => {
    const field = `adjustment_pct_${key}` as keyof typeof comparableSales[0];
    const vals = comparableSales
      .map((comparable) => comparable[field] as number)
      .filter((value) => value != null && value !== 0);
    if (vals.length === 0) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return [
      adjustmentLabel(key),
      vals.length === 1 ? `${vals[0].toFixed(1)}%` : `${min.toFixed(1)}% to ${max.toFixed(1)}%`,
      `Applied across ${vals.length} of ${comparableSales.length} comparables`,
    ];
  }).filter((row): row is string[] => row !== null);

  return (
    <View>
      <SectionHeader number="VIII-B" title="Reconciliation & Final Value Conclusion" />

      {adjRows.length > 0 && (
        <DataTable
          headers={['Adjustment Category', 'Range Applied', 'Application Summary']}
          columnWidths={['25%', '25%', '50%']}
          rows={adjRows}
        />
      )}

      {reconcNarrative && <NarrativeBlock content={reconcNarrative} />}
      <ValueConclusionTable data={data} />
    </View>
  );
}
