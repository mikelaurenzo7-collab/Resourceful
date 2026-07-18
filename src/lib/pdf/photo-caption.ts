import type { Photo } from '@/types/database';

export type PhotoCaptionSource =
  | 'AI-assisted description'
  | 'Submitted caption'
  | 'Photo-type label'
  | 'Unlabeled image';

export interface PhotoCaptionPresentation {
  text: string;
  source: PhotoCaptionSource;
}

function titleCasePhotoType(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getPhotoCaption(photo: Photo): PhotoCaptionPresentation {
  const aiCaption = photo.ai_analysis?.professional_caption?.trim();
  if (aiCaption) {
    return { text: aiCaption, source: 'AI-assisted description' };
  }

  const submittedCaption = photo.caption?.trim();
  if (submittedCaption) {
    return { text: submittedCaption, source: 'Submitted caption' };
  }

  if (photo.photo_type) {
    return {
      text: titleCasePhotoType(photo.photo_type),
      source: 'Photo-type label',
    };
  }

  return { text: 'Subject property image', source: 'Unlabeled image' };
}
