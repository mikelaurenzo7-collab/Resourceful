// ─── Cost Approach Analysis ──────────────────────────────────────────────────
// Structured presentation of release-ready workfile inputs:
// Replacement Cost New → supported depreciation/obsolescence → sourced land.

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, ValueCallout } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import {
  formatCurrency,
  formatDateShort,
  formatPercent,
  formatSqFt,
  formatNumber,
} from '@/lib/templates/helpers';
import { getReportCostAssessment } from '../section-data';

export default function CostApproachTable({ data }: { data: ReportTemplateData }) {
  const { property } = data;
  const assessment = getReportCostAssessment(data);
  const {
    concludedValue: costApproachValue,
    replacementCostNew: rcn,
    physicalDepreciationPct: physicalDepreciation,
    functionalObsolescencePct: functionalObsolescence,
    totalDepreciationPct: totalDepreciation,
    landValue,
    recomputedValue,
    replacementCostSourceAuthority,
    depreciationSourceAuthority,
    landValueSourceAuthority,
    sourceReferences,
    methodology,
    costEffectiveDate,
    verifiedBy,
    verifiedAt,
  } = assessment;

  if (
    !assessment.isReleaseReady ||
    costApproachValue == null ||
    rcn == null ||
    physicalDepreciation == null ||
    totalDepreciation == null ||
    landValue == null ||
    recomputedValue == null ||
    replacementCostSourceAuthority == null ||
    depreciationSourceAuthority == null ||
    landValueSourceAuthority == null ||
    sourceReferences == null ||
    methodology == null ||
    costEffectiveDate == null ||
    verifiedBy == null ||
    verifiedAt == null
  ) {
    return null;
  }

  const depreciationAmount = rcn * (totalDepreciation / 100);
  const depreciatedImprovementValue = Math.max(0, rcn - depreciationAmount);
  const buildingSqft = property.building_sqft_gross ?? property.building_sqft_living_area ?? null;
  const costPerSqft = buildingSqft != null && buildingSqft > 0
    ? rcn / buildingSqft
    : null;
  const referenceCount = Object.keys(sourceReferences).length;

  return (
    <View>
      <SectionHeader number="VII-E1" title="Cost Approach Calculation" />

      <Text style={[theme.bodyText, { marginBottom: 8 }]}>
        This exhibit presents the independently verified cost indication retained in the Resourceful
        workfile. Replacement cost, depreciation, obsolescence, land value, source provenance, and
        effective date must be complete and must reconcile arithmetically before this method may
        support the final conclusion.
      </Text>

      <Text style={styles.subheading}>Cost Evidence Provenance</Text>
      <View style={styles.computeTable}>
        <ComputeRow label="Replacement-Cost Source" value={replacementCostSourceAuthority} />
        <ComputeRow label="Depreciation / Obsolescence Source" value={depreciationSourceAuthority} />
        <ComputeRow label="Land-Value Source" value={landValueSourceAuthority} />
        <ComputeRow label="Cost Evidence Effective Date" value={formatDateShort(costEffectiveDate)} />
        <ComputeRow label="Methodology" value={methodology} />
        <ComputeRow
          label="Structured Source References"
          value={`${referenceCount} workfile reference${referenceCount === 1 ? '' : 's'} retained`}
        />
        <ComputeRow label="Verified By" value={verifiedBy} />
        <ComputeRow label="Verification Timestamp" value={formatDateShort(verifiedAt)} />
      </View>

      <Text style={[styles.subheading, { marginTop: 10 }]}>Replacement Cost New Input</Text>
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
        <ComputeRow label="Sourced Land Value Input" value={formatCurrency(landValue)} />
        <ComputeRow label="Recomputed Cost Indication" value={formatCurrency(recomputedValue)} bold />
        <View style={styles.totalRow} wrap={false}>
          <Text style={styles.totalLabel}>Stored Cost Approach Indication</Text>
          <Text style={styles.totalValue}>{formatCurrency(costApproachValue)}</Text>
        </View>
      </View>

      <ValueCallout
        label="Verified Cost Approach Indication"
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
    width: '34%',
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 8,
    color: colors.inkBody,
  },
  rowValue: {
    width: '64%',
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 8,
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
