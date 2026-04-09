// ─── Summary of Salient Facts Section ──────────────────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { SectionHeader } from './shared';

export default function SummaryOfSalientFacts({ content }: { content: string }) {
  return (
    <View break>
      <SectionHeader number="B" title="Summary of Salient Facts" />
      {/* Render as preformatted for tabular Markdown, or parse if needed */}
      <Text style={{ fontSize: 10, fontFamily: 'monospace', marginTop: 8 }}>{content}</Text>
    </View>
  );
}
