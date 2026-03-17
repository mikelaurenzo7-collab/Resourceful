'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard, PROPERTY_ISSUES } from '@/components/intake/WizardLayout';
import Button from '@/components/ui/Button';
import PhotoUploader from '@/components/intake/PhotoUploader';
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
    setCurrentStep(4);
    if (!state.address) router.push('/start/property');
  }, [setCurrentStep, state.address, router]);

  // Auto-fetch Street View when address is available
  useEffect(() => {
    if (state.address && !streetViewLoaded) {
      const addr = `${state.address.line1}, ${state.address.city}, ${state.address.state} ${state.address.zip}`;
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (key) {
        const url = `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${encodeURIComponent(addr)}&key=${key}`;
        setStreetViewUrl(url);
        setStreetViewLoaded(true);
      }
    }
  }, [state.address, streetViewLoaded]);

  // Get photo tips based on selected issues
  const selectedIssues = PROPERTY_ISSUES.filter((i) => state.propertyIssues.includes(i.id));

  const handleSkip = () => {
    updateState({ photosSkipped: true, photoCount: 0 });
    router.push('/start/payment');
  };

  const handleFileUpload = async (file: File, photoType: PhotoType): Promise<boolean> => {
    if (!state.reportId) return false;
    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('photo_type', photoType);
      formData.append('sort_order', String(state.photoCount));

      const res = await fetch(`/api/reports/${state.reportId}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }

      return true;
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Photo upload failed.');
      return false;
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10 animate-fade-in">
        <h1 className="font-display text-3xl text-cream mb-3">Property Photos</h1>
        <p className="text-cream/50 max-w-lg mx-auto">
          Photos are your strongest evidence. We&apos;ve already captured your exterior — now document any interior issues.
        </p>
      </div>

      {/* Auto-captured exterior */}
      {streetViewUrl && (
        <div className="mb-8 animate-slide-up">
          <div className="rounded-xl overflow-hidden border border-gold/15">
            <div className="bg-gold/5 px-4 py-2 border-b border-gold/10 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            Google Street View — we&apos;ll include this in your report automatically
          </p>
        </div>
      )}

      {/* Photo education section */}
      {selectedIssues.length > 0 && !showUploader && (
        <div className="space-y-4 mb-8 animate-slide-up">
          <h2 className="text-sm font-medium text-cream/70 flex items-center gap-2">
            <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Based on your selected issues, here&apos;s what to photograph:
          </h2>

          {selectedIssues.map((issue) => (
            <div key={issue.id} className="card-premium rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg">{issue.icon}</span>
                <div>
                  <p className="text-sm font-medium text-cream">{issue.label}</p>
                  <p className="text-xs text-gold/70 mt-1 leading-relaxed">{issue.photoTip}</p>
                </div>
              </div>
            </div>
          ))}

          {/* General photo tips */}
          <div className="rounded-xl border border-gold/15 bg-navy-light/50 p-5">
            <h3 className="text-sm font-medium text-cream mb-3">Photo Tips for Best Results</h3>
            <ul className="space-y-2">
              {[
                'Include a ruler, coin, or your hand for scale on damage photos',
                'Take both a close-up AND a wide-angle shot of each issue',
                'Use natural lighting when possible — open blinds, turn on lights',
                'Don\'t clean up first — show the property as-is',
                'Photograph all four exterior sides if possible (we got the front)',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-cream/50">
                  <span className="text-gold/50 mt-0.5">&#x2022;</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* No issues selected — general guidance */}
      {selectedIssues.length === 0 && !showUploader && (
        <div className="mb-8 animate-slide-up">
          <div className="card-premium rounded-xl p-6 text-center">
            <p className="text-sm text-cream/60 mb-2">No specific issues selected</p>
            <p className="text-xs text-cream/40">
              You can still upload photos of your property to strengthen your report.
              Exterior photos, kitchen, bathrooms, and any deferred maintenance are most impactful.
            </p>
          </div>
        </div>
      )}

      {/* Upload section */}
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

      {/* Action buttons */}
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
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              I Have Photos to Upload
            </Button>

            <button
              onClick={handleSkip}
              className="w-full text-center py-3 text-sm text-cream/40 hover:text-cream/60 transition-colors"
            >
              Skip photos — data-only analysis (no money-back guarantee)
            </button>

            {/* Why photos matter + guarantee */}
            <div className="rounded-xl border border-amber-500/15 bg-amber-950/10 p-4 text-left space-y-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-400/70 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-400/80">Why Photos Unlock the Guarantee</p>
                  <p className="text-xs text-cream/40 mt-1 leading-relaxed">
                    Your county assessor has <span className="text-cream/60">never been inside your property</span>. They assume average condition based on age, size, and neighborhood — nothing more.
                  </p>
                  <p className="text-xs text-cream/40 mt-1.5 leading-relaxed">
                    Photos let us document what the assessor can&apos;t see: aging roofs, deferred maintenance, outdated kitchens, water damage, foundation issues. This is evidence that directly reduces your assessed value — and evidence the assessor simply doesn&apos;t have.
                  </p>
                  <p className="text-xs text-cream/40 mt-1.5 leading-relaxed">
                    Without photos, we can only argue based on the same public data the assessor already used. With photos, we build a case they can&apos;t refute. That&apos;s why we guarantee photo-backed reports — and can&apos;t guarantee data-only ones.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex gap-4 pt-6 border-t border-gold/10">
            <Button variant="secondary" size="lg" onClick={() => setShowUploader(false)}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              Back
            </Button>
            <Button
              size="lg"
              fullWidth
              disabled={uploading}
              onClick={() => router.push('/start/payment')}
            >
              {state.photoCount > 0
                ? `Continue with ${state.photoCount} photo${state.photoCount !== 1 ? 's' : ''}`
                : 'Continue to Payment'}
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
          </div>
        )}
      </div>

      {/* Back to situation (when uploader is not showing) */}
      {!showUploader && (
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/start/situation')}>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Back to property details
          </Button>
        </div>
      )}
    </main>
  );
}
