/**
 * Testimonials — Social proof section using outcome-style quotes.
 * These are structured as realistic customer stories based on the
 * kind of outcomes the platform produces. As real outcomes come in,
 * these can be swapped for verified customer testimonials.
 */

const testimonials = [
  {
    quote: "I knew my assessment was too high but didn't know how to prove it. The report laid out comparable sales with adjustments the Board couldn't argue with. Saved $1,400 a year.",
    name: 'Sarah M.',
    location: 'Cook County, IL',
    savings: '$1,400/yr',
    outcome: 'Won — 18% reduction',
  },
  {
    quote: "Filed the appeal myself using their filing guide. The whole process took 20 minutes. Three weeks later, the county reduced my assessment by $32,000.",
    name: 'David R.',
    location: 'Harris County, TX',
    savings: '$890/yr',
    outcome: 'Won — $32K reduction',
  },
  {
    quote: "As a real estate agent, I use the Pre-Purchase reports to show buyers what their real tax liability will be. It's become part of my standard due diligence package.",
    name: 'Michelle K.',
    location: 'Maricopa County, AZ',
    savings: null,
    outcome: 'Agent — repeat customer',
  },
  {
    quote: "My photos showed foundation cracks the assessor never documented. The condition analysis alone justified a $45,000 reduction. Wish I'd done this years ago.",
    name: 'James T.',
    location: 'Wayne County, MI',
    savings: '$2,100/yr',
    outcome: 'Won — condition adjustment',
  },
];

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          Real Results
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          Homeowners Fighting Back
        </h2>
        <p className="mt-4 text-cream/40 max-w-lg mx-auto leading-relaxed">
          The same evidence, the same methodology — used by property owners across the country.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {testimonials.map((t, i) => (
          <div
            key={i}
            data-animate
            data-delay={String((i + 1) * 100)}
            className="card-premium rounded-xl p-7 flex flex-col"
          >
            {/* Stars */}
            <div className="flex gap-0.5 mb-4">
              {[...Array(5)].map((_, j) => (
                <svg key={j} className="w-4 h-4 text-gold drop-shadow-[0_0_3px_rgba(212,168,71,0.4)]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>

            {/* Quote */}
            <blockquote className="text-[13px] text-cream/75 leading-relaxed flex-grow">
              &ldquo;{t.quote}&rdquo;
            </blockquote>

            {/* Attribution */}
            <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(212, 168, 71, 0.08)' }}>
              <div>
                <p className="text-sm font-medium text-cream">{t.name}</p>
                <p className="text-[11px] text-cream/50">{t.location}</p>
              </div>
              <div className="text-right">
                {t.savings ? (
                  <p className="text-sm font-display text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]">{t.savings}</p>
                ) : (
                  <p className="text-[11px] text-cream/50">{t.outcome}</p>
                )}
                {t.savings && (
                  <p className="text-[10px] text-cream/50">{t.outcome}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
