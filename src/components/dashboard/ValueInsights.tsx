'use client';

interface ValueInsightsProps {
  assessedValue: number | null;
  concludedValue: number | null;
  potentialSavings: number | null;
  caseStrength: number | null;
  propertyType: string;
  serviceType: string;
}

function formatDollar(value: number): string {
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function strengthLabel(score: number): { label: string; classes: string } {
  if (score >= 80) return { label: 'Very Strong', classes: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (score >= 60) return { label: 'Strong', classes: 'text-emerald-400/80 bg-emerald-500/[0.07] border-emerald-500/15' };
  if (score >= 40) return { label: 'Moderate', classes: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  if (score >= 20) return { label: 'Weak', classes: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
  return { label: 'Very Weak', classes: 'text-red-400 bg-red-500/10 border-red-500/20' };
}

export default function ValueInsights({
  assessedValue,
  concludedValue,
  potentialSavings,
  caseStrength,
  serviceType,
}: ValueInsightsProps) {
  const isTaxAppeal = serviceType === 'tax_appeal';
  const hasValues = assessedValue && assessedValue > 0 && concludedValue && concludedValue > 0;
  const overassessedPct = hasValues
    ? Math.round(((assessedValue - concludedValue) / concludedValue) * 100)
    : 0;
  const isOverassessed = overassessedPct > 0;

  if (!hasValues) return null;

  return (
    <div className="card-premium rounded-xl overflow-hidden" data-animate>
      {/* Header strip */}
      <div className="px-5 py-3 border-b border-gold/[0.08] bg-gold/[0.03]">
        <h3 className="text-xs font-semibold tracking-widest text-gold/60 uppercase">
          {isTaxAppeal ? 'Value Analysis' : 'Property Valuation'}
        </h3>
      </div>

      {/* Value comparison */}
      <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-gold/[0.06]">
        {/* County assessed */}
        <div className="px-5 py-5">
          <p className="text-[10px] uppercase tracking-widest text-cream/30 mb-1.5">County Assessed</p>
          <p className="font-display text-lg sm:text-xl text-cream/70">
            {formatDollar(assessedValue)}
          </p>
        </div>

        {/* Our value */}
        <div className="px-5 py-5">
          <p className="text-[10px] uppercase tracking-widest text-gold/50 mb-1.5">Our Analysis</p>
          <p className="font-display text-lg sm:text-xl text-gold">
            {formatDollar(concludedValue)}
          </p>
        </div>

        {/* Savings / difference */}
        {isTaxAppeal && potentialSavings && potentialSavings > 0 && (
          <div className="px-5 py-5 col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-widest text-emerald-400/50 mb-1.5">Potential Savings</p>
            <p className="font-display text-lg sm:text-xl text-emerald-400">
              {formatDollar(potentialSavings)}
              <span className="text-xs text-emerald-400/40 font-sans ml-1.5">/yr</span>
            </p>
          </div>
        )}
      </div>

      {/* Bottom bar — overassessment + case strength */}
      <div className="px-5 py-3 border-t border-gold/[0.06] flex items-center justify-between gap-4 flex-wrap">
        {isOverassessed && isTaxAppeal ? (
          <p className="text-[11px] text-cream/30">
            Property overassessed by <span className="text-gold/70 font-medium">{overassessedPct}%</span>
          </p>
        ) : (
          <p className="text-[11px] text-cream/20">
            {isTaxAppeal ? 'Assessment appears within range' : 'Based on comparable sales analysis'}
          </p>
        )}
        {caseStrength != null && isTaxAppeal && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${strengthLabel(caseStrength).classes}`}>
            Case: {strengthLabel(caseStrength).label}
          </span>
        )}
      </div>
    </div>
  );
}
