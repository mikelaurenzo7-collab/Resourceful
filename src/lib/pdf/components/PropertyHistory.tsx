// ─── Property History Section ──────────────────────────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { SectionHeader } from './shared';

export default function PropertyHistory({ content }: { content: string }) {
  return (
    <View break>
      <SectionHeader number="C" title="Property History" />
      <Text style={{ fontSize: 10, marginTop: 8 }}>{content}</Text>
    </View>
  );
}
