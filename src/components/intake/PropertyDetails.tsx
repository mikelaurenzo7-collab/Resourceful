'use client';

import type { PropertyLookupResult } from '@/components/intake/WizardLayout';
import type { PropertyType } from '@/types/database';

interface PropertyDetailsProps {
  lookup: PropertyLookupResult;
  selectedType: PropertyType | null;
  onTypeOverride: (type: PropertyType) => void;
}

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  residential: 'Residential',
  land: 'Vacant Land',
};

const fmt = (n: number | null) => n ? n.toLocaleString('en-US') : null;
const fmtSqFt = (n: number | null) => n ? `${n.toLocaleString('en-US')} sq ft` : null;
const fmtDollar = (n: number | null) => n ? `$${n.toLocaleString('en-US')}` : null;

export default function PropertyDetails({ lookup, selectedType, onTypeOverride }: PropertyDetailsProps) {
  const detectedLabel = lookup.propertyType
    ? PROPERTY_TYPE_LABELS[lookup.propertyType] || lookup.propertyTypeRaw || lookup.propertyType
    : lookup.propertyTypeRaw || 'Unknown';

  const isOverridden = selectedType && selectedType !== lookup.propertyType;

  // Data-driven grid items — only rendered when value is truthy
  const details: { label: string; value: string | null }[] = [
    { label: 'Year Built', value: lookup.yearBuilt ? String(lookup.yearBuilt) : null },
    { label: 'Bedrooms', value: fmt(lookup.bedrooms) },
    { label: 'Bathrooms', value: fmt(lookup.bathrooms) },
    { label: 'Building Size', value: fmtSqFt(lookup.buildingSqFt) },
    { label: 'Lot Size', value: fmtSqFt(lookup.lotSqFt) },
    { label: 'Stories', value: fmt(lookup.stories) },
    { label: 'Assessed Value', value: fmtDollar(lookup.assessedValue) },
    { label: 'County', value: lookup.countyName },
  ];

  return (
    <div className="card-premium rounded-xl border border-gold/20 overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="border-b border-gold/10 px-6 py-4 bg-gold/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs uppercase tracking-widest text-gold/70">Property Found</p>
        </div>
        <p className="text-[10px] text-cream/25">ATTOM Public Records</p>
      </div>

      {/* Details grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* Property Type — always shown, spans full width */}
          <div className="col-span-2 sm:col-span-3">
            <p className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">Property Type</p>
            <div className="flex items-center gap-2">
              <p className="text-cream font-medium">{detectedLabel}</p>
              {isOverridden && (
                <span className="text-[10px] bg-gold/10 text-gold/70 rounded-full px-2 py-0.5">
                  You selected: {PROPERTY_TYPE_LABELS[selectedType!]}
                </span>
              )}
            </div>
          </div>

          {details.map(({ label, value }) =>
            value ? (
              <div key={label}>
                <p className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">{label}</p>
                <p className="text-cream font-medium">{value}</p>
              </div>
            ) : null
          )}
        </div>

        {/* Type override */}
        {lookup.propertyType && (
          <div className="mt-4 pt-4 border-t border-gold/10">
            <button
              type="button"
              onClick={() => {
                const types: PropertyType[] = ['residential', 'land'];
                const current = selectedType || lookup.propertyType!;
                const idx = types.indexOf(current);
                const next = types[(idx + 1) % types.length];
                onTypeOverride(next);
              }}
              className="text-[10px] text-cream/30 hover:text-cream/50 transition-colors"
            >
              Property type incorrect? Click to change.
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
