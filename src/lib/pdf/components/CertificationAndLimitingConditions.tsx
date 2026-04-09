// ─── Certification & Limiting Conditions Section ───────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { SectionHeader } from './shared';

export default function CertificationAndLimitingConditions({ content }: { content: string }) {
  return (
    <View break>
      <SectionHeader number="ADD-B" title="Certification & Limiting Conditions" />
      <Text style={{ fontSize: 10, marginTop: 8 }}>{content}</Text>
    </View>
  );
}
