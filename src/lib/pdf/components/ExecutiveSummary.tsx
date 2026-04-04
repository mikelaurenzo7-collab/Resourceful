// ─── Executive Summary ───────────────────────────────────────────────────────

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader, NarrativeBlock, ValueCallout } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatCurrency } from '@/lib/templates/helpers';

export default function ExecutiveSummary({ data }: { data: ReportTemplateData }) {
  const { property, concludedValue, narratives } = data;
  const assessedValue = property.assessed_value ?? 0;
  const overpayment = Math.max(0, assessedValue - concludedValue);

  const execNarrative = narratives.find(n => n.section_name === 'executive_summary');

  return (
    <View>
      <SectionHeader number="I" title="Executive Summary" />

      {/* AI narrative */}
      {execNarrative && <NarrativeBlock content={execNarrative.content} />}

      {/* Key values callout */}
      <View style={theme.calloutBox} wrap={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={theme.label}>Assessed Value</Text>
            <Text style={[theme.headingMD, { marginTop: 2 }]}>{formatCurrency(assessedValue)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={theme.label}>Concluded Market Value</Text>
            <Text style={[theme.headingMD, { color: colors.accent, marginTop: 2 }]}>{formatCurrency(concludedValue)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={theme.label}>Annual Overpayment Estimate</Text>
            <Text style={[theme.headingMD, { color: colors.red, marginTop: 2 }]}>{formatCurrency(overpayment)}</Text>
          </View>
        </View>
      </View>

      {/* Methodology note */}
      <Text style={[theme.bodyText, { marginTop: 8 }]}>
        This analysis follows IAAO (International Association of Assessing Officers) standards
        for mass appraisal review. The concluded market value is derived from the Sales
        Comparison Approach using recent arm&apos;s-length transactions of similar properties,
        with line-item adjustments for differences in size, condition, location, and amenities.
      </Text>
    </View>
  );
}
