'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PropertyType } from '@/types/database';
import Button from '@/components/ui/Button';
import PhotoUploader from '@/components/intake/PhotoUploader';

const MIN_PHOTOS: Record<PropertyType, number> = {
  residential: 8,
  commercial: 10,
  industrial: 10,
  land: 4,
};

export default function PhotosPage() {
  const router = useRouter();
  const [propertyType, setPropertyType] = useState<PropertyType>('residential');
  const [photoCount, setPhotoCount] = useState(0);

  useEffect(() => {
    const raw = sessionStorage.getItem('intake');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.propertyType) setPropertyType(data.propertyType);
    }
  }, []);

  const minRequired = MIN_PHOTOS[propertyType];
  const canContinue = photoCount >= minRequired;

  const handleContinue = () => {
    router.push('/start/measure');
  };

  return (
    <div className="min-h-screen bg-pattern">
      {/* Header */}
      <header className="border-b border-gold/10 bg-navy-deep/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
              <span className="text-navy-deep font-bold text-sm">R</span>
            </div>
            <span className="font-display text-lg text-cream">Resourceful</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-cream/40">
            <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold font-bold">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Info</span>
            <div className="w-8 h-px bg-gold/40" />
            <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center text-navy-deep font-bold">2</div>
            <span className="text-gold font-medium">Photos</span>
            <div className="w-8 h-px bg-gold/20" />
            <div className="w-6 h-6 rounded-full border border-gold/20 flex items-center justify-center text-cream/30 font-bold">3</div>
            <span className="hidden sm:inline">Measure</span>
            <div className="w-8 h-px bg-gold/20" />
            <div className="w-6 h-6 rounded-full border border-gold/20 flex items-center justify-center text-cream/30 font-bold">4</div>
            <span className="hidden sm:inline">Payment</span>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-navy-light">
        <div className="h-full bg-gradient-to-r from-gold-light via-gold to-gold-dark w-2/4 transition-all duration-500" />
      </div>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="font-display text-3xl text-cream mb-3">
            Property Photos
          </h1>
          <p className="text-cream/50 max-w-lg mx-auto">
            Photos are essential evidence for your report. Each angle serves a specific
            purpose in documenting your property&apos;s condition and value.
          </p>
        </div>

        {/* Minimum requirement badge */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="card-premium rounded-full px-5 py-2.5 flex items-center gap-3">
            <svg className="w-5 h-5 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm text-cream/60">
              Minimum <span className="text-gold font-semibold">{minRequired}</span> photos required for{' '}
              <span className="text-cream capitalize">{propertyType}</span> properties
            </span>
          </div>
        </div>

        <div className="animate-slide-up">
          <PhotoUploader
            propertyType={propertyType}
            onPhotosChange={(photos) => setPhotoCount(photos.length)}
          />
        </div>

        {/* Navigation */}
        <div className="flex gap-4 mt-10 pt-6 border-t border-gold/10">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.push('/start')}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Back
          </Button>
          <Button
            size="lg"
            fullWidth
            disabled={!canContinue}
            onClick={handleContinue}
          >
            Continue to Measurement
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Button>
        </div>
        {!canContinue && (
          <p className="text-center text-xs text-cream/30 mt-3">
            Upload at least {minRequired} photos to continue
          </p>
        )}
      </main>
    </div>
  );
}
