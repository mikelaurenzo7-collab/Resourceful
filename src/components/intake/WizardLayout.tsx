'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PropertyType, ServiceType, ReviewTier } from '@/types/database';
import Wordmark from '@/components/ui/Wordmark';

// ─── Wizard State ────────────────────────────────────────────────────────────

export interface PropertyIssue {
  id: string;
  label: string;
  description: string;
  photoTip: string;
  iconPath: string;
}

export interface TaxBillData {
  assessedValue: number | null;
  taxAmount: number | null;
  taxYear: string | null;
  pin: string | null;
}

export interface ValuationResult {
  assessedValue: number;
  estimatedOverassessment: number;
  estimatedAnnualSavings: number;
  countyName: string | null;
}

export interface WizardState {
  // Step 1: Goals
  serviceType: ServiceType | null;
  desiredOutcome: string;
  // Step 2: Property + tax bill
  address: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    county: string;
  } | null;
  propertyType: PropertyType | null;
  hasTaxBill: boolean;
  taxBillData: TaxBillData | null;
  // Step 3: Situation
  propertyIssues: string[]; // IDs from PROPERTY_ISSUES
  additionalNotes: string;
  ownerOccupied: boolean | null;
  yearsOwned: string;
  previousAppeal: boolean | null;
  // Step 4: Photos
  photosSkipped: boolean;
  photoCount: number;
  streetViewUrls: string[]; // auto-fetched exterior images
  // Step 5: Measurements
  measurementSkipped: boolean;
  measurementComplete: boolean;
  // Review tier
  reviewTier: ReviewTier;
  // Backend IDs
  reportId: string | null;
  clientSecret: string | null;
  priceCents: number;
  // Post-payment valuation (shown after payment, before full report)
  valuationResult: ValuationResult | null;
}

const INITIAL_STATE: WizardState = {
  serviceType: null,
  desiredOutcome: '',
  address: null,
  propertyType: null,
  hasTaxBill: false,
  taxBillData: null,
  propertyIssues: [],
  additionalNotes: '',
  ownerOccupied: null,
  yearsOwned: '',
  previousAppeal: null,
  photosSkipped: false,
  photoCount: 0,
  streetViewUrls: [],
  measurementSkipped: false,
  measurementComplete: false,
  reviewTier: 'auto',
  reportId: null,
  clientSecret: null,
  priceCents: 0,
  valuationResult: null,
};

// ─── Known Property Issues ──────────────────────────────────────────────────

