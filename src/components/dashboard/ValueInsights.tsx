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
  // propertyType reserved for future use (commercial vs residential display)
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
      
      {/* ── Visual Valuation Tracker (Max Sex Appeal Data Viz) ── */}
      <div className="px-6 pt-8 pb-10 border-b border-gold/[0.04] relative">
        <div className="flex items-end justify-between mb-4 relative z-10">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gold/60 mb-1.5 font-semibold">Our True Market Value</p>
            <p className="font-display text-4xl text-gold drop-shadow-md">
              {formatDollar(concludedValue)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-cream/40 mb-1.5 font-semibold">County Assessed</p>
            <p className="font-display text-2xl text-cream/70">
              {formatDollar(assessedValue)}
            </p>
          </div>
        </div>

        {/* The Tracking Bar */}
        <div className="relative h-3 w-full bg-navy-deep rounded-full overflow-hidden border border-cream/[0.03] shadow-inner z-10">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/20 to-emerald-400/80 rounded-full w-full opacity-30" />
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold-dark via-gold to-gold-light rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(10, Math.min(90, (concludedValue / assessedValue) * 100)) }%` }}
          />
        </div>
        
        {/* Dynamic Highlight Gap */}
        {isTaxAppeal && potentialSavings && potentialSavings > 0 && (
          <div className="absolute inset-x-6 top-1/2 mt-4 flex items-center justify-between text-xs font-semibold tracking-wider text-emerald-400 opacity-90 animate-fade-in z-10">
            <span>&larr; OVERASSESSED BY {overassessedPct}%</span>
            <span>{formatDollar(potentialSavings)} / YR SAVINGS</span>
          </div>
        )}

        {/* Ambient background glow for graph */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-24 bg-gold/10 blur-[50px] rounded-full pointer-events-none z-0" />
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
