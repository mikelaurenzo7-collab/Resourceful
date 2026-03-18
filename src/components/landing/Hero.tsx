import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-pattern">
      {/* Layered gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-deep via-navy-deep/95 to-navy-deep" />
      <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] via-transparent to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6 pt-32 pb-20 md:pt-40 md:pb-28">
        {/* Eyebrow */}
        <div className="mb-6 flex items-center gap-3">
          <span className="h-px w-12 bg-gold/60" />
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            Property Tax Appeal Experts
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.08] text-cream max-w-4xl text-balance">
          You&rsquo;re Probably Overpaying{' '}
          <span className="text-gold-gradient">Property Taxes</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg md:text-xl text-cream/60 leading-relaxed">
          Get a professional appeal report for a fraction of what appraisers charge.
          Expert-reviewed, backed by real comparable sales, delivered in 1&ndash;2 days.
        </p>

        {/* Value cards row */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          <div className="card-premium rounded-xl px-5 py-4 text-center">
            <p className="font-display text-3xl text-gold">$49</p>
            <p className="text-xs text-cream/40 mt-1">Starting price</p>
          </div>
          <div className="card-premium rounded-xl px-5 py-4 text-center">
            <p className="font-display text-3xl text-cream">1&ndash;2 Days</p>
            <p className="text-xs text-cream/40 mt-1">Report delivery</p>
          </div>
          <div className="card-premium rounded-xl px-5 py-4 text-center">
            <p className="font-display text-3xl text-emerald-400">$1,100+</p>
            <p className="text-xs text-cream/40 mt-1">Avg. annual savings</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
          <Link
            href="/start"
            className="inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
          >
            Get My Report
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="text-sm text-cream/30 self-center">
            A traditional appraisal costs $300&ndash;$500 and takes weeks.
          </p>
        </div>
      </div>
    </section>
  );
}
