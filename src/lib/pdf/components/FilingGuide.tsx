// ─── County Filing Instructions ──────────────────────────────────────────────
// Only rendered for tax_appeal service type.

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { SectionHeader } from './shared';
import type { FilingGuide as FilingGuideData } from '@/lib/templates/report-template';

export default function FilingGuide({ guide }: { guide: FilingGuideData }) {
  return (
    <View break>
      <SectionHeader number="ADD-A" title="County Filing Instructions" />

      {/* Deadline callout — visually prominent */}
      <View style={styles.deadlineBox} wrap={false}>
        <Text style={[theme.label, { color: colors.accent }]}>Appeal Deadline</Text>
        <Text style={styles.deadlineText}>{guide.filing_deadline ?? 'Contact your county assessor for deadlines'}</Text>
        <Text style={[theme.caption, { marginTop: 2 }]}>
          {guide.appeal_board_name}
        </Text>
      </View>

      {/* Filing method & fee */}
      <View style={styles.infoGrid} wrap={false}>
        {guide.online_filing_url && (
          <View style={styles.infoItem}>
            <Text style={theme.label}>Online Filing</Text>
            <Text style={theme.tableCell}>{guide.online_filing_url}</Text>
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

      {/* Step-by-step filing sequence */}
      {(guide.steps ?? []).length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={theme.headingMD}>Step-by-Step Filing Process</Text>
          {guide.steps.map((step, i) => (
            <View key={i} style={styles.stepRow} wrap={false}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={[theme.tableCell, { fontSize: 10, flex: 1 }]}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Required documents */}
      {(guide.required_documents ?? []).length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={theme.headingMD}>Required Documents</Text>
          {guide.required_documents.map((doc, i) => (
            <Text key={i} style={[theme.tableCell, { fontSize: 9, marginLeft: 8, marginTop: 2 }]}>
              • {doc}
            </Text>
          ))}
          <Text style={[theme.tableCell, { fontSize: 9, marginLeft: 8, marginTop: 2, fontWeight: 600 }]}>
            • Your Resourceful report (PDF) — attach as evidence
          </Text>
        </View>
      )}

      {/* Tips */}
      {(guide.tips ?? []).length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={theme.headingMD}>Pro Se Tips</Text>
          {guide.tips.map((tip, i) => (
            <Text key={i} style={[theme.bodyText, { fontSize: 9, marginTop: 3 }]}>
              {i + 1}. {tip}
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
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  infoItem: {
    flex: 1,
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
