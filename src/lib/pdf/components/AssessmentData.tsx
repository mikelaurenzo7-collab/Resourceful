// ─── Assessment Data Section ───────────────────────────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { SectionHeader } from './shared';

export default function AssessmentData({ content }: { content: string }) {
  return (
    <View break>
      <SectionHeader number="D" title="Assessment Data" />
      <Text style={{ fontSize: 10, marginTop: 8 }}>{content}</Text>
    </View>
  );
}
