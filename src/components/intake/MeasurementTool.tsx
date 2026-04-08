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
      {/* Manual entry */}
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
