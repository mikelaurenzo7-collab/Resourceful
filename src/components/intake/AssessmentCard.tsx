'use client';

import { formatPrice } from '@/config/pricing';

interface AssessmentCardProps {
  address: string;
  assessedValue: number;
  estimatedMarketValueLow: number;
  estimatedMarketValueHigh: number;
  assessmentRatio: number;
  taxRate: number;
  reportPrice: number;
}

export default function AssessmentCard({
  address,
  assessedValue,
  estimatedMarketValueLow,
  estimatedMarketValueHigh,
  assessmentRatio,
  taxRate,
  reportPrice,
}: AssessmentCardProps) {
  // Use the county-specific assessment ratio to determine fair assessed value
  // (ratios vary widely by county — e.g. 10%, 25%, 33%, or 100%)
  const effectiveRatio = assessmentRatio > 0 ? assessmentRatio : 1; // default to full value if unknown
  const fairAssessedLow = estimatedMarketValueLow * effectiveRatio;
  const fairAssessedHigh = estimatedMarketValueHigh * effectiveRatio;
  const overAssessmentLow = Math.max(0, assessedValue - fairAssessedHigh);
  const overAssessmentHigh = Math.max(0, assessedValue - fairAssessedLow);
  const savingsLow = Math.round(overAssessmentLow * taxRate);
  const savingsHigh = Math.round(overAssessmentHigh * taxRate);

  const formatDollars = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="card-premium rounded-xl overflow-hidden">
      {/* Header */}
      <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
        <p className="text-xs uppercase tracking-widest text-gold/70 mb-1">Assessment Summary</p>
        <p className="text-cream font-medium">{address}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Values grid */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-cream/40 mb-1">
              Current Assessed Value
            </p>
            <p className="font-display text-2xl text-cream">{formatDollars(assessedValue)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-cream/40 mb-1">
              Est. Market Value Range
            </p>
            <p className="font-display text-2xl text-gold">
              {formatDollars(estimatedMarketValueLow)} &ndash; {formatDollars(estimatedMarketValueHigh)}
            </p>
          </div>
        </div>

        {/* Assessment ratio */}
        <div className="rounded-lg bg-navy-deep/60 border border-gold/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cream/60">Assessment Ratio</span>
            <span className={`font-display text-lg ${assessmentRatio > effectiveRatio ? 'text-red-400' : 'text-emerald-400'}`}>
              {(assessmentRatio * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-cream/40 leading-relaxed">
            {assessmentRatio > effectiveRatio
              ? `Your property is assessed at ${(assessmentRatio * 100).toFixed(1)}% of estimated market value, which is above the expected ${(effectiveRatio * 100).toFixed(1)}% ratio for your county. This suggests your property may be over-assessed.`
              : 'Your assessment ratio appears to be within the expected range for your county.'}
          </p>
        </div>

        {/* Savings estimate */}
        {savingsHigh > 0 && (
          <div className="rounded-lg border border-gold/20 bg-gold/5 p-5">
            <p className="text-xs uppercase tracking-widest text-gold/70 mb-2">
              Estimated Potential Annual Tax Savings
            </p>
            <p className="font-display text-3xl text-gold-gradient">
              {formatDollars(savingsLow)} &ndash; {formatDollars(savingsHigh)}
            </p>
            <p className="text-xs text-cream/40 mt-2">per year, based on current tax rate</p>

            {/* Savings vs price juxtaposition */}
            <div className="mt-4 pt-4 border-t border-gold/10 flex items-center justify-between">
              <div>
                <p className="text-xs text-cream/40">Report Cost</p>
                <p className="font-display text-lg text-cream">{formatPrice(reportPrice)}</p>
              </div>
              <div className="h-8 w-px bg-gold/20" />
              <div className="text-right">
                <p className="text-xs text-cream/40">Potential Return</p>
                <p className="font-display text-lg text-emerald-400">
                  {reportPrice > 0 ? `${Math.round(savingsLow / (reportPrice / 100))}x` : '—'} &ndash; {reportPrice > 0 ? `${Math.round(savingsHigh / (reportPrice / 100))}x` : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
