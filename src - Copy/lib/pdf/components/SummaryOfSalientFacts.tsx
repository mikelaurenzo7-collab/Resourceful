// ─── Summary of Salient Facts Section ──────────────────────────────────────
import React from 'react';
import { View } from '@react-pdf/renderer';
import { NarrativeBlock, SectionHeader } from './shared';

export default function SummaryOfSalientFacts({ content }: { content: string }) {
  return (
    <View break>
      <SectionHeader number="B" title="Summary of Salient Facts" />
      <NarrativeBlock content={content} />
    </View>
  );
}
