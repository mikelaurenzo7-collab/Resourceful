// ─── Property History Section ──────────────────────────────────────────────
import React from 'react';
import { View } from '@react-pdf/renderer';
import { NarrativeBlock, SectionHeader } from './shared';

export default function PropertyHistory({ content }: { content: string }) {
  return (
    <View break>
      <SectionHeader number="C" title="Property History" />
      <NarrativeBlock content={content} />
    </View>
  );
}
