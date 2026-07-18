// ─── Verified County Filing Instructions ─────────────────────────────────────
// Rendered only after the generation-time jurisdiction release gate confirms
// that authority, deadline, steps, and required documents match the active rule.

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader } from './shared';
import type { FilingGuide as FilingGuideData } from '@/lib/templates/report-template';

export default function FilingGuide({ guide }: { guide: FilingGuideData }) {
  return (
    <View>
      <SectionHeader number="ADD-A" title="Verified County Filing Instructions" />

      <View style={styles.deadlineBox} wrap={false}>
        <Text style={[theme.label, { color: colors.accent }]}>Verified Filing Deadline / Rule</Text>
        <Text style={styles.deadlineText}>{guide.filing_deadline}</Text>
        <Text style={[theme.caption, { marginTop: 2 }]}>{guide.appeal_board_name}</Text>
      </View>

      <Text style={[theme.bodyText, { marginBottom: 10 }]}>
        Filing rules can change and may depend on township, notice date, assessment year, property class,
        or the stage of review. Use the authority and channel identified below, preserve submission proof,
        and recheck the official portal immediately before filing. Resourceful does not represent that a
        report alone satisfies every evidentiary or procedural requirement.
      </Text>

      <View style={styles.infoGrid} wrap={false}>
        {guide.online_filing_url && (
          <View style={styles.infoItem}>
            <Text style={theme.label}>Official Filing Channel</Text>
            <Text style={styles.urlText}>{guide.online_filing_url}</Text>
          </View>
        )}
        {guide.fee_amount && (
          <View style={styles.infoItem}>
            <Text style={theme.label}>Filing Fee</Text>
            <Text style={theme.tableCell}>{guide.fee_amount}</Text>
          </View>
        )}
        {guide.hearing_format && (
          <View style={styles.infoItem}>
            <Text style={theme.label}>Hearing Format</Text>
            <Text style={theme.tableCell}>{guide.hearing_format}</Text>
          </View>
        )}
      </View>

      {(guide.steps ?? []).length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={theme.headingMD}>Filing Sequence</Text>
          {guide.steps.map((step, index) => (
            <View key={index} style={styles.stepRow} wrap={false}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumText}>{index + 1}</Text>
              </View>
              <Text style={[theme.tableCell, { fontSize: 10, flex: 1 }]}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {(guide.required_documents ?? []).length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={theme.headingMD}>Authority-Identified Required Documents</Text>
          {guide.required_documents.map((document, index) => (
            <Text key={index} style={[theme.tableCell, { fontSize: 9, marginLeft: 8, marginTop: 2 }]}>
              • {document}
            </Text>
          ))}
          <Text style={[theme.caption, { marginLeft: 8, marginTop: 4 }]}>
            Include the Resourceful report only when it is relevant and the authority's filing rules permit or request supporting valuation evidence.
          </Text>
        </View>
      )}

      {(guide.tips ?? []).length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={theme.headingMD}>Preparation Notes</Text>
          {guide.tips.map((tip, index) => (
            <Text key={index} style={[theme.bodyText, { fontSize: 9, marginTop: 3 }]}>
              {index + 1}. {tip}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  deadlineBox: {
    backgroundColor: '#fdf6e3',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 4,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  deadlineText: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 16,
    color: colors.inkPrimary,
    marginTop: 4,
    textAlign: 'center',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  infoItem: {
    flex: 1,
  },
  urlText: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    lineHeight: 1.3,
    color: colors.inkPrimary,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
    gap: 8,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 9,
    color: '#ffffff',
  },
});
