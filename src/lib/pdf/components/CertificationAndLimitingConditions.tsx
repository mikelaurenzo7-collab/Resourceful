// ─── Certification Boundary & Limiting Conditions ───────────────────────────
import React from 'react';
import { View } from '@react-pdf/renderer';
import { NarrativeBlock, SectionHeader } from './shared';

export default function CertificationAndLimitingConditions({ content }: { content: string }) {
  return (
    <View>
      <SectionHeader number="ADD-C" title="Certification Boundary & Limiting Conditions" />
      <NarrativeBlock content={content} />
    </View>
  );
}
