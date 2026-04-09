// ─── Cost Approach Analysis ──────────────────────────────────────────────────
// Structured presentation of the cost approach computation:
// Replacement Cost New → Physical Depreciation → Functional Obsolescence
// → Depreciated Improvement Value → Land Value → Cost Approach Value

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, NarrativeBlock, ValueCallout } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatPercent, formatSqFt, formatNumber } from '@/lib/templates/helpers';

export default function CostApproachTable({ data }: { data: ReportTemplateData }) {
  const { property, narratives } = data;

  // Guard: only render if cost approach was computed
  if (!property.cost_approach_value || property.cost_approach_value <= 0) return null;

  const rcn = property.cost_approach_rcn ?? 0;
  const physDepr = property.physical_depreciation_pct ?? 0;
  const funcObs = property.functional_obsolescence_pct ?? 0;
  const totalDepr = Math.min(physDepr + funcObs, 100);
  const deprAmount = rcn * (totalDepr / 100);
  const depreciatedImpr = rcn - deprAmount;
  const landValue = property.land_value ?? 0;
  const costApproachValue = property.cost_approach_value;

  const costNarrative = narratives.find(n => n.section_name === 'cost_approach');

  // Details for the computation table
  const buildingSqft = property.building_sqft_gross ?? property.building_sqft_living_area ?? 0;
  const costPerSqft = buildingSqft > 0 ? rcn / buildingSqft : 0;

  return (
    <View break>
      <SectionHeader number="XI" title="Cost Approach Analysis" />

      <Text style={[theme.bodyText, { marginBottom: 8 }]}>
        The Cost Approach estimates market value by calculating the current cost to construct
        a replacement building of equivalent utility, less all forms of depreciation, plus the
        underlying land value.
      </Text>

      {/* RCN Computation */}
      <Text style={styles.subheading}>Replacement Cost New (RCN)</Text>
      <View style={styles.computeTable}>
        <ComputeRow label="Gross Building Area" value={formatSqFt(buildingSqft)} />
        {costPerSqft > 0 && (
          <ComputeRow label="Cost per Square Foot" value={`$${formatNumber(costPerSqft, 2)}/SF`} />
        )}
        {property.quality_grade && (
          <ComputeRow label="Quality Grade" value={capitalize(property.quality_grade)} />
        )}
        <ComputeRow label="Replacement Cost New" value={formatCurrency(rcn)} bold accent />
      </View>

      {/* Depreciation Schedule */}
      <Text style={[styles.subheading, { marginTop: 10 }]}>Depreciation Schedule</Text>
      <View style={styles.computeTable}>
        {property.effective_age != null && (
          <ComputeRow label="Effective Age" value={`${property.effective_age} years`} />
        )}
        {property.remaining_economic_life != null && (
          <ComputeRow label="Remaining Economic Life" value={`${property.remaining_economic_life} years`} />
        )}
        <ComputeRow
          label="Physical Depreciation"
          value={`${formatPercent(physDepr)}   (${formatCurrency(rcn * physDepr / 100)})`}
        />
        {funcObs > 0 && (
          <ComputeRow
            label="Functional Obsolescence"
            value={`${formatPercent(funcObs)}   (${formatCurrency(rcn * funcObs / 100)})`}
          />
        )}
        {property.functional_obsolescence_notes && (
          <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
            <Text style={[theme.caption, { fontStyle: 'italic' }]}>
              {property.functional_obsolescence_notes}
            </Text>
          </View>
        )}
        <ComputeRow
          label="Total Depreciation"
          value={`${formatPercent(totalDepr)}   (${formatCurrency(deprAmount)})`}
          bold
        />
      </View>

      {/* Final Computation */}
      <Text style={[styles.subheading, { marginTop: 10 }]}>Cost Approach Computation</Text>
      <View style={styles.computeTable}>
        <ComputeRow label="Replacement Cost New" value={formatCurrency(rcn)} />
        <ComputeRow label="Less: Total Depreciation" value={`(${formatCurrency(deprAmount)})`} negative />
        <ComputeRow label="Depreciated Improvement Value" value={formatCurrency(depreciatedImpr)} bold />
        <ComputeRow label="Plus: Land Value" value={formatCurrency(landValue)} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Indicated Value by Cost Approach</Text>
          <Text style={styles.totalValue}>{formatCurrency(costApproachValue)}</Text>
        </View>
      </View>

      {/* AI narrative */}
      {costNarrative && <NarrativeBlock content={costNarrative.content} />}

      <ValueCallout
        label="Cost Approach Indication"
        value={formatCurrency(costApproachValue)}
        color={colors.accent}
      />
    </View>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function ComputeRow({
  label,
  value,
  bold,
  accent,
  negative,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold ? { fontWeight: 600 } : {}]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          bold ? { fontWeight: 600 } : {},
          accent ? { color: colors.accent } : {},
          negative ? { color: colors.red } : {},
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  computeTable: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 9,
    color: colors.inkBody,
  },
  rowValue: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 9,
    color: colors.inkPrimary,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.calloutBg,
    borderTopWidth: 2,
    borderTopColor: colors.inkPrimary,
  },
  totalLabel: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 10,
    color: colors.inkPrimary,
  },
  totalValue: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 10,
    color: colors.accent,
  },
});
