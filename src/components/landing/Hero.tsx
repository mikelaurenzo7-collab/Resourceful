import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-pattern bg-noise">
      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-deep via-navy-deep/95 to-navy-deep" />

      {/* Decorative gold gradient orb — top left behind headline */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[500px] w-[500px] animate-float rounded-full opacity-30"
        style={{
          background:
            'radial-gradient(circle, rgba(212,168,71,0.25) 0%, rgba(212,168,71,0.08) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Decorative blue/navy orb — bottom right */}
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] animate-float rounded-full opacity-40"
        style={{
          background:
            'radial-gradient(circle, rgba(30,48,85,0.6) 0%, rgba(30,48,85,0.2) 40%, transparent 70%)',
          filter: 'blur(80px)',
          animationDelay: '3s',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-32 pb-24">
        {/* Eyebrow */}
        <div className="mb-6 flex items-center gap-3 animate-fade-in">
          <span className="h-px w-12 bg-gold/60" />
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            Property Tax Intelligence
          </span>
        </div>

        {/* Headline — stagger-animated words */}
        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl leading-tight text-cream max-w-4xl">
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
          className="mt-6 max-w-2xl text-lg text-cream/60 leading-relaxed animate-fade-in"
          style={{ animationDelay: '0.6s' }}
        >
          We compare your home to 5&ndash;10 similar recent sales and adjust for every difference &mdash;
          the same method licensed appraisers use. Your full report with filing instructions
          is delivered in hours, not weeks.
        </p>

        {/* Dollar example — animated gradient border */}
        <div
          className="mt-10 flex flex-wrap gap-8 items-end animate-fade-in"
          style={{ animationDelay: '0.75s' }}
        >
          <div className="card-premium border-gradient rounded-xl px-8 py-6 animate-glow">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <p className="text-xs uppercase tracking-wider text-cream/40 mb-1">
                  Assessed Value
                </p>
                <p className="font-display text-2xl text-cream animate-count" style={{ animationDelay: '1s' }}>
                  $320,000
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-cream/40 mb-1">
                  Actual Market Value
                </p>
                <p className="font-display text-2xl text-gold animate-count" style={{ animationDelay: '1.2s' }}>
                  $265,000
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-cream/40 mb-1">
                  Annual Overpayment
                </p>
                <p className="font-display text-2xl text-red-400 animate-count" style={{ animationDelay: '1.4s' }}>
                  $1,180
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 animate-fade-in" style={{ animationDelay: '0.9s' }}>
          <Link
            href="/start"
            className="btn-glow animate-glow inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
          >
            Get My Property Report
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
