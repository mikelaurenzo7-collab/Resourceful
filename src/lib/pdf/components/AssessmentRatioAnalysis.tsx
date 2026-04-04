// ─── Assessment Ratio Analysis ───────────────────────────────────────────────
// Only rendered if assessment ratio data is available.

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, NarrativeBlock, DataTable } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatPercent } from '@/lib/templates/helpers';

export default function AssessmentRatioAnalysis({ data }: { data: ReportTemplateData }) {
  const { property, countyRule, concludedValue, narratives } = data;

  // Guard: only render if we have assessment ratio data
  if (!property.assessment_ratio) return null;

  const subjectRatio = property.assessment_ratio;
  const assessedValue = property.assessed_value ?? 0;

  // County median ratio from county_rules
  const countyRatioField = property.property_class?.toLowerCase().includes('commercial')
    ? countyRule?.assessment_ratio_commercial
    : property.property_class?.toLowerCase().includes('industrial')
      ? countyRule?.assessment_ratio_industrial
      : countyRule?.assessment_ratio_residential;
  const countyMedian = countyRatioField ?? null;

  const iaaoLow = 0.90;
  const iaaoHigh = 1.10;

  const isAboveCounty = countyMedian != null && subjectRatio > countyMedian;
  const isOutsideIAAO = subjectRatio < iaaoLow || subjectRatio > iaaoHigh;

  const ratioNarrative = narratives.find(n => n.section_name === 'assessment_ratio_analysis');

  return (
    <View break>
      <SectionHeader number="X" title="Assessment Ratio Analysis" />

      <DataTable
        headers={['Metric', 'Ratio', 'Status']}
        columnWidths={['40%', '25%', '35%']}
        rows={[
          ['Subject Property', formatPercent(subjectRatio), isOutsideIAAO ? 'Outside IAAO Range' : 'Within IAAO Range'],
          ...(countyMedian != null
            ? [['County Median', formatPercent(countyMedian), isAboveCounty ? 'Subject Above Median' : 'Subject At/Below Median']]
            : []),
          ['IAAO Acceptable Range', `${formatPercent(iaaoLow)} – ${formatPercent(iaaoHigh)}`, 'Standard'],
        ]}
      />

      {ratioNarrative ? (
        <NarrativeBlock content={ratioNarrative.content} />
      ) : (
        <Text style={[theme.bodyText, { marginTop: 8 }]}>
          The subject property&apos;s assessment ratio of {formatPercent(subjectRatio)} indicates
          {isAboveCounty
            ? ` the property is assessed at a higher ratio than the county median of ${formatPercent(countyMedian!)}, suggesting potential over-assessment relative to neighboring properties.`
            : countyMedian != null
              ? ` the property&apos;s assessment is at or below the county median of ${formatPercent(countyMedian)}.`
              : ' the assessment level relative to market value.'}
          {isOutsideIAAO
            ? ' This ratio falls outside the IAAO acceptable range of 0.90–1.10, which strengthens the case for reassessment.'
            : ''}
        </Text>
      )}
    </View>
  );
}
