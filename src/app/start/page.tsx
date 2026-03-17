'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PropertyType, ServiceType } from '@/types/database';
import { PRICING, formatPrice } from '@/config/pricing';
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

export default function StartPage() {
  const router = useRouter();
  const [address, setAddress] = useState<AddressData | null>(null);
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);

  const handleAddressSelect = (addr: AddressData) => {
    setAddress(addr);
    // Simulate assessment data lookup after address entry
    setTimeout(() => setShowAssessment(true), 600);
  };

  const canContinue = address && propertyType && serviceType;

  const handleContinue = () => {
    if (!canContinue) return;
    // Store selections in sessionStorage for subsequent steps
    sessionStorage.setItem(
      'intake',
      JSON.stringify({
        address,
        propertyType,
        serviceType,
        priceCents: PRICING[serviceType][propertyType],
      })
    );
    router.push('/start/photos');
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

          {/* Assessment Card - appears after address entry */}
          {showAssessment && address && propertyType && serviceType && (
            <section className="animate-slide-up">
              <AssessmentCard
                address={`${address.line1}, ${address.city}, ${address.state} ${address.zip}`}
                assessedValue={32500}
                estimatedMarketValueLow={245000}
                estimatedMarketValueHigh={285000}
                assessmentRatio={0.133}
                taxRate={0.0694}
                reportPrice={PRICING[serviceType][propertyType]}
              />
            </section>
          )}

          {/* Continue button */}
          <div className="pt-4">
            <Button
              size="lg"
              fullWidth
              disabled={!canContinue}
              onClick={handleContinue}
            >
              Continue to Photos
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
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
