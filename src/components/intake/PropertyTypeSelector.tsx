'use client';

import { PropertyType } from '@/types/database';

interface PropertyTypeSelectorProps {
  selected: PropertyType | null;
  onChange: (type: PropertyType) => void;
}

const propertyTypes: { type: PropertyType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'residential',
    label: 'Residential',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    type: 'land',
    label: 'Vacant Land',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function PropertyTypeSelector({ selected, onChange }: PropertyTypeSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-cream/80 mb-3">
        Property Type
      </label>
      <div className="grid grid-cols-2 gap-3">
        {propertyTypes.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`
              flex flex-col items-center gap-2 rounded-xl border p-5
              transition-all duration-200
              ${
                selected === type
                  ? 'border-gold bg-gold/10 text-gold shadow-gold'
                  : 'border-gold/10 bg-navy-deep/40 text-cream/50 hover:border-gold/30 hover:text-cream/80'
              }
            `}
          >
            {icon}
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
