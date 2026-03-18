'use client';

import type { PropertyLookupResult } from '@/components/intake/WizardLayout';
import type { PropertyType } from '@/types/database';

interface PropertyDetailsProps {
  lookup: PropertyLookupResult;
  selectedType: PropertyType | null;
  onTypeOverride: (type: PropertyType) => void;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  land: 'Vacant Land',
};

function formatNumber(n: number | null): string {
  if (!n) return '—';
  return n.toLocaleString('en-US');
}

function formatSqFt(n: number | null): string {
  if (!n) return '—';
  return `${n.toLocaleString('en-US')} sq ft`;
}

function formatDollar(n: number | null): string {
  if (!n) return '—';
  return `$${n.toLocaleString('en-US')}`;
}

export default function PropertyDetails({ lookup, selectedType, onTypeOverride }: PropertyDetailsProps) {
  const detectedLabel = lookup.propertyType
    ? PROPERTY_TYPE_LABELS[lookup.propertyType] || lookup.propertyTypeRaw || lookup.propertyType
    : lookup.propertyTypeRaw || 'Unknown';

  const isOverridden = selectedType && selectedType !== lookup.propertyType;

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
          {/* Property Type */}
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

          {/* Year Built */}
          {lookup.yearBuilt ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">Year Built</p>
              <p className="text-cream font-medium">{lookup.yearBuilt}</p>
            </div>
          ) : null}

          {/* Bedrooms */}
          {lookup.bedrooms ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">Bedrooms</p>
              <p className="text-cream font-medium">{formatNumber(lookup.bedrooms)}</p>
            </div>
          ) : null}

          {/* Bathrooms */}
          {lookup.bathrooms ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">Bathrooms</p>
              <p className="text-cream font-medium">{formatNumber(lookup.bathrooms)}</p>
            </div>
          ) : null}

          {/* Building Size */}
          {lookup.buildingSqFt ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">Building Size</p>
              <p className="text-cream font-medium">{formatSqFt(lookup.buildingSqFt)}</p>
            </div>
          ) : null}

          {/* Lot Size */}
          {lookup.lotSqFt ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">Lot Size</p>
              <p className="text-cream font-medium">{formatSqFt(lookup.lotSqFt)}</p>
            </div>
          ) : null}

          {/* Stories */}
          {lookup.stories ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">Stories</p>
              <p className="text-cream font-medium">{formatNumber(lookup.stories)}</p>
            </div>
          ) : null}

          {/* Assessed Value */}
          {lookup.assessedValue ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">Assessed Value</p>
              <p className="text-cream font-medium">{formatDollar(lookup.assessedValue)}</p>
            </div>
          ) : null}

          {/* County */}
          {lookup.countyName ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-cream/40 mb-1">County</p>
              <p className="text-cream font-medium">{lookup.countyName}</p>
            </div>
          ) : null}
        </div>

        {/* Type override */}
        {lookup.propertyType && (
          <div className="mt-4 pt-4 border-t border-gold/10">
            <button
              type="button"
              onClick={() => {
                // Cycle to next type if they want to override
                const types: PropertyType[] = ['residential', 'commercial', 'industrial', 'land'];
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
