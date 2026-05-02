// ─── Certification & Limiting Conditions Section ───────────────────────────
import React from 'react';
import { View } from '@react-pdf/renderer';
import { NarrativeBlock, SectionHeader } from './shared';

export default function CertificationAndLimitingConditions({ content }: { content: string }) {
  return (
    <View break>
      <SectionHeader number="ADD-B" title="Certification & Limiting Conditions" />
      <NarrativeBlock content={content} />
    </View>
  );
}
