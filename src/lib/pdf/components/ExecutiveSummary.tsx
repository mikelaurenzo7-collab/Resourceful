// ─── Executive Summary ───────────────────────────────────────────────────────

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, NarrativeBlock } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency } from '@/lib/templates/helpers';
import { resolveAssignmentKind } from '@/lib/assignments/routing';
import { getAssessorImpliedMarketValue } from '@/lib/dashboard/value-comparison';

export default function ExecutiveSummary({ data }: { data: ReportTemplateData }) {
  const { report, property, concludedValue, narratives } = data;
  const assignmentKind = resolveAssignmentKind(report.service_type, report.desired_outcome);
  const assessorReferenceValue = getAssessorImpliedMarketValue(
    property.assessed_value,
    property.assessment_ratio
  );
  const hasAssessorReference = assessorReferenceValue != null && assessorReferenceValue > 0;
  const referenceDifference = hasAssessorReference
    ? assessorReferenceValue - concludedValue
    : null;
  const referenceDifferenceLabel = referenceDifference != null && referenceDifference >= 0
    ? 'Assessor Value Above Conclusion'
    : 'Conclusion Above Assessor Value';

  const execNarrative = narratives.find((n) => n.section_name === 'executive_summary');
  const supportedMethods = [
    data.comparableSales.length > 0
      ? `sales comparison evidence from ${data.comparableSales.length} documented transaction${data.comparableSales.length === 1 ? '' : 's'}`
      : null,
    data.incomeAnalysis ? 'income capitalization evidence' : null,
    property.cost_approach_value != null && property.cost_approach_value > 0
      ? 'cost approach evidence'
      : null,
    assignmentKind === 'tax_appeal' && property.assessment_ratio != null
      ? 'jurisdiction assessment-ratio and equity evidence'
      : null,
    property.photo_count > 0 ? 'submitted property-condition photographs' : null,
  ].filter((method): method is string => Boolean(method));

  return (
    <View>
      <SectionHeader number="I" title="Executive Summary" />

      {/* Evidence-controlled GPT-5.6 narrative */}
      {execNarrative && <NarrativeBlock content={execNarrative.content} />}

      {/* Key values callout */}
      <View style={theme.calloutBox} wrap={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {hasAssessorReference && (
            <View style={{ flex: 1 }}>
              <Text style={theme.label}>
                {assignmentKind === 'tax_appeal'
                  ? 'Assessor-Implied Market Value'
                  : 'Assessor Reference Value'}
              </Text>
              <Text style={[theme.headingMD, { marginTop: 2 }]}>
                {formatCurrency(assessorReferenceValue)}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={theme.label}>Resourceful Concluded Value</Text>
            <Text style={[theme.headingMD, { color: colors.accent, marginTop: 2 }]}>
              {formatCurrency(concludedValue)}
            </Text>
          </View>

          {referenceDifference != null && (
            <View style={{ flex: 1 }}>
              <Text style={theme.label}>{referenceDifferenceLabel}</Text>
              <Text style={[theme.headingMD, { color: colors.inkMuted, marginTop: 2 }]}>
                {formatCurrency(Math.abs(referenceDifference))}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Methodology boundary */}
      <Text style={[theme.bodyText, { marginTop: 8 }]}>
        This is an AI-assisted valuation workfile. The conclusion reconciles only the approaches and
        evidence supported by sufficient inputs in this assignment
        {supportedMethods.length > 0 ? `: ${supportedMethods.join(', ')}.` : '.'}
        {' '}An approach omitted for insufficient data is not treated as negative evidence. No physical
        inspection, licensed-appraiser certification, IAAO-conformance opinion, USPAP-compliance opinion,
        legal opinion, or third-party acceptance is implied unless the report expressly documents it.
      </Text>
    </View>
  );
}
