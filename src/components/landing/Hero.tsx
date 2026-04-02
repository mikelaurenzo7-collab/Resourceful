import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-pattern bg-noise">
      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-deep via-navy-deep/95 to-navy-deep" />

      {/* Decorative gold gradient orb — top left behind headline */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[600px] w-[600px] animate-float rounded-full opacity-25"
        style={{
          background:
            'radial-gradient(circle, rgba(212,168,71,0.3) 0%, rgba(212,168,71,0.08) 40%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Decorative blue/navy orb — bottom right */}
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[700px] w-[700px] animate-float rounded-full opacity-35"
        style={{
          background:
            'radial-gradient(circle, rgba(30,48,85,0.6) 0%, rgba(30,48,85,0.2) 40%, transparent 70%)',
          filter: 'blur(100px)',
          animationDelay: '3s',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-36 pb-28">
        {/* Eyebrow */}
        <div className="mb-8 flex items-center gap-3 animate-fade-in">
          <span className="h-px w-12 bg-gradient-to-r from-gold/60 to-transparent" />
          <span className="text-sm font-medium tracking-widest text-gold/80 uppercase">
            Property Tax Intelligence
          </span>
        </div>

        {/* Headline — stagger-animated words */}
        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl leading-[1.08] text-cream max-w-4xl">
          <span className="inline-block animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Stop{' '}
          </span>
          <span className="inline-block animate-fade-in" style={{ animationDelay: '0.25s' }}>
            Overpaying{' '}
          </span>
          <span
            className="inline-block text-gold-gradient animate-fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            Property{' '}
          </span>
          <span
            className="inline-block text-gold-gradient animate-fade-in"
            style={{ animationDelay: '0.55s' }}
          >
            Taxes
          </span>
        </h1>

        <p
          className="mt-7 max-w-2xl text-lg md:text-xl text-cream/55 leading-relaxed animate-fade-in"
          style={{ animationDelay: '0.6s' }}
        >
          We compare your home to 5&ndash;10 similar recent sales and adjust for every difference &mdash;
          the same method licensed appraisers use. Your full report with filing instructions
          is delivered in hours, not weeks.
        </p>

        {/* Dollar example — animated gradient border */}
        <div
          className="mt-12 flex flex-wrap gap-8 items-end animate-fade-in"
          style={{ animationDelay: '0.75s' }}
        >
          <div className="card-premium border-gradient rounded-xl px-8 py-7 animate-glow">
            <div className="grid grid-cols-3 gap-8 md:gap-12 text-center">
              <div>
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-cream/35 mb-1.5">
                  Assessed Value
                </p>
                <p className="font-display text-xl md:text-2xl text-cream animate-count" style={{ animationDelay: '1s' }}>
                  $320,000
                </p>
              </div>
              <div>
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-cream/35 mb-1.5">
                  Actual Market Value
                </p>
                <p className="font-display text-xl md:text-2xl text-gold animate-count" style={{ animationDelay: '1.2s' }}>
                  $265,000
                </p>
              </div>
              <div>
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-cream/35 mb-1.5">
                  Annual Overpayment
                </p>
                <p className="font-display text-xl md:text-2xl text-red-400 animate-count" style={{ animationDelay: '1.4s' }}>
                  $1,180
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 animate-fade-in" style={{ animationDelay: '0.9s' }}>
          <Link
            href="/start"
            className="btn-glow animate-glow inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02] hover:brightness-110"
          >
            Get My Property Report
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="mt-4 text-xs text-cream/30">
            No account needed &middot; Results in minutes
          </p>
        </div>
      </div>
    </section>
  );
}
