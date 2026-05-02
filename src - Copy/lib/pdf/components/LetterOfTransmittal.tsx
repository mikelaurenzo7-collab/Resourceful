// ─── Letter of Transmittal ───────────────────────────────────────────────────
// Professional cover letter that precedes the report body.
// Standard in every professional appraisal report.

import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatDate, formatCurrency } from '@/lib/templates/helpers';

export default function LetterOfTransmittal({ data }: { data: ReportTemplateData }) {
  const { report, property, concludedValue } = data;
  const address = [report.property_address, report.city, report.state].filter(Boolean).join(', ');
  const clientName = report.client_name ?? report.client_email ?? 'Property Owner';
  const assessedValue = property.assessed_value ?? 0;

  const serviceDescriptions: Record<string, string> = {
    tax_appeal: 'property tax assessment appeal',
    pre_purchase: 'pre-purchase property analysis',
    pre_listing: 'pre-listing property analysis',
  };
  const servicePurpose = serviceDescriptions[report.service_type] ?? 'property analysis';

  return (
    <Page size="LETTER" style={theme.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>RESOURCEFUL</Text>
        <View style={styles.accentRule} />
        <Text style={[theme.caption, { marginTop: 4 }]}>Property Tax Intelligence &amp; Assessment Analysis</Text>
      </View>

      {/* Date */}
      <Text style={[theme.bodyText, { marginTop: 32 }]}>
        {formatDate(data.reportDate)}
      </Text>

      {/* Addressee */}
      <View style={{ marginTop: 16 }}>
        <Text style={theme.bodyText}>{clientName}</Text>
        <Text style={theme.bodyText}>RE: {address}</Text>
      </View>

      {/* Salutation */}
      <Text style={[theme.bodyText, { marginTop: 16 }]}>
        Dear {clientName.split(' ')[0] ?? 'Property Owner'},
      </Text>

      {/* Body */}
      <Text style={[theme.bodyText, { marginTop: 12 }]}>
        At your request, we have prepared this independent market value analysis of the above-referenced
        property for the purpose of supporting a {servicePurpose}. The effective date of
        this analysis is {formatDate(data.valuationDate)}.
      </Text>

      <Text style={[theme.bodyText, { marginTop: 8 }]}>
        Based on our analysis of comparable sales, property condition, market trends, and
        applicable valuation approaches, we have concluded a market value of{' '}
        <Text style={{ fontWeight: 600, color: colors.accent }}>{formatCurrency(concludedValue)}</Text>
        {assessedValue > concludedValue && (
          <Text>
            , which is{' '}
            <Text style={{ fontWeight: 600, color: colors.red }}>
              {formatCurrency(assessedValue - concludedValue)}
            </Text>
            {' '}below the current assessed value of {formatCurrency(assessedValue)}
          </Text>
        )}.
      </Text>

      {/* Scope of Work */}
      <Text style={[theme.headingMD, { marginTop: 20 }]}>Scope of Work</Text>
      <Text style={[theme.bodyText, { marginTop: 4 }]}>
        This analysis was conducted in accordance with IAAO (International Association of
        Assessing Officers) standards for mass appraisal review. The scope included:
      </Text>
      <View style={styles.bulletList}>
        <Text style={theme.bodyText}>• Collection and verification of property data from public records and proprietary databases</Text>
        <Text style={theme.bodyText}>• Selection and analysis of comparable sales within the subject&apos;s market area</Text>
        <Text style={theme.bodyText}>• Calculation of line-item adjustments for differences in property characteristics</Text>
        {property.photo_count > 0 && (
          <Text style={theme.bodyText}>• Analysis of {property.photo_count} property photographs for condition assessment</Text>
        )}
        {property.cost_approach_value != null && (
          <Text style={theme.bodyText}>• Cost approach analysis including replacement cost, depreciation, and land value</Text>
        )}
        {data.incomeAnalysis && (
          <Text style={theme.bodyText}>• Income capitalization approach using market rental comparables and direct capitalization</Text>
        )}
        <Text style={theme.bodyText}>• Reconciliation of value indications and assessment equity analysis</Text>
      </View>

      {/* Assumptions */}
      <Text style={[theme.headingMD, { marginTop: 16 }]}>Assumptions &amp; Limiting Conditions</Text>
      <Text style={[theme.bodyText, { marginTop: 4 }]}>
        This analysis assumes the property is free of environmental contamination, structural
        deficiency not evident in the provided documentation, and any adverse conditions not
        disclosed or discoverable through reasonable due diligence. The complete statement
        of limiting conditions and certification appears at the end of this report.
      </Text>

      {/* Interest appraised */}
      <Text style={[theme.headingMD, { marginTop: 16 }]}>Property Interest Analyzed</Text>
      <Text style={[theme.bodyText, { marginTop: 4 }]}>
        Fee simple estate. This analysis does not consider the impact of any existing
        leases, encumbrances, or liens unless specifically noted.
      </Text>

      {/* Closing */}
      <Text style={[theme.bodyText, { marginTop: 20 }]}>
        This report and its conclusions are subject to the assumptions and limiting conditions
        set forth herein. We appreciate the opportunity to be of service.
      </Text>

      <Text style={[theme.bodyText, { marginTop: 20 }]}>
        Respectfully submitted,
      </Text>
      <Text style={[theme.bodyText, { marginTop: 12, fontWeight: 600 }]}>
        Resourceful Property Intelligence
      </Text>

      {/* Footer marker */}
      <View style={styles.bottomAccent} />
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 0,
  },
  wordmark: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 20,
    color: colors.inkPrimary,
    letterSpacing: 2,
  },
  accentRule: {
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    marginTop: 4,
    width: '100%',
  },
  bulletList: {
    marginTop: 4,
    paddingLeft: 8,
    gap: 2,
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 36,
    left: 54,
    right: 54,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
  },
});
