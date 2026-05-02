// ─── Assessment Ratio Analysis ───────────────────────────────────────────────
// Only rendered if assessment ratio data is available.

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { theme } from '../styles/theme';
import { SectionHeader, DataTable } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatPercent } from '@/lib/templates/helpers';

export default function AssessmentRatioAnalysis({ data }: { data: ReportTemplateData }) {
  const { property, countyRule } = data;

  // Guard: only render if we have assessment ratio data
  if (!property.assessment_ratio) return null;

  const subjectRatio = property.assessment_ratio;

  // County median ratio from county_rules
  const countyRatioField = property.property_class?.toLowerCase().includes('commercial')
    ? countyRule?.assessment_ratio_commercial
    : property.property_class?.toLowerCase().includes('industrial')
      ? countyRule?.assessment_ratio_industrial
      : countyRule?.assessment_ratio_residential;
  const countyStandardRatio = countyRatioField ?? null;

  const iaaoLow = 0.90;
  const iaaoHigh = 1.10;

  const isAboveCountyStandard = countyStandardRatio != null && subjectRatio > countyStandardRatio;
  const isOutsideIAAO = subjectRatio < iaaoLow || subjectRatio > iaaoHigh;

  return (
    <View break>
      <SectionHeader number="X" title="Assessment Ratio Analysis" />

      <DataTable
        headers={['Metric', 'Ratio', 'Status']}
        columnWidths={['40%', '25%', '35%']}
        rows={[
          ['Subject Property', formatPercent(subjectRatio), isOutsideIAAO ? 'Outside IAAO Range' : 'Within IAAO Range'],
          ...(countyStandardRatio != null
            ? [['County Standard Ratio', formatPercent(countyStandardRatio), isAboveCountyStandard ? 'Subject Above Standard' : 'Subject At/Below Standard']]
            : []),
          ['IAAO Benchmark Range', `${formatPercent(iaaoLow)} – ${formatPercent(iaaoHigh)}`, 'Reference'],
        ]}
      />

      <Text style={[theme.bodyText, { marginTop: 8 }]}> 
        The subject property&apos;s assessment ratio of {formatPercent(subjectRatio)}
        {countyStandardRatio != null
          ? isAboveCountyStandard
            ? ` exceeds the county's standard assessment ratio of ${formatPercent(countyStandardRatio)}, indicating the subject is being assessed more aggressively than the governing standard would suggest.`
            : ` is at or below the county's standard assessment ratio of ${formatPercent(countyStandardRatio)}.`
          : ' provides a direct mathematical check on how the current assessment relates to market value.'}
        {isOutsideIAAO
          ? ' It also falls outside the IAAO benchmark range of 0.90–1.10, which supports a closer review of the assessment.'
          : ''}
      </Text>
    </View>
  );
}
