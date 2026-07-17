// ─── Income Capitalization Approach ──────────────────────────────────────────
// Presents stored income-approach workfile inputs without manufacturing
// completeness from missing NOI, capitalization-rate, or source fields.

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, NarrativeBlock, DataTable, ValueCallout } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatPercent, formatSqFt, formatDateShort } from '@/lib/templates/helpers';
import { findNarrativeContent } from '@/lib/report-narratives';
import {
  evaluateIncomeApproachEvidence,
  isVerifiableDate,
} from '@/lib/valuation/income-approach-policy';
import { supportsIncomeApproach } from '@/lib/valuation/property-type-policy';

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return isFiniteNumber(value) && value > 0;
}

export default function IncomeApproachTable({ data }: { data: ReportTemplateData }) {
  const { incomeAnalysis, comparableRentals, narratives, report, property } = data;

  const isIncomeProperty = supportsIncomeApproach({
    propertyType: report.property_type,
    propertySubtype: property.property_subtype,
    propertyClassDescription: property.property_class_description,
  });
  if (!isIncomeProperty || !incomeAnalysis) return null;

  const isTaxAppeal = report.service_type === 'tax_appeal';
  const incomeNarrative = findNarrativeContent(narratives, 'income_approach_narrative');
  const incomeEvidence = evaluateIncomeApproachEvidence({
    netOperatingIncome: incomeAnalysis.net_operating_income,
    concludedCapRate: incomeAnalysis.concluded_cap_rate,
    concludedValue: incomeAnalysis.concluded_value_income_approach,
  });
  const surveyReference = incomeAnalysis.investor_survey_reference?.trim() || null;
  const hasCapRateEvidence =
    isPositiveFinite(incomeAnalysis.concluded_cap_rate) ||
    isPositiveFinite(incomeAnalysis.cap_rate_market_low) ||
    isPositiveFinite(incomeAnalysis.cap_rate_market_high) ||
    isPositiveFinite(incomeAnalysis.cap_rate_investor_survey_avg) ||
    surveyReference != null;

  const missingCoreInputs = [
    !isPositiveFinite(incomeAnalysis.net_operating_income) ? 'positive net operating income' : null,
    !isPositiveFinite(incomeAnalysis.concluded_cap_rate) ? 'positive capitalization rate' : null,
    !isPositiveFinite(incomeAnalysis.concluded_value_income_approach) ? 'positive stored income indication' : null,
  ].filter((value): value is string => value != null);

  return (
    <View break>
      <SectionHeader number="XII" title="Income Capitalization Approach" />

      <Text style={[theme.bodyText, { marginBottom: 8 }]}>
        This section presents income, expense, rental, and capitalization-rate inputs stored in the
        Resourceful workfile. The inputs may originate from public records, third-party data, disclosed
        calculations, or clearly labeled assumptions. They are not represented as independently verified
        leases, operating statements, or investor-survey conclusions unless the report identifies that
        source and review.
      </Text>

      {comparableRentals.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.subheading}>Comparable Rental Survey</Text>
          <DataTable
            headers={['Address', 'Lease Date', 'SF Leased', 'Rent/SF/Yr', 'Lease Type', 'Eff. Net Rent']}
            columnWidths={['25%', '12%', '13%', '13%', '14%', '14%']}
            numericColumns={[2, 3, 5]}
            rows={comparableRentals.map((r) => [
              r.address ? (r.address.length > 28 ? r.address.slice(0, 26) + '…' : r.address) : '—',
              isVerifiableDate(r.lease_date) ? formatDateShort(r.lease_date) : 'Unverified',
              isPositiveFinite(r.building_sqft_leased)
                ? formatSqFt(r.building_sqft_leased).replace(' SF', '')
                : '—',
              isPositiveFinite(r.rent_per_sqft_yr) ? `$${r.rent_per_sqft_yr.toFixed(2)}` : '—',
              r.lease_type ?? '—',
              isPositiveFinite(r.effective_net_rent_per_sqft)
                ? `$${r.effective_net_rent_per_sqft.toFixed(2)}`
                : '—',
            ])}
          />
          {isPositiveFinite(incomeAnalysis.concluded_market_rent_per_sqft_yr) && (
            <Text style={[theme.caption, { marginTop: 4 }]}>
              Stored Market Rent Conclusion: ${incomeAnalysis.concluded_market_rent_per_sqft_yr.toFixed(2)}/SF/Year
            </Text>
          )}
          <Text style={[theme.caption, { marginTop: 4, color: colors.inkMuted }]}>
            Rental entries should be independently confirmed for execution date, leased area, concessions,
            lease structure, and source before being treated as verified market evidence.
          </Text>
        </View>
      )}

      <Text style={styles.subheading}>Pro Forma Income Statement</Text>
      <View style={styles.computeTable}>
        {isFiniteNumber(incomeAnalysis.potential_gross_income) && (
          <ComputeRow label="Potential Gross Income Input" value={formatCurrency(incomeAnalysis.potential_gross_income)} />
        )}
        {isFiniteNumber(incomeAnalysis.vacancy_rate_pct) && isFiniteNumber(incomeAnalysis.vacancy_amount) && (
          <ComputeRow
            label={`Less: Vacancy & Collection Loss (${formatPercent(incomeAnalysis.vacancy_rate_pct)})`}
            value={`(${formatCurrency(incomeAnalysis.vacancy_amount)})`}
            negative
          />
        )}
        {isFiniteNumber(incomeAnalysis.effective_gross_income) && (
          <ComputeRow label="Effective Gross Income Input" value={formatCurrency(incomeAnalysis.effective_gross_income)} bold />
        )}

        {isPositiveFinite(incomeAnalysis.expense_nnn_during_vacancy) && (
          <ComputeRow label="  NNN Expenses During Vacancy" value={`(${formatCurrency(incomeAnalysis.expense_nnn_during_vacancy)})`} negative indent />
        )}
        {isPositiveFinite(incomeAnalysis.expense_legal_professional) && (
          <ComputeRow label="  Legal & Professional" value={`(${formatCurrency(incomeAnalysis.expense_legal_professional)})`} negative indent />
        )}
        {isPositiveFinite(incomeAnalysis.expense_utilities_common) && (
          <ComputeRow label="  Utilities & Common Area" value={`(${formatCurrency(incomeAnalysis.expense_utilities_common)})`} negative indent />
        )}
        {isPositiveFinite(incomeAnalysis.expense_reserves) && (
          <ComputeRow label="  Replacement Reserves" value={`(${formatCurrency(incomeAnalysis.expense_reserves)})`} negative indent />
        )}
        {isPositiveFinite(incomeAnalysis.expense_repairs_maintenance) && (
          <ComputeRow label="  Repairs & Maintenance" value={`(${formatCurrency(incomeAnalysis.expense_repairs_maintenance)})`} negative indent />
        )}
        {isFiniteNumber(incomeAnalysis.total_expenses) && (
          <ComputeRow
            label={`Total Expenses${
              isPositiveFinite(incomeAnalysis.expense_ratio_pct)
                ? ` (${formatPercent(incomeAnalysis.expense_ratio_pct)} OER)`
                : ''
            }`}
            value={`(${formatCurrency(incomeAnalysis.total_expenses)})`}
            bold
            negative
          />
        )}

        {isPositiveFinite(incomeAnalysis.net_operating_income) && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net Operating Income Input</Text>
            <Text style={styles.totalValue}>{formatCurrency(incomeAnalysis.net_operating_income)}</Text>
          </View>
        )}
      </View>

      {isTaxAppeal && (
        <View style={styles.taxTreatmentBox} wrap={false}>
          <Text style={styles.taxTreatmentTitle}>Real estate tax treatment - appeal release gate</Text>
          <Text style={styles.taxTreatmentText}>
            The structured Resourceful workfile does not currently identify a separate real estate tax
            expense, tax-load factor, or loaded capitalization rate. Before this income indication is used
            as appeal evidence, the reviewer must document whether real estate taxes are included in the
            stabilized expenses. If taxes are excluded, a supported tax-load factor and loaded capitalization
            rate must be shown. If taxes are included, the sourced tax expense must be identified and the
            selected unloaded market capitalization rate must be applied consistently. Until that treatment
            is resolved, the indication is analytical support rather than appeal-ready income evidence.
          </Text>
        </View>
      )}

      {hasCapRateEvidence && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.subheading}>Capitalization Rate Analysis</Text>
          <View style={styles.computeTable}>
            {isPositiveFinite(incomeAnalysis.cap_rate_market_low) &&
              isPositiveFinite(incomeAnalysis.cap_rate_market_high) && (
                <ComputeRow
                  label="Stored Market Cap Rate Range"
                  value={`${formatPercent(incomeAnalysis.cap_rate_market_low)} – ${formatPercent(incomeAnalysis.cap_rate_market_high)}`}
                />
              )}
            {isPositiveFinite(incomeAnalysis.cap_rate_investor_survey_avg) && (
              <ComputeRow
                label="Stored Investor Survey Average"
                value={formatPercent(incomeAnalysis.cap_rate_investor_survey_avg)}
              />
            )}
            <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
              <Text style={[theme.caption, { fontStyle: 'italic' }]}>
                {surveyReference
                  ? `Identified source: ${surveyReference}`
                  : 'No independent investor-survey source is identified in the structured workfile.'}
              </Text>
            </View>
            {isPositiveFinite(incomeAnalysis.concluded_cap_rate) && (
              <ComputeRow
                label="Stored Capitalization Rate Conclusion"
                value={formatPercent(incomeAnalysis.concluded_cap_rate)}
                bold
                accent
              />
            )}
          </View>
        </View>
      )}

      {incomeEvidence.hasCompleteInputs && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.subheading}>Income Approach Computation</Text>
          <View style={styles.computeTable}>
            <ComputeRow
              label="Net Operating Income Input"
              value={formatCurrency(incomeAnalysis.net_operating_income as number)}
            />
            <ComputeRow
              label="Divided by: Stored Cap Rate"
              value={formatPercent(incomeAnalysis.concluded_cap_rate as number)}
            />
            <ComputeRow
              label="Arithmetic NOI ÷ Cap Rate"
              value={formatCurrency(incomeEvidence.calculatedValue as number)}
            />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Stored Income Approach Indication</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(incomeEvidence.storedValue as number)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {incomeEvidence.materiallyUnreconciled && (
        <Text style={[theme.bodyText, { marginTop: 6 }]}>
          The stored income indication differs from NOI divided by the stored capitalization rate by{' '}
          {formatCurrency(Math.abs(incomeEvidence.reconciliationDifference ?? 0))}. The discrepancy should
          be reconciled to rounding or an additional documented input before relying on the indication.
        </Text>
      )}

      {!incomeEvidence.hasCompleteInputs && incomeEvidence.storedValue != null && (
        <Text style={[theme.bodyText, { marginTop: 8 }]}>
          A stored income indication of {formatCurrency(incomeEvidence.storedValue)} exists, but this report
          does not present it as a completed income approach because the structured workfile is missing:
          {' '}{missingCoreInputs.join(', ')}.
        </Text>
      )}

      {incomeNarrative && <NarrativeBlock content={incomeNarrative} />}

      {incomeEvidence.hasCompleteInputs && incomeEvidence.storedValue != null && (
        <ValueCallout
          label="Stored Income Approach Indication"
          value={formatCurrency(incomeEvidence.storedValue)}
          color={colors.accent}
        />
      )}
    </View>
  );
}

function ComputeRow({
  label,
  value,
  bold,
  accent,
  negative,
  indent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
  negative?: boolean;
  indent?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold ? { fontWeight: 600 } : {}, indent ? { paddingLeft: 8 } : {}]}>
        {label}
      </Text>
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
  taxTreatmentBox: {
    marginTop: 9,
    padding: 8,
    backgroundColor: colors.calloutBg,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  taxTreatmentTitle: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 8,
    color: colors.inkPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  taxTreatmentText: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    color: colors.inkMuted,
    lineHeight: 1.4,
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
