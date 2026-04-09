// ─── Income Capitalization Approach ──────────────────────────────────────────
// Structured presentation of the income approach:
// Rental Comparable Grid → Pro Forma Income Statement → Cap Rate Analysis
// → Indicated Value by Income Approach

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, NarrativeBlock, DataTable, ValueCallout } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatPercent, formatSqFt, formatDateShort } from '@/lib/templates/helpers';

export default function IncomeApproachTable({ data }: { data: ReportTemplateData }) {
  const { incomeAnalysis, comparableRentals, narratives, report } = data;

  // Guard: only render for commercial/industrial with income data
  const isIncomeProperty = report.property_type === 'commercial' || report.property_type === 'industrial';
  if (!isIncomeProperty || !incomeAnalysis) return null;

  const incomeNarrative = narratives.find(n => n.section_name === 'income_approach');

  return (
    <View break>
      <SectionHeader number="XII" title="Income Capitalization Approach" />

      <Text style={[theme.bodyText, { marginBottom: 8 }]}>
        The Income Capitalization Approach converts the anticipated income stream from a property
        into an indication of value, using currently applicable market-derived rates.
      </Text>

      {/* Rental Comparables Grid */}
      {comparableRentals.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.subheading}>Comparable Rental Survey</Text>
          <DataTable
            headers={['Address', 'Lease Date', 'SF Leased', 'Rent/SF/Yr', 'Lease Type', 'Eff. Net Rent']}
            columnWidths={['25%', '12%', '13%', '13%', '14%', '14%']}
            numericColumns={[2, 3, 5]}
            rows={comparableRentals.map(r => [
              r.address ? (r.address.length > 28 ? r.address.slice(0, 26) + '…' : r.address) : '—',
              r.lease_date ? formatDateShort(r.lease_date) : '—',
              r.building_sqft_leased ? formatSqFt(r.building_sqft_leased).replace(' SF', '') : '—',
              r.rent_per_sqft_yr ? `$${r.rent_per_sqft_yr.toFixed(2)}` : '—',
              r.lease_type ?? '—',
              r.effective_net_rent_per_sqft ? `$${r.effective_net_rent_per_sqft.toFixed(2)}` : '—',
            ])}
          />
          {incomeAnalysis.concluded_market_rent_per_sqft_yr && (
            <Text style={[theme.caption, { marginTop: 4 }]}>
              Concluded Market Rent: ${incomeAnalysis.concluded_market_rent_per_sqft_yr.toFixed(2)}/SF/Year
            </Text>
          )}
        </View>
      )}

      {/* Pro Forma Income Statement */}
      <Text style={styles.subheading}>Pro Forma Income Statement</Text>
      <View style={styles.computeTable}>
        {incomeAnalysis.potential_gross_income != null && (
          <ComputeRow label="Potential Gross Income" value={formatCurrency(incomeAnalysis.potential_gross_income)} />
        )}
        {incomeAnalysis.vacancy_rate_pct != null && incomeAnalysis.vacancy_amount != null && (
          <ComputeRow
            label={`Less: Vacancy & Collection Loss (${formatPercent(incomeAnalysis.vacancy_rate_pct)})`}
            value={`(${formatCurrency(incomeAnalysis.vacancy_amount)})`}
            negative
          />
        )}
        {incomeAnalysis.effective_gross_income != null && (
          <ComputeRow label="Effective Gross Income" value={formatCurrency(incomeAnalysis.effective_gross_income)} bold />
        )}

        {/* Operating Expenses */}
        {incomeAnalysis.expense_nnn_during_vacancy != null && incomeAnalysis.expense_nnn_during_vacancy > 0 && (
          <ComputeRow label="  NNN Expenses During Vacancy" value={`(${formatCurrency(incomeAnalysis.expense_nnn_during_vacancy)})`} negative indent />
        )}
        {incomeAnalysis.expense_legal_professional != null && incomeAnalysis.expense_legal_professional > 0 && (
          <ComputeRow label="  Legal & Professional" value={`(${formatCurrency(incomeAnalysis.expense_legal_professional)})`} negative indent />
        )}
        {incomeAnalysis.expense_utilities_common != null && incomeAnalysis.expense_utilities_common > 0 && (
          <ComputeRow label="  Utilities & Common Area" value={`(${formatCurrency(incomeAnalysis.expense_utilities_common)})`} negative indent />
        )}
        {incomeAnalysis.expense_reserves != null && incomeAnalysis.expense_reserves > 0 && (
          <ComputeRow label="  Replacement Reserves" value={`(${formatCurrency(incomeAnalysis.expense_reserves)})`} negative indent />
        )}
        {incomeAnalysis.expense_repairs_maintenance != null && incomeAnalysis.expense_repairs_maintenance > 0 && (
          <ComputeRow label="  Repairs & Maintenance" value={`(${formatCurrency(incomeAnalysis.expense_repairs_maintenance)})`} negative indent />
        )}
        {incomeAnalysis.total_expenses != null && (
          <ComputeRow
            label={`Total Expenses${incomeAnalysis.expense_ratio_pct ? ` (${formatPercent(incomeAnalysis.expense_ratio_pct)} OER)` : ''}`}
            value={`(${formatCurrency(incomeAnalysis.total_expenses)})`}
            bold
            negative
          />
        )}

        {/* NOI */}
        {incomeAnalysis.net_operating_income != null && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net Operating Income</Text>
            <Text style={styles.totalValue}>{formatCurrency(incomeAnalysis.net_operating_income)}</Text>
          </View>
        )}
      </View>

      {/* Capitalization Rate Analysis */}
      {incomeAnalysis.concluded_cap_rate != null && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.subheading}>Capitalization Rate Analysis</Text>
          <View style={styles.computeTable}>
            {incomeAnalysis.cap_rate_market_low != null && incomeAnalysis.cap_rate_market_high != null && (
              <ComputeRow
                label="Market Cap Rate Range"
                value={`${formatPercent(incomeAnalysis.cap_rate_market_low)} – ${formatPercent(incomeAnalysis.cap_rate_market_high)}`}
              />
            )}
            {incomeAnalysis.cap_rate_investor_survey_avg != null && (
              <ComputeRow
                label="Investor Survey Average"
                value={formatPercent(incomeAnalysis.cap_rate_investor_survey_avg)}
              />
            )}
            {incomeAnalysis.investor_survey_reference && (
              <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
                <Text style={[theme.caption, { fontStyle: 'italic' }]}>
                  Source: {incomeAnalysis.investor_survey_reference}
                </Text>
              </View>
            )}
            <ComputeRow
              label="Concluded Capitalization Rate"
              value={formatPercent(incomeAnalysis.concluded_cap_rate)}
              bold
              accent
            />
          </View>
        </View>
      )}

      {/* Final Computation */}
      {incomeAnalysis.concluded_value_income_approach != null && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.subheading}>Income Approach Computation</Text>
          <View style={styles.computeTable}>
            <ComputeRow
              label="Net Operating Income"
              value={formatCurrency(incomeAnalysis.net_operating_income ?? 0)}
            />
            <ComputeRow
              label="Divided by: Cap Rate"
              value={formatPercent(incomeAnalysis.concluded_cap_rate ?? 0)}
            />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Indicated Value by Income Approach</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(incomeAnalysis.concluded_value_income_approach)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Narrative */}
      {incomeNarrative && <NarrativeBlock content={incomeNarrative.content} />}

      {incomeAnalysis.concluded_value_income_approach != null && (
        <ValueCallout
          label="Income Approach Indication"
          value={formatCurrency(incomeAnalysis.concluded_value_income_approach)}
          color={colors.accent}
        />
      )}
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
