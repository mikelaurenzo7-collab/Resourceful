import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-pattern">
      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-deep via-navy-deep/95 to-navy-deep" />

      <div className="relative mx-auto max-w-6xl px-6 pt-32 pb-24">
        {/* Eyebrow */}
        <div className="mb-6 flex items-center gap-3">
          <span className="h-px w-12 bg-gold/60" />
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            Property Intelligence Platform
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-5xl md:text-6xl lg:text-7xl leading-tight text-cream max-w-4xl">
          Stop Overpaying{' '}
          <span className="text-gold-gradient">Property Taxes</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-cream/60 leading-relaxed">
          Professional-grade property analysis reports for tax appeals, pre-purchase due diligence,
          and pre-listing strategy. Real market data. No attorney required.
        </p>

        {/* Dollar example */}
        <div className="mt-10 flex flex-wrap gap-8 items-end">
          <div className="card-premium rounded-xl px-8 py-6">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <p className="text-xs uppercase tracking-wider text-cream/40 mb-1">
                  Assessed Value
                </p>
                <p className="font-display text-2xl text-cream">$320,000</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-cream/40 mb-1">
                  Actual Market Value
                </p>
                <p className="font-display text-2xl text-gold">$265,000</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-cream/40 mb-1">
                  Annual Overpayment
                </p>
                <p className="font-display text-2xl text-red-400">$1,180</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10">
          <Link
            href="/start"
            className="inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
          >
            Check My Property
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
