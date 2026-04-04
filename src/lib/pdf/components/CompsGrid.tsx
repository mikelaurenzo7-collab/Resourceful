// ─── Comparable Sales Grid ───────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, DataTable } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatSqFt, formatDateShort } from '@/lib/templates/helpers';
import type { ComparableSale } from '@/types/database';

function fmtAdj(val: number | null): string {
  if (val == null || val === 0) return '—';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

export default function CompsGrid({ data }: { data: ReportTemplateData }) {
  const { comparableSales, property } = data;
  if (comparableSales.length === 0) return null;

  const sorted = [...comparableSales].sort((a, b) => (a.distance_miles ?? 99) - (b.distance_miles ?? 99));
  const dates = sorted.map(c => c.sale_date).filter(Boolean);
  const minDate = dates.length > 0 ? formatDateShort(dates[0]) : 'N/A';
  const maxDate = dates.length > 0 ? formatDateShort(dates[dates.length - 1]) : 'N/A';
  const maxDist = Math.max(...sorted.map(c => c.distance_miles ?? 0));

  return (
    <View break>
      <SectionHeader number="VIII" title="Comparable Sales Analysis" />

      <Text style={[theme.bodyText, { marginBottom: 8 }]}>
        {sorted.length} comparable sales were selected from transactions dated{' '}
        {minDate} through {maxDate} within a {maxDist.toFixed(1)}-mile radius
        of the subject property.
      </Text>

      {/* Comp table */}
      <DataTable
        headers={['Address', 'Sale Date', 'Sale Price', 'GLA (SF)', 'Lot SF', 'Yr Built', 'Cond.', '$/SF', 'Net Adj', 'Adj Value']}
        columnWidths={['18%', '9%', '11%', '8%', '8%', '7%', '7%', '8%', '8%', '11%']}
        numericColumns={[2, 3, 4, 5, 7, 8, 9]}
        highlightRow={0}
        rows={[
          // Subject property row first
          [
            'SUBJECT',
            '—',
            formatCurrency(property.assessed_value ?? 0),
            formatSqFt(property.building_sqft_gross ?? 0).replace(' SF', ''),
            property.lot_size_sqft ? formatSqFt(property.lot_size_sqft).replace(' SF', '') : '—',
            property.year_built ? String(property.year_built) : '—',
            property.overall_condition ?? '—',
            '—',
            '—',
            '—',
          ],
          // Comp rows
          ...sorted.map((c: ComparableSale) => [
            c.address.length > 30 ? c.address.slice(0, 28) + '…' : c.address,
            formatDateShort(c.sale_date),
            formatCurrency(c.sale_price),
            c.building_sqft ? formatSqFt(c.building_sqft).replace(' SF', '') : '—',
            c.lot_size_sqft ? formatSqFt(c.lot_size_sqft).replace(' SF', '') : '—',
            c.year_built ? String(c.year_built) : '—',
            c.condition_notes ?? '—',
            c.price_per_sqft ? `$${c.price_per_sqft.toFixed(0)}` : '—',
            fmtAdj(c.net_adjustment_pct),
            c.adjusted_price_per_sqft ? `$${c.adjusted_price_per_sqft.toFixed(0)}` : '—',
          ]),
        ]}
      />

      {/* Footer stats */}
      <View style={styles.statsRow} wrap={false}>
        {(() => {
          const adjPrices = sorted
            .map(c => c.adjusted_price_per_sqft)
            .filter((p): p is number => p != null && p > 0)
            .sort((a, b) => a - b);
          if (adjPrices.length === 0) return null;
          const min = adjPrices[0];
          const max = adjPrices[adjPrices.length - 1];
          const mid = Math.floor(adjPrices.length / 2);
          const median = adjPrices.length % 2 === 0
            ? (adjPrices[mid - 1] + adjPrices[mid]) / 2
            : adjPrices[mid];
          return (
            <>
              <Text style={theme.caption}>Adjusted $/SF Range: ${min.toFixed(0)} – ${max.toFixed(0)}</Text>
              <Text style={[theme.caption, { marginLeft: 16 }]}>Median: ${median.toFixed(0)}/SF</Text>
            </>
          );
        })()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
});
