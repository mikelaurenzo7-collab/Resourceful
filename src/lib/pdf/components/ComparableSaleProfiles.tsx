import React, { Fragment } from 'react';
import { Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { ComparableSale } from '@/types/database';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import {
  formatCurrency,
  formatDateShort,
  formatSqFt,
} from '@/lib/templates/helpers';
import { colors, theme } from '../styles/theme';
import { DataTable, PageFooter, SectionHeader } from './shared';

const ADJUSTMENT_FIELDS = [
  ['Property Rights', 'adjustment_pct_property_rights'],
  ['Financing Terms', 'adjustment_pct_financing_terms'],
  ['Conditions of Sale', 'adjustment_pct_conditions_of_sale'],
  ['Market Trends', 'adjustment_pct_market_trends'],
  ['Location', 'adjustment_pct_location'],
  ['Size', 'adjustment_pct_size'],
  ['Land-to-Building Ratio', 'adjustment_pct_land_to_building'],
  ['Condition', 'adjustment_pct_condition'],
  ['Other', 'adjustment_pct_other'],
] as const satisfies ReadonlyArray<readonly [string, keyof ComparableSale]>;

function present(value: string | number | null | undefined): string {
  if (value == null || value === '') return 'Not available';
  return String(value);
}

function validDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unverified';
  return formatDateShort(value);
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function sourceSummary(comp: ComparableSale): string {
  if (!comp.county_recorder_url) return 'No recorder or source link stored';
  try {
    return `Documented: ${new URL(comp.county_recorder_url).hostname}`;
  } catch {
    return 'Stored source URL is unverified';
  }
}

export default function ComparableSaleProfiles({ data }: { data: ReportTemplateData }) {
  if (data.comparableSales.length === 0) return null;

  const sorted = [...data.comparableSales].sort(
    (a, b) =>
      (a.distance_miles ?? Number.POSITIVE_INFINITY) -
      (b.distance_miles ?? Number.POSITIVE_INFINITY)
  );

  return (
    <Fragment>
      {sorted.map((comp, index) => {
        const adjustments = ADJUSTMENT_FIELDS
          .map(([label, key]) => {
            const value = comp[key];
            return typeof value === 'number' && Number.isFinite(value) && value !== 0
              ? [label, formatPercent(value)]
              : null;
          })
          .filter((row): row is string[] => row !== null);

        const transactionRows = [
          ['Sale Date', validDate(comp.sale_date)],
          ['Sale Price', comp.sale_price > 0 ? formatCurrency(comp.sale_price) : 'Unverified'],
          ['Grantor', present(comp.grantor)],
          ['Grantee', present(comp.grantee)],
          ['Deed Document', present(comp.deed_document_number)],
          ['Source Status', sourceSummary(comp)],
          ['Sale Condition', present(comp.sale_condition_notes)],
          ['Distress Flag', comp.is_distressed_sale ? 'Yes - review required' : 'No stored distress flag'],
        ];

        const physicalRows = [
          ['Building Area', comp.building_sqft ? formatSqFt(comp.building_sqft) : 'Not available'],
          ['Site Area', comp.lot_size_sqft ? formatSqFt(comp.lot_size_sqft) : 'Not available'],
          ['Land / Building', comp.land_to_building_ratio != null ? comp.land_to_building_ratio.toFixed(2) : 'Not available'],
          ['Year Built', present(comp.year_built)],
          ['Effective Age', comp.comp_effective_age != null ? `${comp.comp_effective_age} years` : 'Not available'],
          ['Property Class', present(comp.property_class)],
          ['Overhead Doors', present(comp.overhead_door_count)],
          ['Clear Height', comp.clearance_height_ft != null ? `${comp.clearance_height_ft} ft` : 'Not available'],
          ['Distance', comp.distance_miles != null ? `${comp.distance_miles.toFixed(2)} miles` : 'Not available'],
          ['Condition', present(comp.condition_notes)],
        ];

        const indicationRows = [
          ['Unadjusted Price / SF', comp.price_per_sqft != null && comp.price_per_sqft > 0 ? `$${comp.price_per_sqft.toFixed(2)}` : 'Not available'],
          ['Net Adjustment', comp.net_adjustment_pct != null ? formatPercent(comp.net_adjustment_pct) : 'Not available'],
          ['Adjusted Price / SF', comp.adjusted_price_per_sqft != null && comp.adjusted_price_per_sqft > 0 ? `$${comp.adjusted_price_per_sqft.toFixed(2)}` : 'Not available'],
          ['Weak Comparable Flag', comp.is_weak_comparable ? 'Yes - reduced reliance' : 'No stored weakness flag'],
        ];

        return (
          <Page key={comp.id} size="LETTER" style={theme.page}>
            <PageFooter />
            <SectionHeader number={`VIII-${index + 1}`} title={`Comparable Sale ${index + 1} Profile`} />

            <Text style={styles.address}>{comp.address}</Text>
            <Text style={[theme.bodyText, styles.intro]}>
              Stored transaction, source, physical, adjustment, and indication evidence. Missing fields are
              not inferred; material reliance requires source verification.
            </Text>

            {comp.comparable_photo_url && (
              <View style={styles.imageFrame} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={comp.comparable_photo_url} style={styles.image} />
                <Text style={styles.imageCaption}>Comparable image stored in the Resourceful workfile</Text>
              </View>
            )}

            <View style={styles.topGrid}>
              <View style={styles.topColumnLeft}>
                <Text style={styles.subheading}>Transaction Evidence</Text>
                <DataTable
                  headers={['Field', 'Documented Evidence']}
                  columnWidths={['36%', '64%']}
                  rows={transactionRows}
                />
              </View>

              <View style={styles.topColumn}>
                <Text style={styles.subheading}>Physical & Locational Evidence</Text>
                <DataTable
                  headers={['Field', 'Documented Evidence']}
                  columnWidths={['38%', '62%']}
                  rows={physicalRows}
                />
              </View>
            </View>

            <View style={styles.bottomGrid}>
              <View style={styles.bottomColumnLeft}>
                <Text style={styles.subheading}>Adjustment Inputs</Text>
                {adjustments.length > 0 ? (
                  <DataTable
                    headers={['Category', 'Adjustment']}
                    columnWidths={['68%', '32%']}
                    numericColumns={[1]}
                    rows={adjustments}
                  />
                ) : (
                  <Text style={theme.bodyText}>
                    No nonzero structured adjustments are stored. This is not confirmation that no adjustment is warranted.
                  </Text>
                )}
              </View>

              <View style={styles.bottomColumn}>
                <Text style={styles.subheading}>Comparable Indication</Text>
                <DataTable
                  headers={['Measure', 'Result']}
                  columnWidths={['63%', '37%']}
                  numericColumns={[1]}
                  rows={indicationRows}
                />
              </View>
            </View>
          </Page>
        );
      })}
    </Fragment>
  );
}

const styles = StyleSheet.create({
  address: {
    fontFamily: 'Playfair Display',
    fontSize: 15,
    fontWeight: 600,
    color: colors.inkPrimary,
    marginBottom: 3,
  },
  intro: {
    marginBottom: 5,
    color: colors.inkMuted,
  },
  imageFrame: {
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 5,
    backgroundColor: colors.background,
  },
  image: {
    width: '100%',
    height: 118,
    objectFit: 'contain',
    backgroundColor: colors.calloutBg,
  },
  imageCaption: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  subheading: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 8.5,
    color: colors.inkPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginTop: 5,
    marginBottom: 2,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.accent,
  },
  topGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  topColumnLeft: {
    flex: 1,
    marginRight: 8,
  },
  topColumn: {
    flex: 1,
  },
  bottomGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 3,
  },
  bottomColumnLeft: {
    flex: 1,
    marginRight: 8,
  },
  bottomColumn: {
    flex: 1,
  },
});
