// ─── Assignment & Scope Section ─────────────────────────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { SectionHeader } from './shared';

export default function AssignmentAndScope({ content }: { content: string }) {
  return (
    <View break>
      <SectionHeader number="A" title="Assignment & Scope" />
      <Text>{content}</Text>
    </View>
  );
}
