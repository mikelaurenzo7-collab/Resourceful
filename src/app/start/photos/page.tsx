'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import PhotoUploader from '@/components/intake/PhotoUploader';
import {
  PROPERTY_ISSUES,
  PropertyIssueIcon,
  useWizard,
} from '@/components/intake/WizardLayout';
import Button from '@/components/ui/Button';
import { trackFunnelEventOnce } from '@/lib/analytics/funnel-client';
import { buildSafeFunnelProperties } from '@/lib/analytics/funnel-contract';
import type { PhotoType } from '@/types/database';

export default function PhotosPage() {
  const router = useRouter();
  const { state, updateState, setCurrentStep } = useWizard();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [streetViewLoaded, setStreetViewLoaded] = useState(false);
  const [streetViewUrl, setStreetViewUrl] = useState<string | null>(null);

  useEffect(() => {
    setCurrentStep(5);
    if (!state.reportId) router.push('/start/payment');
  }, [setCurrentStep, state.reportId, router]);

  // Auto-fetch street-level imagery via Mapillary when address is available
  useEffect(() => {
    if (state.address && !streetViewLoaded) {
      setStreetViewLoaded(true);
      // Fetch Mapillary image via server-side API to keep token safe
      const addr = `${state.address.line1}, ${state.address.city}, ${state.address.state} ${state.address.zip}`;
      fetch(`/api/address-search?q=${encodeURIComponent(addr)}`)
        .then((res) => res.json())
        .then((data) => {
          const suggestion = data.suggestions?.[0];
          if (suggestion?.latitude && suggestion?.longitude) {
            const token = process.env.NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN;
            if (token) {
              const bbox = `${suggestion.longitude - 0.001},${suggestion.latitude - 0.001},${suggestion.longitude + 0.001},${suggestion.latitude + 0.001}`;
              fetch(`https://graph.mapillary.com/images?access_token=${token}&fields=thumb_2048_url&bbox=${bbox}&limit=1`)
                .then((response) => response.json())
                .then((result) => {
                  const url = result?.data?.[0]?.thumb_2048_url;
                  if (url) setStreetViewUrl(url);
                })
                .catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  }, [state.address, streetViewLoaded]);

  const selectedIssues = PROPERTY_ISSUES.filter((issue) => state.propertyIssues.includes(issue.id));

  const completePhotoStep = (photoCount: number) => {
    const photosSkipped = photoCount <= 0;
    const properties = buildSafeFunnelProperties({
      pathname: '/start/photos',
      currentStep: 5,
      serviceType: state.serviceType,
      propertyType: state.propertyType,
      reviewTier: state.reviewTier,
      hasTaxBill: state.hasTaxBill,
      photoCount,
      photosSkipped,
      propertyIssueCount: state.propertyIssues.length,
      priceCents: state.priceCents,
      hasContext: state.desiredOutcome.trim().length > 0,
    });

    trackFunnelEventOnce(
      photosSkipped ? 'Resourceful Photo Evidence Skipped' : 'Resourceful Photo Evidence Added',
      photosSkipped ? 'skipped' : 'added',
      properties,
    );

    updateState({ photosSkipped, photoCount });
    sessionStorage.removeItem('wizard');
    router.push(`/start/success?reportId=${state.reportId}`);
  };

  const handleFileUpload = async (
    file: File,
    photoType: PhotoType,
    caption: string,
  ): Promise<boolean> => {
    if (!state.reportId) return false;
    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('photo_type', photoType);
      formData.append('sort_order', String(state.photoCount));
      if (caption) formData.append('caption', caption);

      const response = await fetch(`/api/reports/${state.reportId}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }

      return true;
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Photo upload failed.');
      return false;
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10 animate-fade-in">
        <span className="inline-block text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase mb-3">
          Step 5 — Your Evidence
        </span>
        <h1 className="font-display text-3xl text-cream mb-3">Your Property, Your Evidence</h1>
        <p className="text-cream/50 max-w-lg mx-auto leading-relaxed">
          Photos preserve visible condition, layout, maintenance, and context that public records often
          cannot show.
          <span className="text-gold/70"> They help reviewers decide what can be supported.</span>
        </p>
        <p className="text-xs text-cream/30 mt-3 max-w-md mx-auto">
          AI-assisted photo review identifies visible observations and captions. Any valuation effect
          still needs corroborating evidence, comparable support, and human review.
        </p>
      </div>

      {streetViewUrl && (
        <div className="mb-8 animate-slide-up">
          <div className="rounded-xl overflow-hidden border border-gold/15">
            <div className="bg-gold/5 px-4 py-2 border-b border-gold/10 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs text-emerald-400 font-medium">Exterior captured automatically</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={streetViewUrl}
              alt="Street View of your property"
              className="w-full h-48 object-cover"
              onError={() => setStreetViewUrl(null)}
            />
          </div>
          <p className="text-xs text-cream/30 mt-2 text-center">
            Street-level imagery — we&apos;ll include this in your report automatically
          </p>
        </div>
      )}

      {selectedIssues.length > 0 && !showUploader && (
        <div className="space-y-4 mb-8 animate-slide-up">
          <h2 className="text-sm font-medium text-cream/70 flex items-center gap-2">
            <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Based on your selected issues, here&apos;s what to photograph:
          </h2>

          {selectedIssues.map((issue) => (
            <div key={issue.id} className="card-premium rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-gold/70">
                  <PropertyIssueIcon issue={issue} />
                </span>
                <div>
                  <p className="text-sm font-medium text-cream">{issue.label}</p>
                  <p className="text-xs text-gold/70 mt-1 leading-relaxed">{issue.photoTip}</p>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-gold/15 bg-navy-light/50 p-5">
            <h3 className="text-sm font-medium text-cream mb-3">How to Take Useful Evidence Photos</h3>
            <ul className="space-y-2">
              {[
                'Basement and crawl space photos are often useful when they show water stains, cracks, mold, aging mechanicals, or other visible conditions',
                'Include a ruler, coin, or your hand for scale on damage photos',
                'Take both a close-up AND a wide-angle shot of each issue',
                'Use natural lighting when possible, and turn on lights so the condition is legible',
                'Show the property as-is, but do not create hazards or disturb suspected hazardous materials',
                'Photograph utility rooms, water heaters, furnaces, and electrical panels when they are safely accessible',
                'Describe each photo when you upload it so the reviewer knows what is shown and why it may matter',
                'Prioritize clear, relevant photos over volume',
              ].map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-xs text-cream/50">
                  <span className="text-gold/50 mt-0.5">&#x2022;</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {selectedIssues.length === 0 && !showUploader && (
        <div className="mb-8 animate-slide-up">
          <div className="card-premium rounded-xl p-6 text-center">
            <p className="text-sm text-cream/60 mb-2">No specific issues selected — that&apos;s fine</p>
            <p className="text-xs text-cream/40 leading-relaxed">
              Even without specific problems, photos of your property&apos;s actual condition
              can help explain the workfile. Show kitchens, bathrooms, basements, mechanicals,
              exterior condition, and any areas showing age or wear.
            </p>
          </div>
        </div>
      )}

      {showUploader && state.propertyType && (
        <div className="animate-slide-up">
          {uploadError && (
            <div className="mb-6 rounded-lg bg-red-900/20 border border-red-500/20 p-3 text-sm text-red-400">
              {uploadError}
            </div>
          )}
          <PhotoUploader
            propertyType={state.propertyType}
            onPhotosChange={(photos) => updateState({ photoCount: photos.length })}
            onFileUpload={state.reportId ? handleFileUpload : undefined}
          />
        </div>
      )}

      <div className="space-y-4 mt-8">
        {!showUploader ? (
          <>
            <Button
              size="lg"
              fullWidth
              onClick={() => {
                updateState({ photosSkipped: false });
                setShowUploader(true);
              }}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              I Have Photos to Upload
            </Button>

            <button
              onClick={() => completePhotoStep(0)}
              className="w-full text-center py-3 text-sm text-cream/40 hover:text-cream/60 transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 rounded-lg"
            >
              Continue without photos
            </button>

            <div className="rounded-xl border border-gold/15 bg-navy-light/50 p-4 text-left space-y-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gold/70 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-cream">Why Property Photos Matter</p>
                  <p className="text-xs text-cream/40 mt-1 leading-relaxed">
                    Public assessment records usually describe age, size, class, and exterior characteristics. They often do not capture the current interior condition, layout limitations, repairs, or maintenance history that may matter to a reviewer.
                  </p>
                  <p className="text-xs text-cream/40 mt-1.5 leading-relaxed">
                    Photos help document what is visible now: cracked foundations, water staining, dated finishes, aging mechanicals, exterior wear, site constraints, or other facts that may not appear in public data.
                  </p>
                  <p className="text-xs text-cream/40 mt-1.5 leading-relaxed">
                    <span className="text-gold/60 font-medium">Prioritize clarity over volume.</span> Basements, crawl spaces, utility rooms, damaged areas, and representative interior spaces are useful when safe to photograph. Describe each photo so reviewers can reference it precisely.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex gap-4 pt-2">
            <Button variant="secondary" size="lg" onClick={() => setShowUploader(false)}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              Back
            </Button>
            <Button
              size="lg"
              fullWidth
              disabled={uploading}
              onClick={() => completePhotoStep(state.photoCount)}
            >
              {state.photoCount > 0
                ? `Continue with ${state.photoCount} photo${state.photoCount !== 1 ? 's' : ''}`
                : 'Continue without photos'}
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
          </div>
        )}
      </div>

      {!showUploader && (
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/start/payment')}>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Back to payment
          </Button>
        </div>
      )}
    </main>
  );
}
