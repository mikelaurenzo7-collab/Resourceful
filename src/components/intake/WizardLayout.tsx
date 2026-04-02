'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PropertyType, ServiceType, ReviewTier } from '@/types/database';

// ─── Wizard State ────────────────────────────────────────────────────────────

export interface PropertyIssue {
  id: string;
  label: string;
  description: string;
  photoTip: string;
  icon: string; // emoji for display
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
    photoTip: 'Photograph water stains, drip areas, and any standing water. Include close-ups of damage and wide shots showing extent.',
    icon: '\u{1F4A7}',
  },
  {
    id: 'mold',
    label: 'Mold / Mildew',
    description: 'Visible mold growth on walls, ceilings, or around fixtures',
    photoTip: 'Photograph all visible mold areas. Include a ruler or coin for scale. Capture both the mold and surrounding area.',
    icon: '\u{1F9EB}',
  },
  {
    id: 'foundation_cracks',
    label: 'Foundation Cracks',
    description: 'Cracks in foundation walls, basement floor, or exterior base',
    photoTip: 'Photograph cracks with a ruler alongside for scale. Show the full length of each crack and any displacement.',
    icon: '\u{1F3DA}\uFE0F',
  },
  {
    id: 'roof_damage',
    label: 'Roof Damage',
    description: 'Missing shingles, sagging areas, visible deterioration',
    photoTip: 'If safely accessible, photograph from ground level showing missing shingles, sagging areas, or visible wear.',
    icon: '\u{1F3E0}',
  },
  {
    id: 'hvac_issues',
    label: 'HVAC / Mechanical Issues',
    description: 'Aging or non-functional heating, cooling, or ventilation',
    photoTip: 'Photograph the equipment nameplate showing age/model and any visible deterioration or rust.',
    icon: '\u{2744}\uFE0F',
  },
  {
    id: 'plumbing',
    label: 'Plumbing Problems',
    description: 'Leaking pipes, low water pressure, outdated fixtures',
    photoTip: 'Photograph any visible pipe corrosion, leaks under sinks, water-damaged cabinets, or outdated fixtures.',
    icon: '\u{1F6BF}',
  },
  {
    id: 'electrical',
    label: 'Electrical Concerns',
    description: 'Outdated wiring, insufficient outlets, panel issues',
    photoTip: 'Photograph the electrical panel (with door open), any exposed or outdated wiring, and knob-and-tube if present.',
    icon: '\u{26A1}',
  },
  {
    id: 'structural',
    label: 'Structural Issues',
    description: 'Sagging floors, bowing walls, visible settling',
    photoTip: 'Use a level or straight edge to show unevenness. Photograph bowing walls, sagging beams, and displaced framing.',
    icon: '\u{1F6A7}',
  },
  {
    id: 'windows_doors',
    label: 'Windows / Doors',
    description: 'Drafty, foggy, or damaged windows and doors',
    photoTip: 'Photograph foggy double-pane windows, damaged seals, rotted frames, and any gaps where air infiltrates.',
    icon: '\u{1FA9F}',
  },
  {
    id: 'exterior_deterioration',
    label: 'Exterior Deterioration',
    description: 'Peeling paint, rotting siding, damaged fascia or soffits',
    photoTip: 'Photograph peeling paint, rotted wood, damaged siding from multiple angles. Include both close-up and full views.',
    icon: '\u{1F3D7}\uFE0F',
  },
  {
    id: 'drainage_grading',
    label: 'Drainage / Grading',
    description: 'Water pooling near foundation, poor lot drainage',
    photoTip: 'Photograph areas where water pools, especially near the foundation. Show the grade slope away from the house.',
    icon: '\u{1F30A}',
  },
  {
    id: 'outdated_finishes',
    label: 'Outdated Finishes',
    description: 'Original kitchen/bath from 20+ years ago, dated fixtures',
    photoTip: 'Photograph dated kitchens, bathrooms, and fixtures. These reduce market value compared to updated comps.',
    icon: '\u{1F6CB}\uFE0F',
  },
  {
    id: 'environmental',
    label: 'Environmental Hazards',
    description: 'Asbestos, lead paint (pre-1978), radon concerns',
    photoTip: 'Photograph any test results or visible asbestos-containing materials. Note the year the home was built.',
    icon: '\u{2622}\uFE0F',
  },
  {
    id: 'noise_nuisance',
    label: 'Noise / Nuisance Factors',
    description: 'Near highway, railroad, commercial, or industrial sites',
    photoTip: 'Photograph the source of the nuisance from your property. Show proximity and line of sight.',
    icon: '\u{1F4E2}',
  },
  {
    id: 'other',
    label: 'Other Issues',
    description: 'Anything else affecting your property value',
    photoTip: 'Document any other condition issues with clear, well-lit photographs.',
    icon: '\u{1F4CB}',
  },
];

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
  { number: 4, label: 'Photos', path: '/start/photos' },
  { number: 5, label: 'Payment', path: '/start/payment' },
];

// ─── Provider + Layout ──────────────────────────────────────────────────────

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [currentStep, setCurrentStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  // Restore from sessionStorage on mount
  useEffect(() => {
    const raw = sessionStorage.getItem('wizard');
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        setState((prev) => ({ ...prev, ...saved }));
      } catch { /* ignore corrupt data */ }
    }
    setHydrated(true);
  }, []);

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

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <WizardContext.Provider value={{ state, updateState, currentStep, setCurrentStep, totalSteps }}>
      <div className="min-h-screen bg-pattern">
        {/* Header */}
        <header className="bg-navy-deep/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
                <span className="text-navy-deep font-bold text-sm">R</span>
              </div>
              <span className="font-display text-lg text-cream">Resourceful</span>
            </button>

            {/* Step indicators */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-cream/40">
              {WIZARD_STEPS.map((step, i) => {
                const isComplete = currentStep > step.number;
                const isActive = currentStep === step.number;
                return (
                  <React.Fragment key={step.number}>
                    {i > 0 && (
                      <div className={`w-6 h-px ${isComplete ? 'bg-gold/40' : 'bg-gold/15'}`} />
                    )}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] transition-all ${
                        isComplete
                          ? 'bg-gold/20 border border-gold/40 text-gold'
                          : isActive
                            ? 'bg-gold text-navy-deep'
                            : 'border border-gold/20 text-cream/30'
                      }`}
                    >
                      {isComplete ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Progress bar */}
        <div className="h-1 bg-navy-light">
          <div
            className="h-full bg-gradient-to-r from-gold-light via-gold to-gold-dark transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step content */}
        {children}
      </div>
    </WizardContext.Provider>
  );
}
