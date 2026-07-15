// ─── Letter of Transmittal ───────────────────────────────────────────────────
// Professional cover letter that precedes the report body.

import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatDate, formatCurrency } from '@/lib/templates/helpers';
import {
  getAssignmentDisplayLabel,
  resolveAssignmentKind,
  stripIndependentValuationMarker,
} from '@/lib/assignments/routing';
import { getAssessorImpliedMarketValue } from '@/lib/dashboard/value-comparison';

function assignmentPurpose(data: ReportTemplateData): string {
  const { report } = data;
  const assignmentKind = resolveAssignmentKind(report.service_type, report.desired_outcome);

  switch (assignmentKind) {
    case 'tax_appeal':
      return 'evaluating the current property assessment and preparing a factually supportable appeal strategy when warranted';
    case 'pre_purchase':
      return 'supporting acquisition due diligence, pricing analysis, and negotiation decisions';
    case 'pre_listing':
      return 'supporting listing preparation, pricing analysis, and property-positioning decisions';
    case 'independent_valuation': {
      const purpose = stripIndependentValuationMarker(report.desired_outcome);
      return purpose
        ? `supporting the defined independent valuation purpose: ${purpose}`
        : 'supporting the defined independent valuation purpose documented in this report';
    }
  }
}

export default function LetterOfTransmittal({ data }: { data: ReportTemplateData }) {
  const { report, property, concludedValue } = data;
  const address = [report.property_address, report.city, report.state].filter(Boolean).join(', ');
  const clientName = report.client_name ?? report.client_email ?? 'Property Owner';
  const assignmentKind = resolveAssignmentKind(report.service_type, report.desired_outcome);
  const assignmentLabel = getAssignmentDisplayLabel(report.service_type, report.desired_outcome);
  const assessorReferenceValue = getAssessorImpliedMarketValue(
    property.assessed_value,
    property.assessment_ratio
  );
  const marketValueGap =
    assessorReferenceValue != null && assessorReferenceValue > concludedValue
      ? assessorReferenceValue - concludedValue
      : null;

  return (
    <Page size="LETTER" style={theme.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>RESOURCEFUL</Text>
        <View style={styles.accentRule} />
        <Text style={[theme.caption, { marginTop: 4 }]}>Property Valuation &amp; Assessment Intelligence</Text>
      </View>

      {/* Date */}
      <Text style={[theme.bodyText, { marginTop: 32 }]}>
        {formatDate(data.reportDate)}
      </Text>

      {/* Addressee */}
      <View style={{ marginTop: 16 }}>
        <Text style={theme.bodyText}>{clientName}</Text>
        <Text style={theme.bodyText}>RE: {address}</Text>
        <Text style={theme.bodyText}>Assignment: {assignmentLabel}</Text>
      </View>

      {/* Salutation */}
      <Text style={[theme.bodyText, { marginTop: 16 }]}>
        Dear {clientName.split(' ')[0] ?? 'Property Owner'},
      </Text>

      {/* Body */}
      <Text style={[theme.bodyText, { marginTop: 12 }]}>
        At your request, Resourceful prepared the enclosed AI-assisted property valuation analysis for the purpose of{' '}
        {assignmentPurpose(data)}. The valuation date used by the workfile is {formatDate(data.valuationDate)}.
      </Text>

      <Text style={[theme.bodyText, { marginTop: 8 }]}>
        Based on the records, calculations, property evidence, and valuation approaches documented in the report,
        the workfile concludes a market value of{' '}
        <Text style={{ fontWeight: 600, color: colors.accent }}>{formatCurrency(concludedValue)}</Text>.
        {assignmentKind === 'tax_appeal' && marketValueGap != null && (
          <Text>
            {' '}The jurisdiction-normalized assessor reference is {formatCurrency(assessorReferenceValue!)},
            which is {formatCurrency(marketValueGap)} above the concluded value. This difference is a market-value
            gap, not an estimate of annual tax-dollar savings.
          </Text>
        )}
      </Text>

      {/* Scope of Work */}
      <Text style={[theme.headingMD, { marginTop: 20 }]}>Scope of Work</Text>
      <Text style={[theme.bodyText, { marginTop: 4 }]}>
        The analysis uses the public records, third-party data, user-submitted information, calculations, photographs,
        and assumptions identified in the report. The scope included the applicable items below:
      </Text>
      <View style={styles.bulletList}>
        <Text style={theme.bodyText}>• Collection and organization of property, parcel, assessment, and location data from the sources cited in the workfile</Text>
        {data.comparableSales.length > 0 && (
          <Text style={theme.bodyText}>• Selection, screening, and reconciliation of {data.comparableSales.length} documented comparable sale{data.comparableSales.length === 1 ? '' : 's'}</Text>
        )}
        {property.photo_count > 0 && (
          <Text style={theme.bodyText}>• Organization of {property.photo_count} submitted property photograph{property.photo_count === 1 ? '' : 's'} as visible condition evidence</Text>
        )}
        {property.cost_approach_value != null && property.cost_approach_value > 0 && (
          <Text style={theme.bodyText}>• Cost approach analysis using the replacement-cost, depreciation, and land-value inputs disclosed in the report</Text>
        )}
        {data.incomeAnalysis && (
          <Text style={theme.bodyText}>• Income capitalization analysis using the income, expense, rental, and capitalization inputs disclosed in the report</Text>
        )}
        {assignmentKind === 'tax_appeal' && (
          <Text style={theme.bodyText}>• Assessment-ratio, record-correction, and equity analysis where sufficient jurisdiction data was available</Text>
        )}
        <Text style={theme.bodyText}>• Reconciliation of the supported value indications, contrary evidence, assumptions, and data limitations</Text>
      </View>

      {/* Assumptions */}
      <Text style={[theme.headingMD, { marginTop: 16 }]}>Assumptions &amp; Limiting Conditions</Text>
      <Text style={[theme.bodyText, { marginTop: 4 }]}>
        No physical inspection, engineering diagnosis, environmental assessment, title examination, legal analysis,
        or concealed-condition investigation is implied unless the report expressly documents that work. Photographs
        support only visible observations. Owner statements and third-party records remain attributed to their sources,
        and material unknowns should be verified by the appropriate qualified professional.
      </Text>

      {/* Interest analyzed */}
      <Text style={[theme.headingMD, { marginTop: 16 }]}>Property Interest Analyzed</Text>
      <Text style={[theme.bodyText, { marginTop: 4 }]}>
        Unless the assignment-and-scope section expressly states otherwise, the analysis assumes fee simple interest
        solely for valuation modeling. This assumption is not a legal conclusion regarding title, leases, liens,
        encumbrances, ownership rights, or the acceptability of the report for a court, lender, insurer, taxing agency,
        or other third party.
      </Text>

      {/* Closing */}
      <Text style={[theme.bodyText, { marginTop: 20 }]}>
        This is an AI-assisted valuation work product subject to the stated evidence, assumptions, effective-date limits,
        and review tier. It is not a signed, certified, licensed, lender-ready, court-admissible, or USPAP-compliant
        appraisal unless a qualified appraiser reviews, signs, and assumes responsibility for the assignment.
      </Text>

      <Text style={[theme.bodyText, { marginTop: 16 }]}>Respectfully submitted,</Text>
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
