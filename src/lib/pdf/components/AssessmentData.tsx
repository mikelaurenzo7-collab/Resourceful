// ─── Assessment Data Section ───────────────────────────────────────────────
import React from 'react';
import { View } from '@react-pdf/renderer';
import { NarrativeBlock, SectionHeader } from './shared';

export default function AssessmentData({ content }: { content: string }) {
  return (
    <View break>
      <SectionHeader number="D" title="Assessment Data" />
      <NarrativeBlock content={content} />
    </View>
  );
}
