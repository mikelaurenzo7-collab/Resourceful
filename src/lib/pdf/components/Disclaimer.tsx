// ─── Fallback Workfile Integrity & Limiting Conditions ───────────────────────
// Used only when the generated certification-and-limiting-conditions narrative
// is unavailable. It must not imply a licensed appraiser certification.

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader } from './shared';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { formatDate } from '@/lib/templates/helpers';
import { getAssignmentDisplayLabel } from '@/lib/assignments/routing';

export default function Disclaimer({ data }: { data: ReportTemplateData }) {
  const { report, reportDate } = data;
  const assignmentLabel = getAssignmentDisplayLabel(
    report.service_type,
    report.desired_outcome
  );

  return (
    <View break>
      <SectionHeader number="ADD-B" title="Workfile Integrity & Limiting Conditions" />

      <Text style={[theme.headingMD, { marginBottom: 6 }]}>Workfile Integrity Statements</Text>
      {[
        'Material facts, records, photographs, owner statements, third-party data, calculations, assumptions, and analytical judgments should remain distinguishable and attributed to their sources throughout this report.',
        'The value conclusion must follow the evidence documented in the workfile and must not be treated as a predetermined advocacy target.',
        'A valuation approach is included only when sufficient numerical inputs are present; omitted or limited approaches do not constitute negative evidence.',
        'Photographs support visible observations only and do not establish concealed defects, engineering diagnoses, environmental conditions, code violations, system age, or repair cost without qualified verification.',
        'No physical inspection, title examination, legal analysis, tax opinion, insurance opinion, lending decision, or agency acceptance is represented unless the report expressly documents that work.',
        'The report does not represent that a licensed or certified appraiser reviewed, signed, or assumed responsibility for the assignment unless an executed appraiser certification is included.',
      ].map((item, index) => (
        <Text key={index} style={[theme.tableCell, { fontSize: 9, marginBottom: 4, lineHeight: 1.5 }]}>
          {index + 1}. {item}
        </Text>
      ))}

      <View style={styles.rule} />

      <Text style={[theme.headingMD, { marginTop: 12 }]}>Limiting Conditions</Text>
      <Text style={[theme.bodyText, { marginTop: 6 }]}>
        This document is an AI-assisted {assignmentLabel.toLowerCase()} prepared from the evidence,
        calculations, and assumptions identified in the workfile. It is not a signed, certified,
        licensed, lender-ready, court-admissible, or USPAP-compliant appraisal unless a qualified
        appraiser reviews, signs, and assumes responsibility for the assignment. It does not constitute
        legal, tax, insurance, engineering, environmental, title, or lending advice.
      </Text>
      <Text style={[theme.bodyText, { marginTop: 8 }]}>
        The intended user is responsible for confirming material records, effective dates, jurisdiction
        rules, forms, filing deadlines, professional-review requirements, and third-party acceptance
        directly with the relevant authority or qualified professional. Resourceful does not guarantee
        that a court, lender, insurer, taxing authority, attorney, accountant, appraiser, or other third
        party will accept this report for a particular use.
      </Text>

      <View style={styles.metaBlock}>
        <Text style={theme.caption}>Assignment: {assignmentLabel}</Text>
        <Text style={theme.caption}>Report ID: {report.id}</Text>
        <Text style={theme.caption}>Generated: {formatDate(reportDate)}</Text>
        <Text style={theme.caption}>resourceful.app</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rule: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 12,
  },
  metaBlock: {
    marginTop: 24,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
});
