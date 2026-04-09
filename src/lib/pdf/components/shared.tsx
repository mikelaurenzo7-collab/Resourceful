// ─── Shared PDF Primitives ───────────────────────────────────────────────────
// Reusable building blocks for all report sections.

import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';

// ─── Section Header ─────────────────────────────────────────────────────────

export function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.sectionHeader} wrap={false}>
      <Text style={theme.label}>{`SECTION ${number}`}</Text>
      <Text style={theme.headingLG}>{title}</Text>
      <View style={theme.sectionDivider} />
    </View>
  );
}

// ─── Narrative Block (Source Serif 4 body text) ─────────────────────────────
// Parses the AI-generated markdown into properly styled PDF primitives.
// Inter SemiBold/Bold for headings, Source Serif 4 for body, bullet/numbered lists.

function stripInline(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
}

export function NarrativeBlock({ content }: { content: string }) {
  if (!content) return null;
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip blank lines, horizontal rules, table separator rows
    if (!line || /^-{3,}$/.test(line) || /^[\|\s\-:]+$/.test(line)) {
      i++;
      continue;
    }

    // Table rows — strip pipe chars and render as plain text
    if (/^\|.+\|/.test(line)) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim()).filter(Boolean).join('  ');
      if (cells) {
        elements.push(
          <Text key={i} style={[theme.bodyText, { marginBottom: 3, color: colors.inkMuted }]}>
            {stripInline(cells)}
          </Text>
        );
      }
      i++;
      continue;
    }

    // H1 / H2 headings
    if (line.startsWith('# ') || line.startsWith('## ')) {
      const text = line.startsWith('## ') ? line.slice(3) : line.slice(2);
      elements.push(
        <Text key={i} style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 11, color: colors.inkPrimary, marginTop: 8, marginBottom: 3 }}>
          {stripInline(text)}
        </Text>
      );
      i++;
      continue;
    }

    // H3 headings
    if (line.startsWith('### ')) {
      elements.push(
        <Text key={i} style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 10, color: colors.inkPrimary, marginTop: 6, marginBottom: 2 }}>
          {stripInline(line.slice(4))}
        </Text>
      );
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*] /.test(line)) {
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
        const bulletText = lines[i].trim().slice(2);
        elements.push(
          <View key={i} style={{ flexDirection: 'row', marginBottom: 2, paddingLeft: 10 }}>
            <Text style={[theme.bodyText, { width: 10, marginBottom: 0 }]}>{'\u2022'}</Text>
            <Text style={[theme.bodyText, { flex: 1, marginBottom: 0 }]}>{stripInline(bulletText)}</Text>
          </View>
        );
        i++;
      }
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s*/, '');
        elements.push(
          <View key={i} style={{ flexDirection: 'row', marginBottom: 2, paddingLeft: 10 }}>
            <Text style={[theme.bodyText, { width: 16, marginBottom: 0 }]}>{num}.</Text>
            <Text style={[theme.bodyText, { flex: 1, marginBottom: 0 }]}>{stripInline(itemText)}</Text>
          </View>
        );
        i++;
        num++;
      }
      continue;
    }

    // Regular paragraph
    elements.push(
      <Text key={i} style={[theme.bodyText, { marginBottom: 5 }]}>
        {stripInline(line)}
      </Text>
    );
    i++;
  }

  return <View style={{ marginVertical: 4 }}>{elements}</View>;
}

// ─── Data Table ─────────────────────────────────────────────────────────────

interface DataTableProps {
  headers: string[];
  rows: (string | number | null)[][];
  columnWidths?: string[];
  numericColumns?: number[];
  highlightRow?: number;
}

export function DataTable({ headers, rows, columnWidths, numericColumns = [], highlightRow }: DataTableProps) {
  const colCount = headers.length;
  const defaultWidth = `${(100 / colCount).toFixed(1)}%`;
  const widths = columnWidths ?? headers.map(() => defaultWidth);

  return (
    <View style={styles.table}>
      {/* Header row */}
      <View style={theme.tableHeaderRow}>
        {headers.map((h, i) => (
          <Text
            key={i}
            style={[
              theme.tableHeader,
              { width: widths[i], textAlign: numericColumns.includes(i) ? 'right' : 'left', paddingHorizontal: 3 },
            ]}
          >
            {h}
          </Text>
        ))}
      </View>

      {/* Data rows */}
      {rows.map((row, ri) => (
        <View
          key={ri}
          style={[
            ri % 2 === 0 ? theme.tableRow : theme.tableRowAlt,
            highlightRow === ri ? { backgroundColor: '#fdf6e3' } : {},
          ]}
        >
          {row.map((cell, ci) => (
            <Text
              key={ci}
              style={[
                numericColumns.includes(ci) ? theme.tableCellNum : theme.tableCell,
                { width: widths[ci], paddingHorizontal: 3 },
              ]}
            >
              {cell ?? '—'}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Photo Grid ─────────────────────────────────────────────────────────────

interface PhotoItem {
  url: string;
  caption: string;
}

export function PhotoGrid({ photos }: { photos: PhotoItem[] }) {
  if (photos.length === 0) {
    return (
      <Text style={[theme.caption, { marginVertical: 8, fontStyle: 'italic' }]}>
        Limited photographic documentation available.
      </Text>
    );
  }

  // 2-column layout, up to 6 photos
  const displayed = photos.slice(0, 6);
  const rows: PhotoItem[][] = [];
  for (let i = 0; i < displayed.length; i += 2) {
    rows.push(displayed.slice(i, i + 2));
  }

  return (
    <View style={{ marginVertical: 8 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.photoRow} wrap={false}>
          {row.map((photo, pi) => (
            <View key={pi} style={styles.photoCell}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={photo.url} style={styles.photoImage} />
              <Text style={[theme.caption, { textAlign: 'center', marginTop: 2 }]}>
                {photo.caption}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Page Footer ────────────────────────────────────────────────────────────

export function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerRule} />
      <View style={styles.footerContent}>
        <Text style={theme.pageNum}>RESOURCEFUL — Confidential Property Tax Report</Text>
        <Text
          style={theme.pageNum}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </View>
  );
}

// ─── Value Callout ──────────────────────────────────────────────────────────

export function ValueCallout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={theme.calloutBox} wrap={false}>
      <Text style={theme.label}>{label}</Text>
      <Text style={[theme.headingXL, { color: color ?? colors.inkPrimary, marginTop: 2 }]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionHeader: {
    marginBottom: 8,
  },
  table: {
    marginVertical: 6,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  photoCell: {
    width: '48%',
  },
  photoImage: {
    width: '100%',
    height: 140,
    objectFit: 'cover',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 54,
    right: 54,
  },
  footerRule: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    marginBottom: 4,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