export const PROPERTY_ISSUES: PropertyIssue[] = [
  {
    id: 'water_damage',
    label: 'Water Damage / Leaks',
    description: 'Stains on ceilings or walls, active leaks, water intrusion',
    photoTip: 'Photograph stains, leak locations, and affected areas. Include close-ups and wider views showing extent.',
    iconPath: 'M12 3.75c3 3.35 5 6.12 5 9.05A5 5 0 0 1 7 12.8c0-2.93 2-5.7 5-9.05Z',
  },
  {
    id: 'mold',
    label: 'Mold / Mildew',
    description: 'Visible mold growth on walls, ceilings, or around fixtures',
    photoTip: 'Photograph visible growth and surrounding surfaces. Include scale when safe and avoid disturbing suspected material.',
    iconPath: 'M12 4v16m-6-8h12M7 7l10 10M17 7 7 17',
  },
  {
    id: 'foundation_cracks',
    label: 'Foundation Cracks',
    description: 'Cracks in foundation walls, basement floor, or exterior base',
    photoTip: 'Photograph each crack with scale and a wider context photo showing its location and direction.',
    iconPath: 'M4 20h16M6 20V8l6-4 6 4v12M10 20l2-5-2-3 4-4',
  },
  {
    id: 'roof_damage',
    label: 'Roof Damage',
    description: 'Missing shingles, sagging areas, visible deterioration',
    photoTip: 'Photograph visible roof wear safely from the ground or from existing records. Do not climb onto unsafe areas.',
    iconPath: 'M3 12 12 5l9 7M5 10v10h14V10',
  },
  {
    id: 'hvac_issues',
    label: 'HVAC / Mechanical Issues',
    description: 'Aging or non-functional heating, cooling, or ventilation',
    photoTip: 'Photograph equipment, nameplates, visible deterioration, service tags, and any supporting repair documentation.',
    iconPath: 'M12 3v18M5 6l14 12M19 6 5 18',
  },
  {
    id: 'plumbing',
    label: 'Plumbing Problems',
    description: 'Leaking pipes, low water pressure, outdated fixtures',
    photoTip: 'Photograph visible corrosion, leaks, damaged cabinets, fixture condition, and supporting repair estimates if available.',
    iconPath: 'M4 7h10a4 4 0 0 1 4 4v1M7 7V4m5 10c2 2 3 3.6 3 5a3 3 0 0 1-6 0c0-1.4 1-3 3-5Z',
  },
  {
    id: 'electrical',
    label: 'Electrical Concerns',
    description: 'Outdated wiring, insufficient outlets, panel issues',
    photoTip: 'Photograph the panel, visible wiring concerns, labels, and any electrician reports. Do not touch unsafe wiring.',
    iconPath: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  },
  {
    id: 'structural',
    label: 'Structural Issues',
    description: 'Sagging floors, bowing walls, visible settling',
    photoTip: 'Photograph visible movement, sagging, bowing, or displacement with context and scale where safe.',
    iconPath: 'M4 20h16M6 20l6-16 6 16M8 14h8',
  },
  {
    id: 'windows_doors',
    label: 'Windows / Doors',
    description: 'Drafty, foggy, or damaged windows and doors',
    photoTip: 'Photograph fogging, broken seals, damaged frames, gaps, rot, and any quote or inspection note.',
    iconPath: 'M5 4h14v16H5V4Zm7 0v16M5 12h14',
  },
  {
    id: 'exterior_deterioration',
    label: 'Exterior Deterioration',
    description: 'Peeling paint, rotting siding, damaged fascia or soffits',
    photoTip: 'Photograph deterioration from close and wide angles, including locations on the building exterior.',
    iconPath: 'M4 20h16M6 20V9l6-4 6 4v11M9 20v-6h6v6',
  },
  {
    id: 'drainage_grading',
    label: 'Drainage / Grading',
    description: 'Water pooling near foundation, poor lot drainage',
    photoTip: 'Photograph pooling, grading, downspouts, and water paths, ideally during or soon after rain when conditions are visible.',
    iconPath: 'M3 17c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1M3 12c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1',
  },
  {
    id: 'outdated_finishes',
    label: 'Outdated Finishes',
    description: 'Original kitchen/bath from 20+ years ago, dated fixtures',
    photoTip: 'Photograph dated rooms and fixtures, then let comparable evidence determine whether an adjustment is supportable.',
    iconPath: 'M4 10h16v8H4v-8Zm2-4h12v4H6V6Zm2 12v2m8-2v2',
  },
  {
    id: 'environmental',
    label: 'Environmental Hazards',
    description: 'Asbestos, lead paint (pre-1978), radon concerns',
    photoTip: 'Upload test results or official documents when available. Do not disturb suspected hazardous material for photos.',
    iconPath: 'M12 3 3 20h18L12 3Zm0 6v4m0 3h.01',
  },
  {
    id: 'noise_nuisance',
    label: 'Noise / Nuisance Factors',
    description: 'Near highway, railroad, commercial, or industrial sites',
    photoTip: 'Photograph the source from the property, showing proximity, line of sight, and any supporting map or record.',
    iconPath: 'M4 14v-4l5-2 7-4v16l-7-4-5-2Zm0 0v5h4l1-3',
  },
  {
    id: 'other',
    label: 'Other Issues',
    description: 'Anything else affecting your property value',
    photoTip: 'Document the issue with clear photographs, dates, notes, and any supporting third-party records.',
    iconPath: 'M8 4h8l2 2v14H6V6l2-2Zm1 6h6M9 14h6M9 18h4',
  },
];

export function PropertyIssueIcon({
  issue,
  className = 'h-5 w-5',
}: {
  issue: Pick<PropertyIssue, 'iconPath' | 'label'>;
  className?: string;
}) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={issue.iconPath} />
    </svg>
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface WizardContextType {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  totalSteps: number;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within WizardProvider');
  return ctx;
}

// ─── Step Definitions ────────────────────────────────────────────────────────

export const WIZARD_STEPS = [
  { number: 1, label: 'Goals', path: '/start' },
  { number: 2, label: 'Property', path: '/start/property' },
  { number: 3, label: 'Situation', path: '/start/situation' },
  { number: 4, label: 'Payment', path: '/start/payment' },
  { number: 5, label: 'Photos', path: '/start/photos' },
];

// ─── Provider + Layout ──────────────────────────────────────────────────────

function WizardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [currentStep, setCurrentStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  const searchParams = useSearchParams();

  // Restore from sessionStorage + query params on mount
  useEffect(() => {
    const raw = sessionStorage.getItem('wizard');
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        setState((prev) => ({ ...prev, ...saved }));
      } catch { /* ignore corrupt data */ }
    }

    // Pre-populate from URL query params (from homepage or service card links)
    const addressParam = searchParams.get('address');
    if (addressParam) {
      try {
        const parsed = JSON.parse(addressParam);
        if (parsed && parsed.line1) {
          setState((prev) => ({ ...prev, address: parsed }));
        }
      } catch { /* ignore invalid JSON */ }
    }

    // Pre-populate service type from URL
    const serviceParam = searchParams.get('service');
    if (serviceParam) {
      const validServices = ['tax_appeal', 'pre_purchase', 'pre_listing'];
      if (validServices.includes(serviceParam)) {
        setState((prev) => ({ ...prev, serviceType: serviceParam as ServiceType }));
      }
    }

    const tierParam = searchParams.get('tier');
    if (tierParam) {
      const tierMap: Record<string, ReviewTier> = {
        'auto': 'auto',
        'expert-reviewed': 'expert_reviewed',
        'guided-filing': 'guided_filing',
        'full-representation': 'full_representation',
      };
      const mappedTier = tierMap[tierParam];
      if (mappedTier) {
        setState((prev) => ({ ...prev, reviewTier: mappedTier }));
      }
    }

    setHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to sessionStorage on change
  useEffect(() => {
    if (hydrated) {
      sessionStorage.setItem('wizard', JSON.stringify(state));
      // Also maintain backward compat with old 'intake' key for payment page
      if (state.reportId && state.clientSecret) {
        sessionStorage.setItem('intake', JSON.stringify({
          reportId: state.reportId,
          clientSecret: state.clientSecret,
          address: state.address,
          propertyType: state.propertyType,
          serviceType: state.serviceType,
          priceCents: state.priceCents,
        }));
      }
    }
  }, [state, hydrated]);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const totalSteps = WIZARD_STEPS.length;

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-navy-deep overflow-hidden relative flex flex-col items-center justify-center">
          <div className="bg-aurora" />
          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="scanner-container transform scale-125 opacity-90">
              <div className="scanner-ring" />
              <div className="scanner-progress" />
              <div className="scanner-dot" />
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-xl md:text-2xl font-display text-cream drop-shadow-lg tracking-wide uppercase">
                <span className="data-stream-text">Syncing Secure Pipeline</span>
              </h1>
              <p className="text-gold/60 text-sm tracking-widest uppercase font-semibold animate-pulse">
                Initiating Session...
              </p>
            </div>
          </div>
        </div>
    );
  }

  return (
    <WizardContext.Provider value={{ state, updateState, currentStep, setCurrentStep, totalSteps }}>
      <div className="min-h-screen bg-pattern">
        {/* Header */}
        <header className="bg-navy-deep/80 backdrop-blur-xl nav-shadow sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
                <span className="text-navy-deep font-bold text-sm">R</span>
              </div>
              <Wordmark className="font-display text-lg text-cream" />
            </button>

            {/* Step indicators */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-cream/40">
              {WIZARD_STEPS.map((step) => {
                const isComplete = currentStep > step.number;
                const isActive = currentStep === step.number;
                return (
                  <React.Fragment key={step.number}>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] transition-all ${
                        isComplete
                          ? 'bg-gold/20 border border-gold/40 text-gold'
                          : isActive
                            ? 'bg-gold text-navy-deep'
                            : 'border border-gold/20 text-cream/50'
                      }`}
                    >
                      {isComplete ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step.number
                      )}
                    </div>
                    <span className={`${isActive ? 'text-gold font-medium' : ''}`}>
                      {step.label}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Mobile step counter */}
            <div className="md:hidden text-xs text-cream/50">
              Step {currentStep} of {totalSteps}
            </div>
          </div>
        </header>

        {/* Step content */}
        {children}
      </div>
    </WizardContext.Provider>
  );
}

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy-deep overflow-hidden relative flex flex-col items-center justify-center">
          <div className="bg-aurora" />
          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="scanner-container transform scale-125 opacity-90">
              <div className="scanner-ring" />
              <div className="scanner-progress" />
              <div className="scanner-dot" />
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-xl md:text-2xl font-display text-cream drop-shadow-lg tracking-wide uppercase">
                <span className="data-stream-text">Syncing Secure Pipeline</span>
              </h1>
              <p className="text-gold/60 text-sm tracking-widest uppercase font-semibold animate-pulse">
                Initiating Session...
              </p>
            </div>
          </div>
        </div>
      }
    >
      <WizardLayoutInner>{children}</WizardLayoutInner>
    </Suspense>
  );
}
