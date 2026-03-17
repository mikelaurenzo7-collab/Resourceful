'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import MeasurementTool from '@/components/intake/MeasurementTool';

export default function MeasurePage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [measurementComplete, setMeasurementComplete] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('intake');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.address) {
        const a = data.address;
        setAddress(`${a.line1}, ${a.city}, ${a.state} ${a.zip}`);
      }
    }
  }, []);

  const handleMeasurementComplete = (data: { measuredSqFt: number; source: 'map' | 'manual' }) => {
    setMeasurementComplete(true);
    // Store measurement in session
    const raw = sessionStorage.getItem('intake');
    if (raw) {
      const intake = JSON.parse(raw);
      intake.measurement = data;
      sessionStorage.setItem('intake', JSON.stringify(intake));
    }
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
            <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold font-bold">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Photos</span>
            <div className="w-8 h-px bg-gold/40" />
            <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center text-navy-deep font-bold">3</div>
            <span className="text-gold font-medium">Measure</span>
            <div className="w-8 h-px bg-gold/20" />
            <div className="w-6 h-6 rounded-full border border-gold/20 flex items-center justify-center text-cream/30 font-bold">4</div>
            <span className="hidden sm:inline">Payment</span>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-navy-light">
        <div className="h-full bg-gradient-to-r from-gold-light via-gold to-gold-dark w-3/4 transition-all duration-500" />
      </div>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="font-display text-3xl text-cream mb-3">
            Verify Building Measurements
          </h1>
          <p className="text-cream/50 max-w-lg mx-auto">
            Accurate square footage is critical for your assessment analysis.
            Discrepancies between recorded and actual measurements can strengthen your appeal.
          </p>
        </div>

        <div className="animate-slide-up">
          <MeasurementTool
            address={address || 'Your property address'}
            attomGBA={1850}
            onMeasurementComplete={handleMeasurementComplete}
          />
        </div>

        {/* Navigation */}
        <div className="flex gap-4 mt-10 pt-6 border-t border-gold/10">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.push('/start/photos')}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Back
          </Button>
          <Button
            size="lg"
            fullWidth
            disabled={!measurementComplete}
            onClick={() => router.push('/start/payment')}
          >
            Continue to Payment
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Button>
        </div>
        {!measurementComplete && (
          <p className="text-center text-xs text-cream/30 mt-3">
            Complete a measurement to continue
          </p>
        )}
      </main>
    </div>
  );
}
