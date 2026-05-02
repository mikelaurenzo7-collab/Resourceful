// ─── PDF Theme: Fonts, Colors, Typography ────────────────────────────────────
// All visual constants for the @react-pdf/renderer report. No magic values
// anywhere in component files — everything references this module.

import { Font, StyleSheet } from '@react-pdf/renderer';
import path from 'path';

// ─── Font Registration ──────────────────────────────────────────────────────

const fontsDir = path.join(process.cwd(), 'src/lib/pdf/fonts');

Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(fontsDir, 'Inter-Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontsDir, 'Inter-Medium.ttf'), fontWeight: 500 },
    { src: path.join(fontsDir, 'Inter-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(fontsDir, 'Inter-Bold.ttf'), fontWeight: 700 },
  ],
});

Font.register({
  family: 'Source Serif 4',
  fonts: [
    { src: path.join(fontsDir, 'SourceSerif4-Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontsDir, 'SourceSerif4-Regular.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'SourceSerif4-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(fontsDir, 'SourceSerif4-SemiBold.ttf'), fontWeight: 600, fontStyle: 'italic' },
  ],
});

// Disable hyphenation for cleaner text layout
Font.registerHyphenationCallback((word) => [word]);

// ─── Color Palette ──────────────────────────────────────────────────────────

export const colors = {
  background: '#FFFFFF',
  inkPrimary: '#1a2744',
  inkBody: '#374151',
  inkMuted: '#6b7280',
  accent: '#d4a843',
  rowAlt: '#f8f9fa',
  border: '#e5e7eb',
  green: '#059669',
  red: '#dc2626',
  calloutBg: '#f0f4f8',
} as const;

// ─── Shared Styles ──────────────────────────────────────────────────────────

export const theme = StyleSheet.create({
  // ── Page ──────────────────────────────────────────────
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: colors.inkBody,
    backgroundColor: colors.background,
    paddingTop: 54,    // 0.75in
    paddingBottom: 54,
    paddingLeft: 54,
    paddingRight: 54,
  },
  coverPage: {
    fontFamily: 'Inter',
    backgroundColor: colors.background,
    paddingTop: 72,
    paddingBottom: 54,
    paddingLeft: 54,
    paddingRight: 54,
    justifyContent: 'flex-start',
  },

  // ── Typography ────────────────────────────────────────
  headingXL: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 18,
    color: colors.inkPrimary,
    marginBottom: 6,
  },
  headingLG: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 14,
    color: colors.inkPrimary,
    marginBottom: 4,
  },
  headingMD: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 11,
    color: colors.inkPrimary,
    marginBottom: 3,
  },
  label: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 9,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bodyText: {
    fontFamily: 'Source Serif 4',
    fontWeight: 400,
    fontSize: 10,
    color: colors.inkBody,
    lineHeight: 1.6,
  },
  tableHeader: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 8.5,
    color: colors.inkPrimary,
  },
  tableCell: {
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 8.5,
    color: colors.inkBody,
  },
  tableCellNum: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 8.5,
    color: colors.inkPrimary,
    textAlign: 'right',
  },
  caption: {
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 8,
    color: colors.inkMuted,
  },
  pageNum: {
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 8,
    color: colors.inkMuted,
  },

  // ── Section Divider ───────────────────────────────────
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    marginTop: 6,
    marginBottom: 6,
  },

  // ── Callout Box ───────────────────────────────────────
  calloutBox: {
    backgroundColor: colors.calloutBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    padding: 12,
    marginVertical: 8,
  },

  // ── Table Helpers ─────────────────────────────────────
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingVertical: 4,
    alignItems: 'center',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingVertical: 4,
    alignItems: 'center',
    backgroundColor: colors.rowAlt,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.inkPrimary,
    paddingVertical: 4,
    alignItems: 'center',
  },
});
