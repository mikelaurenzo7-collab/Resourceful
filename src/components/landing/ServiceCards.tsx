import Link from 'next/link';
import { getPriceCents, formatPrice } from '@/config/pricing';

const services = [
  {
    title: 'Tax Appeal Report',
    service: 'tax_appeal' as const,
    description:
      'Comprehensive evidence package for your property tax appeal. Comparable sales analysis, condition documentation, and a professional narrative — everything the Board of Review expects.',
    features: ['5+ comparable sales with adjustments', 'Condition analysis from your photos', 'Filing instructions for your county', 'Pro se hearing guidance'],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    popular: true,
  },
  {
    title: 'Pre-Purchase Analysis',
    service: 'pre_purchase' as const,
    description:
      'Know what you\'ll really pay in taxes before you buy. Independent valuation analysis reveals whether the asking price aligns with the assessment — or if a tax appeal is in your future.',
    features: ['Market value vs. assessed value comparison', 'Projected annual tax liability', 'Appeal feasibility assessment', 'Neighborhood tax trend analysis'],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    popular: false,
  },
  {
    title: 'Pre-Listing Report',
    service: 'pre_listing' as const,
    description:
      'Attract buyers with evidence their tax burden will be manageable. A professional valuation report that strengthens your listing and removes a common buyer objection.',
    features: ['Independent market valuation', 'Tax projection for buyers', 'Professional PDF report', 'Listing-ready presentation'],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    popular: false,
  },
];

export default function ServiceCards() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center mb-16">
        <span className="text-sm font-medium tracking-widest text-gold uppercase">
          Our Reports
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3">
          Choose Your Report
        </h2>
        <p className="mt-4 text-cream/45 max-w-xl mx-auto leading-relaxed">
          Each report is built from real market data, professionally analyzed, and reviewed
          before delivery.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {services.map((svc, i) => (
          <Link
            key={svc.service}
            href="/start"
            data-animate
            data-delay={String((i + 1) * 100)}
            className={`
              group relative rounded-xl p-8 flex flex-col no-underline
              transition-all duration-300 hover:-translate-y-1 hover:shadow-gold-lg
              ${svc.popular ? 'card-elevated ring-2 ring-gold/30 animate-glow' : 'card-premium hover:border-gold/30'}
            `}
          >
            {svc.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="relative bg-gradient-to-r from-gold-light via-gold to-gold-dark text-navy-deep text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider overflow-hidden">
                  Most Popular
                  <span className="absolute inset-0 animate-shimmer rounded-full" />
                </span>
              </div>
            )}

            <div className="text-gold mb-5 transition-transform duration-300 group-hover:scale-110">{svc.icon}</div>

            <h3 className="font-display text-xl text-cream mb-3">{svc.title}</h3>
            <p className="text-sm text-cream/45 leading-relaxed mb-6 flex-grow">
              {svc.description}
            </p>

            <ul className="space-y-2.5 mb-8">
              {svc.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-cream/65">
                  <svg className="w-4 h-4 text-gold/70 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <div className="flex items-end justify-between mt-auto pt-6" style={{ borderTop: '1px solid rgba(212, 168, 71, 0.08)' }}>
              <div>
                <span className="text-[10px] text-cream/35 uppercase tracking-wider">From</span>
                <p className="font-display text-3xl text-gold animate-count">
                  {formatPrice(getPriceCents(svc.service, 'residential'))}
                </p>
              </div>
              <span className="text-sm text-gold/70 group-hover:text-gold transition-colors font-medium flex items-center gap-1">
                Get Started
                <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
