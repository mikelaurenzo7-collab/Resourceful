'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PropertyType, ServiceType } from '@/types/database';
import { getPriceCents, formatPrice } from '@/config/pricing';
import Button from '@/components/ui/Button';
import AddressInput from '@/components/intake/AddressInput';
import PropertyTypeSelector from '@/components/intake/PropertyTypeSelector';
import ServiceTypeSelector from '@/components/intake/ServiceTypeSelector';
import AssessmentCard from '@/components/intake/AssessmentCard';

interface AddressData {
  line1: string;
  city: string;
  state: string;
  zip: string;
  county: string;
}

interface AssessmentData {
  assessedValue: number;
  marketValueLow: number;
  marketValueHigh: number;
  assessmentRatio: number;
  taxRate: number;
}

export default function StartPage() {
  const router = useRouter();
  const [address, setAddress] = useState<AddressData | null>(null);
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleAddressSelect = (addr: AddressData) => {
    setAddress(addr);
    // Assessment data will be fetched after report is created
  };

  const canContinue = address && propertyType && serviceType;

  const handleContinue = async () => {
    if (!canContinue) return;
    setCreating(true);
    setError('');

    try {
      // Create the report in the database + get Stripe payment intent
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_address: address.line1,
          city: address.city,
          state: address.state,
          county: address.county,
          property_type: propertyType,
          service_type: serviceType,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Server error (${response.status})`);
      }

      const { reportId, clientSecret, priceCents } = await response.json();

      // Store in sessionStorage for subsequent intake steps
      sessionStorage.setItem(
        'intake',
        JSON.stringify({
          reportId,
          clientSecret,
          address,
          propertyType,
          serviceType,
          priceCents,
        })
      );

      // Fetch real assessment data in background (non-blocking)
      fetchAssessment(reportId);

      router.push('/start/photos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const fetchAssessment = async (reportId: string) => {
    setAssessmentLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/assessment`);
      if (!res.ok) return;
      const data = await res.json();
      setAssessment({
        assessedValue: data.assessedValue ?? 0,
        marketValueLow: data.marketValueRange?.low ?? 0,
        marketValueHigh: data.marketValueRange?.high ?? 0,
        assessmentRatio: data.assessmentRatio ?? 0,
        taxRate: data.taxAmount && data.assessedValue
          ? data.taxAmount / data.assessedValue
          : 0,
      });
    } catch {
      // Non-critical — assessment card just won't show
    } finally {
      setAssessmentLoading(false);
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
            <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center text-navy-deep font-bold">1</div>
            <span className="text-gold font-medium">Property Info</span>
            <div className="w-8 h-px bg-gold/20" />
            <div className="w-6 h-6 rounded-full border border-gold/20 flex items-center justify-center text-cream/30 font-bold">2</div>
            <span className="hidden sm:inline">Photos</span>
            <div className="w-8 h-px bg-gold/20" />
            <div className="w-6 h-6 rounded-full border border-gold/20 flex items-center justify-center text-cream/30 font-bold">3</div>
            <span className="hidden sm:inline">Measure</span>
            <div className="w-8 h-px bg-gold/20" />
            <div className="w-6 h-6 rounded-full border border-gold/20 flex items-center justify-center text-cream/30 font-bold">4</div>
            <span className="hidden sm:inline">Payment</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Page title */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="font-display text-3xl md:text-4xl text-cream mb-3">
            Get Your Property Report
          </h1>
          <p className="text-cream/50 max-w-lg mx-auto">
            Enter your property address and we&apos;ll analyze your assessment,
            find comparable sales, and estimate your potential savings.
          </p>
        </div>

        <div className="space-y-10 animate-slide-up">
          {/* Step 1: Address */}
          <section>
            <AddressInput onAddressSelect={handleAddressSelect} />
          </section>

          {/* Step 2: Property Type */}
          <section className={`transition-all duration-500 ${address ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <PropertyTypeSelector selected={propertyType} onChange={setPropertyType} />
          </section>

          {/* Step 3: Service Type */}
          <section className={`transition-all duration-500 ${propertyType ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <ServiceTypeSelector
              selected={serviceType}
              propertyType={propertyType}
              onChange={setServiceType}
            />
          </section>

          {/* Assessment Card - appears after assessment data fetched */}
          {assessment && address && propertyType && serviceType && (
            <section className="animate-slide-up">
              <AssessmentCard
                address={`${address.line1}, ${address.city}, ${address.state} ${address.zip}`}
                assessedValue={assessment.assessedValue}
                estimatedMarketValueLow={assessment.marketValueLow}
                estimatedMarketValueHigh={assessment.marketValueHigh}
                assessmentRatio={assessment.assessmentRatio}
                taxRate={assessment.taxRate}
                reportPrice={getPriceCents(serviceType, propertyType)}
              />
            </section>
          )}

          {assessmentLoading && (
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-cream/40">Loading assessment data...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-500/20 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Continue button */}
          <div className="pt-4">
            <Button
              size="lg"
              fullWidth
              disabled={!canContinue || creating}
              loading={creating}
              onClick={handleContinue}
            >
              {creating ? 'Setting up your report...' : 'Continue to Photos'}
              {!creating && (
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              )}
            </Button>
            {!canContinue && (
              <p className="text-center text-xs text-cream/30 mt-3">
                Complete all selections above to continue
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
