// ─── Summary of Salient Facts Section ───────────────────────────────────────
import React from 'react';
import { View } from '@react-pdf/renderer';
import { NarrativeBlock, SectionHeader } from './shared';

export default function SummaryOfSalientFacts({ content }: { content: string }) {
  return (
    <View>
      <SectionHeader number="I-A" title="Summary of Salient Facts" />
      <NarrativeBlock content={content} />
    </View>
  );
}
