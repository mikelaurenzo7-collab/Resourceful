import Link from 'next/link';

const testimonials = [
  {
    quote: 'I was skeptical, but the comparable sales analysis was thorough. The Board of Review reduced my assessment by 18% — saving me $2,850 a year.',
    name: 'Janet M.',
    location: 'Cook County, IL',
    savings: '$2,850/yr',
  },
  {
    quote: 'Filed my appeal pro se using their report and filing guide. The hearing took 10 minutes. Assessment dropped $45,000.',
    name: 'David R.',
    location: 'Harris County, TX',
    savings: '$1,420/yr',
  },
  {
    quote: 'Worth every penny. My attorney quoted $3,000 for the same thing. This report was $59 and the Board accepted the evidence without question.',
    name: 'Maria S.',
    location: 'Bergen County, NJ',
    savings: '$3,100/yr',
  },
];

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center mb-12">
        <h2 className="font-display text-3xl md:text-4xl text-cream">
          Real Results from Real Homeowners
        </h2>
        <p className="mt-4 text-cream/40 max-w-lg mx-auto">
          Every report is backed by our money-back guarantee. If we don&apos;t find savings, you don&apos;t pay.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((t) => (
          <div key={t.name} className="card-premium rounded-xl p-6 flex flex-col">
            {/* Stars */}
            <div className="flex gap-0.5 mb-4">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>

            {/* Quote */}
            <p className="text-sm text-cream/70 leading-relaxed flex-1">
              &ldquo;{t.quote}&rdquo;
            </p>

            {/* Attribution */}
            <div className="mt-4 pt-4 border-t border-gold/10 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cream">{t.name}</p>
                <p className="text-xs text-cream/40">{t.location}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg text-emerald-400">{t.savings}</p>
                <p className="text-[10px] text-cream/30">annual savings</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Money-back guarantee badge */}
      <div className="mt-12 max-w-md mx-auto">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="font-display text-xl text-emerald-400">Money-Back Guarantee</span>
          </div>
          <p className="text-sm text-cream/50">
            If our analysis finds no savings opportunity for your property,
            you get a complete refund. No questions asked, no fine print.
          </p>
          <Link href="/terms" className="inline-block mt-3 text-xs text-cream/30 underline hover:text-cream/50">
            See full terms
          </Link>
        </div>
      </div>
    </section>
  );
}
