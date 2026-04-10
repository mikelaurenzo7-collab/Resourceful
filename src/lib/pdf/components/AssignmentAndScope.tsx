// ─── Assignment & Scope Section ─────────────────────────────────────────────
import React from 'react';
import { View } from '@react-pdf/renderer';
import { NarrativeBlock, SectionHeader } from './shared';

export default function AssignmentAndScope({ content }: { content: string }) {
  return (
    <View break>
      <SectionHeader number="A" title="Assignment & Scope" />
      <NarrativeBlock content={content} />
    </View>
  );
}
