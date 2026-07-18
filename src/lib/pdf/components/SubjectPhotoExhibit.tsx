import React, { Fragment } from 'react';
import { Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import { theme, colors } from '../styles/theme';
import { PageFooter, SectionHeader } from './shared';

interface ExhibitImage {
  url: string;
  caption: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export default function SubjectPhotoExhibit({ data }: { data: ReportTemplateData }) {
  const maps: ExhibitImage[] = [
    data.maps.regional,
    data.maps.neighborhood,
    data.maps.parcel,
  ]
    .filter((map): map is NonNullable<typeof map> => Boolean(map?.url))
    .map((map) => ({ url: map.url, caption: map.caption }));

  const photos: ExhibitImage[] = data.photos
    .filter((photo) => Boolean(photo.storage_path))
    .map((photo, index) => ({
      url: photo.storage_path,
      caption:
        photo.ai_analysis?.professional_caption?.trim() ||
        photo.caption?.trim() ||
        photo.photo_type?.replace(/_/g, ' ') ||
        `Subject photograph ${index + 1}`,
    }));

  if (maps.length === 0 && photos.length === 0) return null;

  const photoPages = chunk(photos, 2);
  const mapHeight = maps.length === 1 ? 430 : maps.length === 2 ? 245 : 165;

  return (
    <Fragment>
      {maps.length > 0 && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <SectionHeader number="EX-1" title="Subject Maps & Parcel Context" />
          <Text style={[theme.bodyText, styles.scopeNote]}>
            These maps orient the subject within its regional, neighborhood, and parcel context. Map
            boundaries, labels, and imagery should be verified against the identified public or licensed
            source before they are used for filing, zoning, survey, access, or legal-description purposes.
          </Text>
          <View style={styles.mapGrid}>
            {maps.map((map, index) => (
              <View key={index} style={styles.mapCard} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={map.url} style={[styles.mapImage, { height: mapHeight }]} />
                <Text style={styles.caption}>{map.caption}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.exhibitCounter}>{maps.length} map exhibits documented</Text>
        </Page>
      )}

      {photoPages.map((pagePhotos, pageIndex) => (
        <Page key={pageIndex} size="LETTER" style={theme.page}>
          <PageFooter />
          <SectionHeader number="EX-2" title="Subject Photo Exhibit" />

          {pageIndex === 0 && (
            <Text style={[theme.bodyText, styles.scopeNote]}>
              This exhibit preserves the subject imagery available in the Resourceful workfile. Captions
              are descriptive aids. Images and automated observations are not represented as a licensed
              inspection, engineering opinion, survey, or independent measurement unless the report
              expressly identifies that source and review.
            </Text>
          )}

          <View style={styles.pageGrid}>
            {pagePhotos.map((photo, photoIndex) => (
              <View key={`${pageIndex}-${photoIndex}`} style={styles.photoCard} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={photo.url} style={styles.photo} />
                <Text style={styles.caption}>{photo.caption}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.exhibitCounter}>
            Photo exhibit page {pageIndex + 1} of {photoPages.length} - {photos.length} subject images documented
          </Text>
        </Page>
      ))}
    </Fragment>
  );
}

const styles = StyleSheet.create({
  scopeNote: {
    marginBottom: 10,
    color: colors.inkMuted,
  },
  mapGrid: {
    flex: 1,
    gap: 8,
  },
  mapCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 5,
    backgroundColor: colors.background,
  },
  mapImage: {
    width: '100%',
    objectFit: 'contain',
    backgroundColor: colors.calloutBg,
  },
  pageGrid: {
    flex: 1,
    gap: 12,
  },
  photoCard: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 6,
    backgroundColor: colors.background,
  },
  photo: {
    width: '100%',
    height: 255,
    objectFit: 'contain',
    backgroundColor: colors.calloutBg,
  },
  caption: {
    fontFamily: 'Inter',
    fontSize: 9,
    fontWeight: 500,
    color: colors.inkPrimary,
    textAlign: 'center',
    marginTop: 5,
    textTransform: 'capitalize',
  },
  exhibitCounter: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: colors.inkMuted,
    textAlign: 'right',
    marginTop: 6,
  },
});
