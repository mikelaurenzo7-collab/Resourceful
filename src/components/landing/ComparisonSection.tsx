import Link from 'next/link';

const options = [
  {
    label: 'Tax Attorney',
    price: '$2,000 – $5,000+',
    time: '4 – 8 weeks',
    details: [
      { text: 'Comparable sales analysis', included: true },
      { text: 'County-specific filing guide', included: true },
      { text: 'Expert hearing representation', included: true },
      { text: 'Affordable for most homeowners', included: false },
      { text: 'Quick turnaround', included: false },
    ],
    highlight: false,
  },
  {
    label: 'Resourceful',
    price: 'From $49',
    time: '1 – 2 days',
    details: [
      { text: 'Comparable sales analysis', included: true },
      { text: 'County-specific filing guide', included: true },
      { text: 'Expert-reviewed before delivery', included: true },
      { text: 'Affordable for every homeowner', included: true },
      { text: 'Ready in 1–2 business days', included: true },
    ],
    highlight: true,
  },
  {
    label: 'Traditional Appraisal',
    price: '$300 – $500',
    time: '1 – 2 weeks',
    details: [
      { text: 'Comparable sales analysis', included: true },
      { text: 'County-specific filing guide', included: false },
      { text: 'Requires in-person appointment', included: false },
      { text: 'Affordable for most homeowners', included: false },
      { text: 'Quick turnaround', included: false },
    ],
    highlight: false,
  },
];

export default function ComparisonSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center mb-16">
        <span className="text-sm font-medium tracking-widest text-gold uppercase">
          The Smart Choice
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3 text-balance">
          Professional Evidence, Without the Professional Price Tag
        </h2>
        <p className="mt-4 text-cream/50 max-w-xl mx-auto">
          Appeal boards evaluate evidence, not who presents it.
          Get the same quality analysis at a fraction of the cost.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {options.map((opt) => (
          <div
            key={opt.label}
            className={`
              relative rounded-xl p-8 flex flex-col transition-all duration-300
              ${
                opt.highlight
                  ? 'card-premium ring-1 ring-gold/40 shadow-gold-lg scale-[1.02] md:scale-105'
                  : 'card-premium opacity-80'
              }
            `}
          >
            {opt.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-gold-light via-gold to-gold-dark text-navy-deep text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                  Best Value
                </span>
              </div>
            )}

            <h3 className="font-display text-xl text-cream mb-1">{opt.label}</h3>
            <p className={`font-display text-3xl mb-1 ${opt.highlight ? 'text-gold' : 'text-cream/70'}`}>
              {opt.price}
            </p>
            <p className="text-sm text-cream/40 mb-6">{opt.time}</p>

            <ul className="space-y-3 flex-grow">
              {opt.details.map((d) => (
                <li key={d.text} className="flex items-start gap-3 text-sm">
                  {d.included ? (
                    <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-cream/20 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={d.included ? 'text-cream/70' : 'text-cream/30'}>
                    {d.text}
                  </span>
                </li>
              ))}
            </ul>

            {opt.highlight && (
              <Link
                href="/start"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-6 py-3 text-sm font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
              >
                Get My Report
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
