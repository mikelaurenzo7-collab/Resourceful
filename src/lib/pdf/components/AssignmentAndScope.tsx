// ─── Assignment & Scope Section ─────────────────────────────────────────────
import React from 'react';
import { View } from '@react-pdf/renderer';
import { NarrativeBlock, SectionHeader } from './shared';

export default function AssignmentAndScope({ content }: { content: string }) {
  return (
    <View>
      <SectionHeader number="II" title="Assignment & Scope of Work" />
      <NarrativeBlock content={content} />
    </View>
  );
}
