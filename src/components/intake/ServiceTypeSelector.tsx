'use client';

import type { PropertyType, ServiceType } from '@/types/database';
import { formatPrice, getPriceCents } from '@/config/pricing';

interface ServiceTypeSelectorProps {
  selected: ServiceType | null;
  propertyType: PropertyType | null;
  onChange: (type: ServiceType) => void;
}

const serviceOptions: {
  type: ServiceType;
  label: string;
  tagline: string;
  action: string;
  icon: React.ReactNode;
}[] = [
  {
    type: 'tax_appeal',
    label: 'Property Tax Appeal',
    tagline: 'Review the assessment, supporting evidence, and next filing step.',
    action: 'Challenge an assessment',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0-3 9a5 5 0 0 0 6 0L6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6 0l-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
  {
    type: 'pre_purchase',
    label: 'Pre-Purchase Review',
    tagline: 'Inspect value evidence, recorded taxes, and unresolved property risks before closing.',
    action: 'Evaluate a purchase',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
      </svg>
    ),
  },
  {
    type: 'pre_listing',
    label: 'Pre-Listing Review',
    tagline: 'Prepare a supportable value and property-tax story before buyers ask.',
    action: 'Prepare a listing',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2Z" />
      </svg>
    ),
  },
];

export default function ServiceTypeSelector({
  selected,
  propertyType,
  onChange,
}: ServiceTypeSelectorProps) {
  const getPriceDisplay = (serviceType: ServiceType) => {
    if (!propertyType) return 'Choose property type first';
    return `From ${formatPrice(getPriceCents(serviceType, propertyType))}`;
  };

  return (
    <fieldset>
      <legend className="mb-3 block text-sm font-medium text-cream/80">
        What decision are you working on?
      </legend>
      <div className="space-y-3">
        {serviceOptions.map(({ type, label, tagline, action, icon }) => {
          const isSelected = selected === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              aria-pressed={isSelected}
              className={`w-full rounded-xl border p-5 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold/50 ${
                isSelected
                  ? 'border-gold bg-gold/10 shadow-gold'
                  : 'border-gold/10 bg-navy-deep/40 hover:border-gold/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 shrink-0 ${isSelected ? 'text-gold' : 'text-cream/40'}`}>
                  {icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <p className={`font-medium ${isSelected ? 'text-cream' : 'text-cream/75'}`}>{label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-cream/45">{tagline}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-medium ${isSelected ? 'text-gold' : 'text-cream/50'}`}>
                      {getPriceDisplay(type)}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold/60">
                    {action}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
