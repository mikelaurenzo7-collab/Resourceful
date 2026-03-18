'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PhotoUploader from '@/components/intake/PhotoUploader';
import Button from '@/components/ui/Button';
import type { PropertyType, PhotoType } from '@/types/database';

// ─── 24-Hour Photo Window ───────────────────────────────────────────────────

const PHOTO_WINDOW_HOURS = 24;

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Window closed';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

interface ReportData {
  propertyAddress: string;
  propertyType: PropertyType;
  createdAt: string;
  estimatedSavings?: number;
}

export default function ReportPhotosPage() {
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoCount, setPhotoCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(PHOTO_WINDOW_HOURS * 60 * 60 * 1000);

  // Fetch report data
  useEffect(() => {
    if (!reportId) return;

    fetch(`/api/reports/${reportId}/viewer`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          const createdAt = data.createdAt || data.pipelineStartedAt || data.deliveredAt || new Date().toISOString();
          setReport({
            propertyAddress: data.propertyAddress || 'Your Property',
            propertyType: (data.propertyType as PropertyType) || 'residential',
            createdAt,
            estimatedSavings: data.potentialSavings,
          });

          // Calculate remaining time from report creation
          const elapsed = Date.now() - new Date(createdAt).getTime();
          const remaining = Math.max(0, PHOTO_WINDOW_HOURS * 60 * 60 * 1000 - elapsed);
          setTimeRemaining(remaining);
        }
      })
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false));
  }, [reportId]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFileUpload = async (file: File, photoType: PhotoType, caption: string): Promise<boolean> => {
    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('photo_type', photoType);
      formData.append('sort_order', String(photoCount));
      if (caption) formData.append('caption', caption);

      const res = await fetch(`/api/reports/${reportId}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }

      setPhotoCount((prev) => prev + 1);
      return true;
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Photo upload failed.');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const photoWindowOpen = timeRemaining > 0;

  /** Signal "I'm done" — triggers pipeline immediately, then redirect to report */
  const handleDone = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/reports/${reportId}/ready`, { method: 'POST' });
    } catch {
      // Non-critical — cron will catch it if this fails
    }
    window.location.href = `/report/${reportId}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl text-cream mb-4">Report Not Found</h1>
          <p className="text-cream/50 text-sm mb-6">{error || 'Unable to load this report.'}</p>
          <Button onClick={() => window.location.href = '/'}>Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern">
      {/* Header */}
      <header className="border-b border-gold/10 bg-navy-deep/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => window.location.href = `/report/${reportId}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
              <span className="text-navy-deep font-bold text-sm">R</span>
            </div>
            <span className="font-display text-lg text-cream">Resourceful</span>
          </button>

          {photoWindowOpen && (
            <span className="text-xs bg-gold/10 text-gold/80 rounded-full px-3 py-1 font-medium">
              {formatTimeRemaining(timeRemaining)}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="font-display text-3xl text-cream mb-3">
            Strengthen Your Evidence
          </h1>
          <p className="text-cream/50 max-w-lg mx-auto leading-relaxed">
            Your report for <span className="text-cream font-medium">{report.propertyAddress}</span> will
            be built with comparable sales, market data, and any photos you upload.
            {report.estimatedSavings && report.estimatedSavings > 0 && (
              <> We found <span className="text-emerald-400 font-medium">
                ${report.estimatedSavings.toLocaleString('en-US')}/year
              </span> in potential savings.</>
            )}
            {' '}Upload photos to make your evidence package even stronger.
          </p>
        </div>

        {/* Photo tips */}
        <div className="rounded-xl border border-gold/15 bg-navy-light/50 p-5 mb-8 animate-slide-up">
          <h3 className="text-sm font-medium text-cream mb-3">What to Photograph</h3>
          <ul className="space-y-2">
            {[
              'Water stains, cracks, mold — basement and crawl spaces are powerful evidence',
              'Include a ruler or coin for scale on damage photos',
              'Take both close-up AND wide-angle shots of each issue',
              'Photograph utility rooms, water heaters, furnaces, electrical panels',
              'Outdated kitchens, bathrooms, and fixtures reduce market value',
              'Don\'t clean up first — show the property as-is',
              'Describe each photo when you upload — tell us what we\'re looking at',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-cream/50">
                <span className="text-gold/50 mt-0.5">&#x2022;</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div className="mb-6 rounded-lg bg-red-900/20 border border-red-500/20 p-3 text-sm text-red-400">
            {uploadError}
          </div>
        )}

        {/* Photo uploader */}
        <div className="animate-slide-up">
          <PhotoUploader
            propertyType={report.propertyType}
            onPhotosChange={(photos) => setPhotoCount(photos.length)}
            onFileUpload={handleFileUpload}
          />
        </div>

        {/* Navigation */}
        <div className="flex gap-4 mt-10 pt-6 border-t border-gold/10">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => window.location.href = `/report/${reportId}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Back to Report
          </Button>
          <Button
            size="lg"
            fullWidth
            disabled={uploading || submitting}
            loading={submitting}
            onClick={handleDone}
          >
            {submitting
              ? 'Starting your report...'
              : photoCount > 0
                ? `Done — Build my report with ${photoCount} photo${photoCount !== 1 ? 's' : ''}`
                : 'No photos — Build my report now'}
            {!submitting && (
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            )}
          </Button>
        </div>

        <p className="text-center text-[10px] text-cream/20 mt-6">
          No photos? No problem — your report will still include comparable sales analysis
          and independent market data. Photos just make your evidence package stronger.
        </p>
      </main>
    </div>
  );
}
