'use client';

import { useState } from 'react';

interface MeasurementToolProps {
  address: string;
  attomGBA: number | null;
  onMeasurementComplete: (data: {
    measuredSqFt: number;
    source: 'map' | 'manual';
  }) => void;
}

export default function MeasurementTool({
  address,
  attomGBA,
  onMeasurementComplete,
}: MeasurementToolProps) {
  const [activeTab, setActiveTab] = useState<'map' | 'manual'>('map');
  const [manualSqFt, setManualSqFt] = useState('');
  const [measuredSqFt, setMeasuredSqFt] = useState<number | null>(null);

  const discrepancy =
    attomGBA && measuredSqFt
      ? Math.abs(((measuredSqFt - attomGBA) / attomGBA) * 100)
      : null;

  const handleManualSubmit = () => {
    const sqft = parseInt(manualSqFt);
    if (sqft > 0) {
      setMeasuredSqFt(sqft);
      onMeasurementComplete({ measuredSqFt: sqft, source: 'manual' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab selector */}
      <div className="flex rounded-lg border border-gold/15 overflow-hidden">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'map'
              ? 'bg-gold/10 text-gold border-r border-gold/15'
              : 'text-cream/50 hover:text-cream/80 border-r border-gold/15'
          }`}
        >
          Map Measurement
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'manual'
              ? 'bg-gold/10 text-gold'
              : 'text-cream/50 hover:text-cream/80'
          }`}
        >
          Manual Entry
        </button>
      </div>

      {activeTab === 'map' ? (
        <div>
          {/* Map placeholder */}
          <div className="rounded-xl border border-gold/15 bg-navy/40 overflow-hidden">
            <div className="aspect-video flex flex-col items-center justify-center bg-navy-deep/60">
              <svg className="w-16 h-16 text-gold/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-cream/40 text-sm font-medium mb-2">
                Google Maps Satellite View
              </p>
              <p className="text-cream/30 text-xs max-w-sm text-center">
                Integration pending. Draw a polygon around your building footprint
                to measure the gross building area.
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 card-premium rounded-lg p-4">
            <h4 className="text-sm font-medium text-cream mb-2">How to Measure</h4>
            <ol className="space-y-2 text-xs text-cream/50 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-gold font-semibold">1.</span>
                Click on each corner of your building&apos;s footprint to place points
              </li>
              <li className="flex gap-2">
                <span className="text-gold font-semibold">2.</span>
                Close the polygon by clicking the first point again
              </li>
              <li className="flex gap-2">
                <span className="text-gold font-semibold">3.</span>
                The area will be calculated automatically in square feet
              </li>
              <li className="flex gap-2">
                <span className="text-gold font-semibold">4.</span>
                For multi-story buildings, multiply by the number of floors
              </li>
            </ol>
          </div>

          {/* Dimensions display placeholder */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gold/10 bg-navy-deep/40 p-4 text-center">
              <p className="text-xs text-cream/40 uppercase tracking-wider mb-1">Footprint</p>
              <p className="font-display text-xl text-cream/30">&mdash;</p>
            </div>
            <div className="rounded-lg border border-gold/10 bg-navy-deep/40 p-4 text-center">
              <p className="text-xs text-cream/40 uppercase tracking-wider mb-1">Dimensions</p>
              <p className="font-display text-xl text-cream/30">&mdash;</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cream/80 mb-2">
              Building Square Footage
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                value={manualSqFt}
                onChange={(e) => setManualSqFt(e.target.value)}
                placeholder="e.g., 1850"
                className="flex-1 rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none"
              />
              <button
                onClick={handleManualSubmit}
                className="rounded-lg bg-gold/10 border border-gold/30 px-6 py-3 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
              >
                Confirm
              </button>
            </div>
            <p className="mt-2 text-xs text-cream/30">
              Enter the total gross building area from your tax bill, survey, or listing.
            </p>
          </div>
        </div>
      )}

      {/* Cross-reference display */}
      {(attomGBA || measuredSqFt) && (
        <div className="card-premium rounded-xl p-5">
          <h4 className="text-sm font-medium text-cream mb-4">
            Square Footage Cross-Reference
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-cream/40 mb-1">ATTOM Data (Public Record)</p>
              <p className="font-display text-xl text-cream">
                {attomGBA ? `${attomGBA.toLocaleString()} sqft` : 'Pending'}
              </p>
            </div>
            <div>
              <p className="text-xs text-cream/40 mb-1">Your Measurement</p>
              <p className="font-display text-xl text-cream">
                {measuredSqFt ? `${measuredSqFt.toLocaleString()} sqft` : 'Pending'}
              </p>
            </div>
          </div>

          {discrepancy !== null && discrepancy > 5 && (
            <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-400">
                  {discrepancy.toFixed(0)}% Discrepancy Detected
                </p>
                <p className="text-xs text-cream/40 mt-1">
                  A significant difference between recorded and measured square footage
                  may strengthen your appeal. This will be addressed in your report.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Address context */}
      <p className="text-xs text-cream/30 text-center">{address}</p>
    </div>
  );
}
