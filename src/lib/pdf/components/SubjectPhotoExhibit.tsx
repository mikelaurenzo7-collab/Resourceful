import React, { Fragment } from 'react';
import { Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import { getPhotoCaption, type PhotoCaptionSource } from '../photo-caption';
import { theme, colors } from '../styles/theme';
import { PageFooter, SectionHeader } from './shared';

interface ExhibitImage {
  url: string;
  caption: string;
  captionSource?: PhotoCaptionSource;
  sourceLabel?: string;
}

export type SubjectExhibitMode = 'all' | 'maps' | 'photos';

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function mapSourceLabel(urlValue: string): string {
  try {
    const url = new URL(urlValue);
    const hostname = url.hostname.toLowerCase();

    if (hostname === 'atlas.microsoft.com' || hostname.endsWith('.atlas.microsoft.com')) {
      return 'Map source: Microsoft Azure Maps · licensed map service';
    }
    if (hostname.includes('arcgis') || hostname.endsWith('.esri.com')) {
      return 'Map source: Esri ArcGIS · public or licensed GIS service; verify layer terms';
    }
    if (hostname.endsWith('.fema.gov') || hostname === 'fema.gov') {
      return 'Map source: Federal Emergency Management Agency · public record';
    }
    if (hostname.endsWith('.gov')) {
      return `Map source: ${hostname} · public record; verify issuing authority and layer date`;
    }

    return `Map source host: ${hostname} · stored workfile reference; authority and license require verification`;
  } catch {
    return 'Map source: stored workfile reference · authority and license require verification';
  }
}

export default function SubjectPhotoExhibit({
  data,
  mode = 'all',
}: {
  data: ReportTemplateData;
  mode?: SubjectExhibitMode;
}) {
  const maps: ExhibitImage[] = mode === 'photos'
    ? []
    : [data.maps.regional, data.maps.neighborhood, data.maps.parcel]
      .filter((map): map is NonNullable<typeof map> => Boolean(map?.url))
      .map((map) => ({
        url: map.url,
        caption: map.caption,
        sourceLabel: mapSourceLabel(map.url),
      }));

  const photos: ExhibitImage[] = mode === 'maps'
    ? []
    : data.photos
      .filter((photo) => Boolean(photo.storage_path))
      .map((photo) => {
        const caption = getPhotoCaption(photo);
        return {
          url: photo.storage_path,
          caption: caption.text,
          captionSource: caption.source,
        };
      });

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
            These maps orient the subject within its regional, neighborhood, and parcel context. Each
            exhibit identifies the available source authority or host and evidence category. Map boundaries,
            labels, imagery, layer dates, and license terms must still be verified before use for filing,
            zoning, survey, access, flood, or legal-description purposes.
          </Text>
          <View style={styles.mapGrid}>
            {maps.map((map, index) => (
              <View key={index} style={styles.mapCard} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={map.url} style={[styles.mapImage, { height: mapHeight }]} />
                <Text style={styles.caption}>{map.caption}</Text>
                {map.sourceLabel && (
                  <Text style={styles.sourceLabel}>{map.sourceLabel}</Text>
                )}
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
              This exhibit preserves the subject imagery available in the Resourceful workfile. Every
              caption identifies whether it came from AI-assisted analysis, a submitted caption, a
              photo-type label, or an unlabeled fallback. Images and automated observations are not
              represented as a licensed inspection, engineering opinion, survey, or independent measurement.
            </Text>
          )}

          <View style={styles.pageGrid}>
            {pagePhotos.map((photo, photoIndex) => (
              <View key={`${pageIndex}-${photoIndex}`} style={styles.photoCard} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={photo.url} style={styles.photo} />
                <Text style={styles.caption}>{photo.caption}</Text>
                {photo.captionSource && (
                  <Text style={styles.captionSource}>Caption source: {photo.captionSource}</Text>
                )}
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
  },
  captionSource: {
    fontFamily: 'Inter',
    fontSize: 6.5,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  sourceLabel: {
    fontFamily: 'Inter',
    fontSize: 6.5,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  exhibitCounter: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: colors.inkMuted,
    textAlign: 'right',
    marginTop: 6,
  },
});