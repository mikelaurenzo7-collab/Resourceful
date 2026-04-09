'use client';

import { ServiceType, PropertyType } from '@/types/database';
import { getPriceCents, formatPrice } from '@/config/pricing';

interface ServiceTypeSelectorProps {
  selected: ServiceType | null;
  propertyType: PropertyType | null;
  onChange: (type: ServiceType) => void;
}

const serviceOptions: { type: ServiceType; label: string; tagline: string; icon: React.ReactNode }[] = [
  {
    type: 'tax_appeal',
    label: 'Tax Appeal Report',
    tagline: 'Fight your over-assessment with professional evidence',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
  {
    type: 'pre_purchase',
    label: 'Pre-Purchase Analysis',
    tagline: 'Know your real tax liability before you buy',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    type: 'pre_listing',
    label: 'Pre-Listing Report',
    tagline: 'Strengthen your listing with tax clarity',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
    if (!propertyType) return 'Select property type';
    return formatPrice(getPriceCents(serviceType, propertyType));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-cream/80 mb-3">
        Report Type
      </label>
      <div className="space-y-3">
        {serviceOptions.map(({ type, label, tagline, icon }) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`
              w-full flex items-center gap-4 rounded-xl border p-5 text-left
              transition-all duration-200
              ${
                selected === type
                  ? 'border-gold bg-gold/10 shadow-gold'
                  : 'border-gold/10 bg-navy-deep/40 hover:border-gold/30'
              }
            `}
          >
            <div
              className={`flex-shrink-0 ${
                selected === type ? 'text-gold' : 'text-cream/40'
              }`}
            >
              {icon}
            </div>
            <div className="flex-grow min-w-0">
              <p
                className={`font-medium ${
                  selected === type ? 'text-cream' : 'text-cream/70'
                }`}
              >
                {label}
              </p>
              <p className="text-xs text-cream/40 mt-0.5">{tagline}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <span
                className={`font-display text-lg ${
                  selected === type ? 'text-gold' : 'text-cream/50'
                }`}
              >
                {getPriceDisplay(type)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
