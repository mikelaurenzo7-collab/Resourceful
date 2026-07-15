// ─── Comparable Sales Grid ───────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, DataTable } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatSqFt, formatDateShort } from '@/lib/templates/helpers';
import type { ComparableSale } from '@/types/database';

function fmtAdj(value: number | null): string {
  if (value == null || value === 0) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function validSaleTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export default function CompsGrid({ data }: { data: ReportTemplateData }) {
  const { comparableSales, property } = data;
  if (comparableSales.length === 0) return null;

  const sorted = [...comparableSales].sort(
    (a, b) => (a.distance_miles ?? Number.POSITIVE_INFINITY) - (b.distance_miles ?? Number.POSITIVE_INFINITY)
  );
  const datedSales = sorted
    .map((comp) => ({ value: comp.sale_date, timestamp: validSaleTimestamp(comp.sale_date) }))
    .filter((entry): entry is { value: string; timestamp: number } => entry.timestamp != null)
    .sort((a, b) => a.timestamp - b.timestamp);
  const minDate = datedSales.length > 0 ? formatDateShort(datedSales[0].value) : 'Not available';
  const maxDate = datedSales.length > 0 ? formatDateShort(datedSales[datedSales.length - 1].value) : 'Not available';
  const knownDistances = sorted
    .map((comp) => comp.distance_miles)
    .filter((distance): distance is number => distance != null && Number.isFinite(distance) && distance >= 0);
  const maxDistance = knownDistances.length > 0 ? Math.max(...knownDistances) : null;

  const selectionSummary = datedSales.length > 0
    ? `${sorted.length} documented comparable sale${sorted.length === 1 ? '' : 's'} dated ${minDate} through ${maxDate}`
    : `${sorted.length} documented comparable sale${sorted.length === 1 ? '' : 's'}`;
  const distanceSummary = maxDistance != null
    ? ` within a maximum reported distance of ${maxDistance.toFixed(1)} miles from the subject property`
    : ', with source distance data unavailable for at least part of the set';

  return (
    <View break>
      <SectionHeader number="VIII" title="Comparable Sales Analysis" />

      <Text style={[theme.bodyText, { marginBottom: 8 }]}>
        {selectionSummary}{distanceSummary}. Selection, source verification, comparability, and any calculated
        adjustments remain subject to the evidence and limitations documented in the workfile.
      </Text>

      <DataTable
        headers={['Address', 'Sale Date', 'Sale Price', 'GLA (SF)', 'Lot SF', 'Yr Built', 'Cond.', '$/SF', 'Net Adj', 'Adj $/SF']}
        columnWidths={['18%', '9%', '11%', '8%', '8%', '7%', '7%', '8%', '8%', '11%']}
        numericColumns={[2, 3, 4, 5, 7, 8, 9]}
        highlightRow={0}
        rows={[
          [
            'SUBJECT — NOT A SALE',
            '—',
            '—',
            property.building_sqft_gross ? formatSqFt(property.building_sqft_gross).replace(' SF', '') : '—',
            property.lot_size_sqft ? formatSqFt(property.lot_size_sqft).replace(' SF', '') : '—',
            property.year_built != null ? String(property.year_built) : '—',
            property.overall_condition ?? '—',
            '—',
            '—',
            '—',
          ],
          ...sorted.map((comp: ComparableSale) => [
            comp.address.length > 30 ? `${comp.address.slice(0, 28)}…` : comp.address,
            validSaleTimestamp(comp.sale_date) != null ? formatDateShort(comp.sale_date) : 'Unverified',
            comp.sale_price > 0 ? formatCurrency(comp.sale_price) : '—',
            comp.building_sqft ? formatSqFt(comp.building_sqft).replace(' SF', '') : '—',
            comp.lot_size_sqft ? formatSqFt(comp.lot_size_sqft).replace(' SF', '') : '—',
            comp.year_built != null ? String(comp.year_built) : '—',
            comp.condition_notes ?? '—',
            comp.price_per_sqft != null && comp.price_per_sqft > 0
              ? `$${comp.price_per_sqft.toFixed(0)}`
              : '—',
            fmtAdj(comp.net_adjustment_pct),
            comp.adjusted_price_per_sqft != null && comp.adjusted_price_per_sqft > 0
              ? `$${comp.adjusted_price_per_sqft.toFixed(0)}`
              : '—',
          ]),
        ]}
      />

      <View style={styles.statsRow} wrap={false}>
        {(() => {
          const adjustedPrices = sorted
            .map((comp) => comp.adjusted_price_per_sqft)
            .filter((price): price is number => price != null && price > 0)
            .sort((a, b) => a - b);
          if (adjustedPrices.length === 0) {
            return (
              <Text style={theme.caption}>
                No reviewed adjusted-price-per-square-foot indications are available.
              </Text>
            );
          }
          const minimum = adjustedPrices[0];
          const maximum = adjustedPrices[adjustedPrices.length - 1];
          const midpoint = Math.floor(adjustedPrices.length / 2);
          const median = adjustedPrices.length % 2 === 0
            ? (adjustedPrices[midpoint - 1] + adjustedPrices[midpoint]) / 2
            : adjustedPrices[midpoint];
          return (
            <>
              <Text style={theme.caption}>Adjusted $/SF Range: ${minimum.toFixed(0)} – ${maximum.toFixed(0)}</Text>
              <Text style={[theme.caption, { marginLeft: 16 }]}>Median: ${median.toFixed(0)}/SF</Text>
            </>
          );
        })()}
      </View>

      <Text style={[theme.caption, { marginTop: 5 }]}> 
        Blank adjustment fields mean no supported adjustment is stored; they must not be interpreted as a confirmed zero adjustment.
      </Text>
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
