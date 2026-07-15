import React, { Fragment } from 'react';
import { Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import { theme, colors } from '../styles/theme';
import { PageFooter, SectionHeader } from './shared';

interface ExhibitPhoto {
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
  const photos: ExhibitPhoto[] = data.photos
    .filter((photo) => Boolean(photo.storage_path))
    .map((photo, index) => ({
      url: photo.storage_path,
      caption:
        photo.ai_analysis?.professional_caption?.trim() ||
        photo.caption?.trim() ||
        photo.photo_type?.replaceAll('_', ' ') ||
        `Subject photograph ${index + 1}`,
    }));

  if (photos.length === 0) return null;

  const pages = chunk(photos, 2);

  return (
    <Fragment>
      {pages.map((pagePhotos, pageIndex) => (
        <Page key={pageIndex} size="LETTER" style={theme.page}>
          <PageFooter />
          <SectionHeader
            number="EX-1"
            title={pageIndex === 0 ? 'Subject Maps & Photo Exhibit' : 'Subject Photo Exhibit'}
          />

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
            Exhibit page {pageIndex + 1} of {pages.length} - {photos.length} subject images documented
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
  pageGrid: {
    flex: 1,
    gap: 12,
  },
  photoCard: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 6,
    backgroundColor: colors.paper,
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
