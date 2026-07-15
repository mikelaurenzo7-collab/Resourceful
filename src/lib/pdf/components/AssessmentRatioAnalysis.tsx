// ─── Assessment Level Context ─────────────────────────────────────────────────
// Renders the jurisdiction assessment level used to normalize raw assessment
// records to market-value terms. It deliberately does not compare a statutory
// fractional assessment level with ratio-study benchmarks; those are different
// metrics and require jurisdiction-specific source data.

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { theme } from '../styles/theme';
import { SectionHeader, DataTable } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatPercent } from '@/lib/templates/helpers';
import { getAssessorImpliedMarketValue } from '@/lib/dashboard/value-comparison';
import { resolveAssignmentKind } from '@/lib/assignments/routing';

function jurisdictionAssessmentLevel(data: ReportTemplateData): number | null {
  const { report, countyRule, property } = data;
  const propertyType = report.property_type;

  if (propertyType === 'commercial') {
    return countyRule?.assessment_ratio_commercial ?? property.assessment_ratio ?? null;
  }
  if (propertyType === 'industrial') {
    return countyRule?.assessment_ratio_industrial ?? property.assessment_ratio ?? null;
  }
  return countyRule?.assessment_ratio_residential ?? property.assessment_ratio ?? null;
}

export default function AssessmentRatioAnalysis({ data }: { data: ReportTemplateData }) {
  const { report, property, concludedValue } = data;
  const workfileAssessmentLevel = property.assessment_ratio;
  const jurisdictionLevel = jurisdictionAssessmentLevel(data);
  const rawAssessedValue = property.assessed_value;
  const assessorImpliedMarketValue = getAssessorImpliedMarketValue(
    rawAssessedValue,
    workfileAssessmentLevel ?? jurisdictionLevel
  );
  const assignmentKind = resolveAssignmentKind(report.service_type, report.desired_outcome);

  if (
    workfileAssessmentLevel == null &&
    jurisdictionLevel == null &&
    rawAssessedValue == null
  ) {
    return null;
  }

  const levelMismatch =
    workfileAssessmentLevel != null &&
    jurisdictionLevel != null &&
    Math.abs(workfileAssessmentLevel - jurisdictionLevel) > 0.0001;
  const valueGap =
    assessorImpliedMarketValue != null && concludedValue > 0
      ? assessorImpliedMarketValue - concludedValue
      : null;

  const rows: string[][] = [];
  if (rawAssessedValue != null && rawAssessedValue > 0) {
    rows.push(['Raw Assessed Value', formatCurrency(rawAssessedValue), 'Public-record assessment base']);
  }
  if (workfileAssessmentLevel != null && workfileAssessmentLevel > 0) {
    rows.push([
      'Assessment Level Applied in Workfile',
      formatPercent(workfileAssessmentLevel),
      'Used to normalize the raw assessment',
    ]);
  }
  if (jurisdictionLevel != null && jurisdictionLevel > 0) {
    rows.push([
      'Jurisdiction Reference Level',
      formatPercent(jurisdictionLevel),
      levelMismatch ? 'Differs from workfile level — verify source and tax year' : 'Reference from jurisdiction rule data',
    ]);
  }
  if (assessorImpliedMarketValue != null && assessorImpliedMarketValue > 0) {
    rows.push([
      'Assessor-Implied Market Value',
      formatCurrency(assessorImpliedMarketValue),
      'Raw assessment divided by the applied fractional level when below 100%',
    ]);
  }
  if (concludedValue > 0) {
    rows.push(['Resourceful Concluded Value', formatCurrency(concludedValue), 'Reconciled valuation conclusion']);
  }

  return (
    <View break>
      <SectionHeader number="X" title="Assessment Level Context" />

      <DataTable
        headers={['Metric', 'Value', 'Interpretation']}
        columnWidths={['35%', '23%', '42%']}
        rows={rows}
      />

      <Text style={[theme.bodyText, { marginTop: 8 }]}>
        Assessment level is a jurisdiction-specific conversion factor used to relate a raw assessed value
        to market-value terms. A fractional level such as 10% or 25% must not be evaluated against a generic
        90%–110% ratio-study range; those measurements serve different purposes. The applicable level, tax year,
        classification, and source should be verified directly with the jurisdiction before filing or relying on
        the normalized value.
      </Text>

      {levelMismatch && (
        <Text style={[theme.bodyText, { marginTop: 6 }]}>
          The workfile assessment level differs from the jurisdiction reference stored in the rule table. This
          report does not resolve that conflict automatically; the classification, source date, and governing
          assessment rule require verification.
        </Text>
      )}

      {assignmentKind === 'tax_appeal' && valueGap != null && valueGap > 0 && (
        <Text style={[theme.bodyText, { marginTop: 6 }]}>
          After normalization, the assessor-implied market value is {formatCurrency(valueGap)} above the
          Resourceful concluded value. This is a market-value comparison only—not an estimate of annual tax-dollar
          savings or proof that an appeal will be granted.
        </Text>
      )}
    </View>
  );
}
