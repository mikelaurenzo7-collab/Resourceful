// ─── Shared PDF Primitives ───────────────────────────────────────────────────
// Reusable building blocks for all report sections.

import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { theme, colors } from '../styles/theme';
import { parseInlineMarkdown, parseMarkdownBlocks, stripInlineMarkdown } from '../markdown';

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

export function NarrativeBlock({ content }: { content: string }) {
  if (!content) return null;
  const blocks = parseMarkdownBlocks(content);
  const elements = blocks.map((block, index) => {
    switch (block.type) {
      case 'table':
        return (
          <DataTable
            key={`table-${index}`}
            headers={block.headers.map(stripInlineMarkdown)}
            rows={block.rows.map((row) => row.map(stripInlineMarkdown))}
            numericColumns={block.numericColumns}
          />
        );

      case 'heading': {
        const headingStyle =
          block.level === 3
            ? styles.headingLevelThree
            : styles.headingLevelOneTwo;
        return (
          <Text key={`heading-${index}`} style={headingStyle}>
            {renderInlineText(block.text, `heading-${index}`)}
          </Text>
        );
      }

      case 'bullet_list':
        return block.items.map((item, itemIndex) => (
          <View key={`bullet-${index}-${itemIndex}`} style={styles.listRow}>
            <Text style={[theme.bodyText, { width: 10, marginBottom: 0 }]}>{'\u2022'}</Text>
            <Text style={[theme.bodyText, { flex: 1, marginBottom: 0 }]}>
              {renderInlineText(item, `bullet-${index}-${itemIndex}`)}
            </Text>
          </View>
        ));

      case 'numbered_list':
        return block.items.map((item, itemIndex) => (
          <View key={`numbered-${index}-${itemIndex}`} style={styles.listRow}>
            <Text style={[theme.bodyText, { width: 18, marginBottom: 0 }]}>
              {block.start + itemIndex}.
            </Text>
            <Text style={[theme.bodyText, { flex: 1, marginBottom: 0 }]}>
              {renderInlineText(item, `numbered-${index}-${itemIndex}`)}
            </Text>
          </View>
        ));

      case 'paragraph':
        return (
          <Text key={`paragraph-${index}`} style={[theme.bodyText, { marginBottom: 5 }]}>
            {renderInlineText(block.text, `paragraph-${index}`)}
          </Text>
        );
    }
  });

  return <View style={{ marginVertical: 4 }}>{elements}</View>;
}

function renderInlineText(text: string, keyPrefix: string): React.ReactNode[] {
  return parseInlineMarkdown(text).map((segment, index) => {
    if (!segment.bold && !segment.italic) {
      return segment.text;
    }

    const inlineStyles = [];
    if (segment.bold) {
      inlineStyles.push(styles.inlineBold);
    }
    if (segment.italic) {
      inlineStyles.push(styles.inlineItalic);
    }

    return (
      <Text
        key={`${keyPrefix}-${index}`}
        style={inlineStyles}
      >
        {segment.text}
      </Text>
    );
  });
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
  headingLevelOneTwo: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 11,
    color: colors.inkPrimary,
    marginTop: 8,
    marginBottom: 3,
  },
  headingLevelThree: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 10,
    color: colors.inkPrimary,
    marginTop: 6,
    marginBottom: 2,
  },
  listRow: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 10,
  },
  inlineBold: {
    fontFamily: 'Inter',
    fontWeight: 600,
  },
  inlineItalic: {
    fontStyle: 'italic',
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
