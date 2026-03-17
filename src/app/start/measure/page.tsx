'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import MeasurementTool from '@/components/intake/MeasurementTool';

export default function MeasurePage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [reportId, setReportId] = useState<string | null>(null);
  const [attomGBA, setAttomGBA] = useState<number | null>(null);
  const [measurementComplete, setMeasurementComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('intake');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.address) {
        const a = data.address;
        setAddress(`${a.line1}, ${a.city}, ${a.state} ${a.zip}`);
      }
      if (data.reportId) setReportId(data.reportId);

      // Fetch ATTOM GBA from the assessment endpoint if we have a reportId
      if (data.reportId) {
        fetch(`/api/reports/${data.reportId}/assessment`)
          .then((res) => res.ok ? res.json() : null)
          .then((assessment) => {
            if (assessment?.propertySummary?.buildingSqFt) {
              setAttomGBA(assessment.propertySummary.buildingSqFt);
            }
          })
          .catch(() => {});
      }
    } else {
      router.push('/start');
    }
  }, [router]);

  const handleMeasurementComplete = async (data: { measuredSqFt: number; source: 'map' | 'manual' }) => {
    if (!reportId) {
      setMeasurementComplete(true);
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/reports/${reportId}/measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: data.source === 'map' ? 'google_earth' : 'user_submitted',
          total_living_area_sqft: data.measuredSqFt,
          attom_gba_sqft: attomGBA,
          discrepancy_flagged: attomGBA
            ? Math.abs((data.measuredSqFt - attomGBA) / attomGBA) > 0.05
            : false,
          discrepancy_pct: attomGBA
            ? Math.round(((data.measuredSqFt - attomGBA) / attomGBA) * 10000) / 100
            : null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save measurement');
      }

      setMeasurementComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save measurement.');
      // Still allow continuation even if save fails — data is non-critical
      setMeasurementComplete(true);
    } finally {
      setSaving(false);
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

        {error && (
          <div className="mb-6 rounded-lg bg-red-900/20 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="animate-slide-up">
          <MeasurementTool
            address={address || 'Your property address'}
            attomGBA={attomGBA}
            onMeasurementComplete={handleMeasurementComplete}
          />
        </div>

        {saving && (
          <div className="flex items-center justify-center gap-3 py-4 mt-4">
            <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-cream/40">Saving measurement...</span>
          </div>
        )}

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
