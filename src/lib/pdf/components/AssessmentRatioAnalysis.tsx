// ─── Assessment Context ──────────────────────────────────────────────────────
// Separates statutory assessment level, market-value normalization, and any
// year-specific equalization factor. These are different jurisdiction metrics.

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, DataTable } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency, formatDate, formatPercent } from '@/lib/templates/helpers';
import { getAssessorImpliedMarketValue } from '@/lib/dashboard/value-comparison';
import { resolveAssignmentKind } from '@/lib/assignments/routing';
import { evaluateAssessmentContext } from '@/lib/valuation/assessment-context-policy';
import { getClassificationSourceEvidence } from '@/lib/valuation/workfile-provenance';

export default function AssessmentRatioAnalysis({ data }: { data: ReportTemplateData }) {
  const { report, property, countyRule, concludedValue } = data;
  const assignmentKind = resolveAssignmentKind(report.service_type, report.desired_outcome);
  const releaseServiceType = assignmentKind === 'tax_appeal'
    ? 'tax_appeal'
    : assignmentKind === 'pre_listing'
      ? 'pre_listing'
      : 'pre_purchase';
  const classificationSource = getClassificationSourceEvidence(data);
  const assessmentContext = evaluateAssessmentContext({
    serviceType: releaseServiceType,
    countyFips: report.county_fips,
    propertyType: report.property_type,
    taxYearInAppeal: property.tax_year_in_appeal,
    valuationDate: data.valuationDate,
    assessmentRatio: property.assessment_ratio,
    assessmentMethodology: property.assessment_methodology,
    propertyClassDescription: property.property_class_description,
    classificationSourceAuthority: classificationSource.authority,
    classificationSourceUrl: classificationSource.url,
    countyRule,
  });
  const appliedAssessmentLevel = assessmentContext.appliedAssessmentRatio;
  const jurisdictionLevel = assessmentContext.expectedAssessmentRatio;
  const rawAssessedValue = property.assessed_value;
  const assessorImpliedMarketValue = getAssessorImpliedMarketValue(
    rawAssessedValue,
    appliedAssessmentLevel ?? jurisdictionLevel
  );
  const levelMismatch =
    assessmentContext.ratioVariance != null &&
    Math.abs(assessmentContext.ratioVariance) > 0.0001;
  const valueGap =
    assessorImpliedMarketValue != null && concludedValue > 0
      ? assessorImpliedMarketValue - concludedValue
      : null;

  const rows: string[][] = [];
  if (property.tax_year_in_appeal != null) {
    rows.push(['Assessment Year in Appeal', String(property.tax_year_in_appeal), 'Controls the governing assessment record and jurisdiction rules']);
  }
  rows.push(['Valuation Date', formatDate(data.valuationDate), countyRule?.valuation_date_convention ?? 'Effective date documented in the workfile']);
  if (property.property_class_description) {
    rows.push(['Property Classification', property.property_class_description, 'Classification used to select the jurisdiction reference level']);
  }
  if (classificationSource.isVerified) {
    rows.push([
      'Classification Source',
      classificationSource.authority ?? 'Official authority',
      'Official HTTP(S) source URL is retained in the workfile',
    ]);
  }
  if (property.assessment_methodology) {
    rows.push(['Assessment Methodology', property.assessment_methodology, 'Stored workfile methodology or classification explanation']);
  }
  if (rawAssessedValue != null && rawAssessedValue > 0) {
    rows.push(['Raw Assessed Value', formatCurrency(rawAssessedValue), 'Public-record assessment base']);
  }
  if (appliedAssessmentLevel != null) {
    rows.push([
      'Assessment Level Applied in Workfile',
      formatPercent(appliedAssessmentLevel),
      'Used to normalize the raw assessment to market-value terms',
    ]);
  }
  if (jurisdictionLevel != null) {
    rows.push([
      'Jurisdiction Reference Level',
      formatPercent(jurisdictionLevel),
      levelMismatch ? 'Differs from the workfile level; a sourced classification exception controls only after verification' : 'Reference from the verified jurisdiction rule record',
    ]);
  }
  if (assessorImpliedMarketValue != null && assessorImpliedMarketValue > 0) {
    rows.push([
      'Assessor-Implied Market Value',
      formatCurrency(assessorImpliedMarketValue),
      'Raw assessment divided by the applied statutory assessment level',
    ]);
  }
  if (concludedValue > 0) {
    rows.push(['Resourceful Concluded Value', formatCurrency(concludedValue), 'Reconciled valuation conclusion']);
  }
  if (countyRule?.last_verified_date) {
    rows.push([
      'Jurisdiction Rule Verification',
      formatDate(countyRule.last_verified_date),
      countyRule.verified_by ? `Verified by ${countyRule.verified_by}` : 'Verification source identified in the operations record',
    ]);
  }

  return (
    <View>
      <SectionHeader number="VIII-A1" title="Assessment Level Context" />

      <DataTable
        headers={['Metric', 'Value', 'Interpretation']}
        columnWidths={['33%', '24%', '43%']}
        rows={rows}
      />

      <Text style={[theme.bodyText, { marginTop: 8 }]}>
        A statutory assessment level converts a jurisdiction’s raw assessed value to a market-value reference.
        It is not an assessment-to-sales ratio study, tax rate, equalization multiplier, or tax-dollar savings estimate.
        The assessment year, valuation date, classification, governing rule, and source must remain aligned.
      </Text>

      {assessmentContext.isCookCounty && (
        <View style={[theme.calloutBox, { marginTop: 8 }]}>
          <Text style={[theme.bodyText, { color: colors.inkPrimary }]}>
            Cook County applies property-class assessment levels and a separate annual state equalization multiplier.
            This report does not infer or recycle an equalization multiplier from another year. Any equalization or
            effective-tax calculation used for filing must identify the official factor for the exact assessment year
            and keep it separate from the statutory assessment level shown above.
          </Text>
        </View>
      )}

      {assessmentContext.warnings.map((warning, index) => (
        <Text key={index} style={[theme.bodyText, { marginTop: 6, color: colors.inkMuted }]}>
          Review note: {warning}
        </Text>
      ))}

      {levelMismatch && (
        <Text style={[theme.bodyText, { marginTop: 6 }]}>
          The applied assessment level differs from the jurisdiction reference. Resourceful does not resolve that
          conflict by averaging or silently substituting a generic level. The exact class, exemption, incentive,
          non-profit status, or other exception must be supported by the assessor record applicable to this tax year.
        </Text>
      )}

      {assignmentKind === 'tax_appeal' && valueGap != null && valueGap > 0 && (
        <Text style={[theme.bodyText, { marginTop: 6 }]}>
          After normalization, the assessor-implied market value is {formatCurrency(valueGap)} above the Resourceful
          concluded value. This is a market-value comparison only—not an estimate of annual tax-dollar savings or proof
          that an appeal will be granted.
        </Text>
      )}
    </View>
  );
}
