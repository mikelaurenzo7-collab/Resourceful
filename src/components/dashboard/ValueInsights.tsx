'use client';

interface ValueInsightsProps {
  assessorImpliedMarketValue: number | null;
  concludedValue: number | null;
  reportedAssessmentReduction: number | null;
  caseStrength: number | null;
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
  assessorImpliedMarketValue,
  concludedValue,
  reportedAssessmentReduction,
  caseStrength,
  serviceType,
}: ValueInsightsProps) {
  const isTaxAppeal = serviceType === 'tax_appeal';
  const hasValues =
    assessorImpliedMarketValue != null &&
    assessorImpliedMarketValue > 0 &&
    concludedValue != null &&
    concludedValue > 0;

  if (!hasValues) return null;

  const marketValueGap = Math.max(0, assessorImpliedMarketValue - concludedValue);
  const marketValueGapPct = marketValueGap > 0
    ? Math.round((marketValueGap / concludedValue) * 1000) / 10
    : 0;
  const isAboveConclusion = marketValueGapPct > 0;
  const conclusionShare = Math.max(
    10,
    Math.min(100, (concludedValue / assessorImpliedMarketValue) * 100)
  );

  return (
    <div className="card-premium rounded-xl overflow-hidden" data-animate>
      <div className="px-5 py-3 border-b border-gold/[0.08] bg-gold/[0.03]">
        <h3 className="text-xs font-semibold tracking-widest text-gold/60 uppercase">
          {isTaxAppeal ? 'Assessment Comparison' : 'Property Valuation'}
        </h3>
      </div>

      <div className="px-6 pt-7 pb-7 border-b border-gold/[0.04] relative">
        <div className="grid sm:grid-cols-2 gap-5 relative z-10">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gold/60 mb-1.5 font-semibold">
              Resourceful Concluded Value
            </p>
            <p className="font-display text-3xl sm:text-4xl text-gold drop-shadow-md">
              {formatDollar(concludedValue)}
            </p>
            <p className="text-[11px] text-cream/30 mt-2">
              AI-assisted valuation conclusion based on the evidence available in this workfile.
            </p>
          </div>

          <div className="sm:text-right">
            <p className="text-[10px] uppercase tracking-widest text-cream/40 mb-1.5 font-semibold">
              {isTaxAppeal ? 'Assessor-Implied Market Value' : 'Reference Market Value'}
            </p>
            <p className="font-display text-2xl sm:text-3xl text-cream/70">
              {formatDollar(assessorImpliedMarketValue)}
            </p>
            <p className="text-[11px] text-cream/30 mt-2">
              {isTaxAppeal
                ? 'Raw assessment normalized by the jurisdiction assessment ratio when applicable.'
                : 'Reference value used for the comparison.'}
            </p>
          </div>
        </div>

        <div className="mt-6 relative h-3 w-full bg-navy-deep rounded-full overflow-hidden border border-cream/[0.03] shadow-inner z-10">
          <div className="absolute inset-0 bg-gradient-to-r from-cream/[0.03] to-cream/[0.08]" />
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold-dark via-gold to-gold-light rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${conclusionShare}%` }}
          />
        </div>

        {isTaxAppeal && isAboveConclusion && (
          <div className="mt-4 flex items-center justify-between gap-4 text-[11px] font-semibold tracking-wide text-emerald-300/90 relative z-10">
            <span>ASSESSOR-IMPLIED VALUE IS {marketValueGapPct}% ABOVE THE CONCLUSION</span>
            <span>{formatDollar(marketValueGap)} VALUE GAP</span>
          </div>
        )}

        {isTaxAppeal && reportedAssessmentReduction != null && reportedAssessmentReduction > 0 && (
          <div className="mt-5 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-3 relative z-10">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-300/70">
              Client-Reported Appeal Result
            </p>
            <p className="font-display text-xl text-emerald-300 mt-1">
              {formatDollar(reportedAssessmentReduction)} assessment reduction
            </p>
            <p className="text-[11px] text-cream/35 mt-1">
              This is the reported reduction in assessed value, not an estimate of annual tax-dollar savings.
            </p>
          </div>
        )}

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-24 bg-gold/10 blur-[50px] rounded-full pointer-events-none z-0" />
      </div>

      <div className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        {isAboveConclusion && isTaxAppeal ? (
          <p className="text-[11px] text-cream/35">
            The assessor-implied market value exceeds the evidence-backed conclusion.
          </p>
        ) : (
          <p className="text-[11px] text-cream/25">
            {isTaxAppeal
              ? 'Assessment appears within the concluded market-value range.'
              : 'Conclusion reflects the available market, income, cost, and property evidence.'}
          </p>
        )}
        {caseStrength != null && isTaxAppeal && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${strengthLabel(caseStrength).classes}`}>
            Appeal evidence: {strengthLabel(caseStrength).label}
          </span>
        )}
      </div>
    </div>
  );
}
