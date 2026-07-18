// ─── Cost Approach Analysis ──────────────────────────────────────────────────
// Structured presentation of the stored workfile inputs:
// Replacement Cost New → supported depreciation/obsolescence → land input.

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, ValueCallout } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatPercent, formatSqFt, formatNumber } from '@/lib/templates/helpers';

function validPercent(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

export default function CostApproachTable({ data }: { data: ReportTemplateData }) {
  const { property } = data;

  const costApproachValue = property.cost_approach_value;
  const rcn = property.cost_approach_rcn;
  const physicalDepreciation = property.physical_depreciation_pct;

  if (
    costApproachValue == null ||
    !Number.isFinite(costApproachValue) ||
    costApproachValue <= 0 ||
    rcn == null ||
    !Number.isFinite(rcn) ||
    rcn <= 0 ||
    !validPercent(physicalDepreciation)
  ) {
    return null;
  }

  const functionalObsolescence = validPercent(property.functional_obsolescence_pct)
    ? property.functional_obsolescence_pct
    : 0;
  const totalDepreciation = Math.min(
    physicalDepreciation + functionalObsolescence,
    100
  );
  const depreciationAmount = rcn * (totalDepreciation / 100);
  const depreciatedImprovementValue = Math.max(0, rcn - depreciationAmount);
  const landValue =
    property.land_value != null &&
    Number.isFinite(property.land_value) &&
    property.land_value >= 0
      ? property.land_value
      : null;
  const recomputedValue = depreciatedImprovementValue + (landValue ?? 0);
  const reconciliationDifference = costApproachValue - recomputedValue;
  const reconciliationDifferencePct = recomputedValue > 0
    ? Math.abs(reconciliationDifference) / recomputedValue
    : 0;

  const buildingSqft = property.building_sqft_gross ?? property.building_sqft_living_area ?? null;
  const costPerSqft = buildingSqft != null && buildingSqft > 0
    ? rcn / buildingSqft
    : null;

  return (
    <View>
      <SectionHeader number="VII-E1" title="Cost Approach Calculation" />

      <Text style={[theme.bodyText, { marginBottom: 8 }]}>
        This exhibit presents the cost indication stored in the Resourceful workfile. Building area,
        replacement cost, quality, depreciation, obsolescence, and land inputs may originate from public
        records, third-party data, disclosed calculations, or clearly labeled assumptions. They are not
        represented as independent contractor estimates, engineering measurements, or licensed-appraiser
        observations unless the report expressly documents that source and review.
      </Text>

      <Text style={styles.subheading}>Replacement Cost New Input</Text>
      <View style={styles.computeTable}>
        {buildingSqft != null && buildingSqft > 0 && (
          <ComputeRow label="Building Area Used" value={formatSqFt(buildingSqft)} />
        )}
        {costPerSqft != null && costPerSqft > 0 && (
          <ComputeRow label="Implied Cost per Square Foot" value={`$${formatNumber(costPerSqft, 2)}/SF`} />
        )}
        {property.quality_grade && (
          <ComputeRow label="Quality Grade Input" value={capitalize(property.quality_grade)} />
        )}
        <ComputeRow label="Replacement Cost New Input" value={formatCurrency(rcn)} bold accent />
      </View>

      <Text style={[styles.subheading, { marginTop: 10 }]}>Depreciation & Obsolescence Inputs</Text>
      <View style={styles.computeTable}>
        {property.effective_age != null && (
          <ComputeRow label="Effective Age Input" value={`${property.effective_age} years`} />
        )}
        {property.remaining_economic_life != null && (
          <ComputeRow label="Remaining Economic Life Input" value={`${property.remaining_economic_life} years`} />
        )}
        <ComputeRow
          label="Physical Depreciation Input"
          value={`${formatPercent(physicalDepreciation)}   (${formatCurrency(rcn * physicalDepreciation / 100)})`}
        />
        {functionalObsolescence > 0 && (
          <ComputeRow
            label="Functional Obsolescence Input"
            value={`${formatPercent(functionalObsolescence)}   (${formatCurrency(rcn * functionalObsolescence / 100)})`}
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
          label="Combined Depreciation Used"
          value={`${formatPercent(totalDepreciation)}   (${formatCurrency(depreciationAmount)})`}
          bold
        />
      </View>

      <Text style={[styles.subheading, { marginTop: 10 }]}>Workfile Computation</Text>
      <View style={styles.computeTable}>
        <ComputeRow label="Replacement Cost New Input" value={formatCurrency(rcn)} />
        <ComputeRow label="Less: Combined Depreciation" value={`(${formatCurrency(depreciationAmount)})`} negative />
        <ComputeRow label="Depreciated Improvement Indication" value={formatCurrency(depreciatedImprovementValue)} bold />
        <ComputeRow
          label="Land Value Input"
          value={landValue != null ? formatCurrency(landValue) : 'Not separately available'}
        />
        <View style={styles.totalRow} wrap={false}>
          <Text style={styles.totalLabel}>Stored Cost Approach Indication</Text>
          <Text style={styles.totalValue}>{formatCurrency(costApproachValue)}</Text>
        </View>
      </View>

      {reconciliationDifferencePct > 0.01 && (
        <Text style={[theme.bodyText, { marginTop: 6 }]}>
          The stored cost indication differs from the arithmetic displayed above by{' '}
          {formatCurrency(Math.abs(reconciliationDifference))}. This may reflect an additional land,
          depreciation, rounding, or reconciliation input not represented in the structured fields and
          should be reviewed before relying on the indication.
        </Text>
      )}

      {landValue == null && (
        <Text style={[theme.bodyText, { marginTop: 6 }]}>
          No separate land value is stored in the structured workfile. The cost indication should not be
          treated as a complete market-value approach until the land component and its source are verified.
        </Text>
      )}

      <ValueCallout
        label="Workfile Cost Approach Indication"
        value={formatCurrency(costApproachValue)}
        color={colors.accent}
      />
    </View>
  );
}

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
    <View style={styles.row} wrap={false}>
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

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
