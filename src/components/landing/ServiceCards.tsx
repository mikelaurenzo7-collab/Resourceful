import Link from 'next/link';
import { getPriceCents, formatPrice } from '@/config/pricing';
import type { ReviewTier } from '@/types/database';

interface ServiceDef {
  title: string;
  service: 'tax_appeal' | 'pre_purchase' | 'pre_listing';
  tier?: ReviewTier;
  description: string;
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
  premium?: boolean;
}

const services: ServiceDef[] = [
  {
    title: 'Tax Appeal Report',
    service: 'tax_appeal',
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
    service: 'pre_purchase',
    description:
      'Know what you\'ll really pay in taxes before you buy. Independent valuation analysis reveals whether the asking price aligns with the assessment — or if a tax appeal is in your future.',
    features: ['Market value vs. assessed value comparison', 'Projected annual tax liability', 'Appeal feasibility assessment', 'Neighborhood tax trend analysis'],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    title: 'Pre-Listing Report',
    service: 'pre_listing',
    description:
      'Attract buyers with evidence their tax burden will be manageable. A professional valuation report that strengthens your listing and removes a common buyer objection.',
    features: ['Independent market valuation', 'Tax projection for buyers', 'Professional PDF report', 'Listing-ready presentation'],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    title: 'Full Representation',
    service: 'tax_appeal',
    tier: 'full_representation',
    description:
      'We handle everything — filing, evidence preparation, and hearing representation. Sit back while our team fights for your reduction. Available in select counties.',
    features: ['We file the appeal on your behalf', 'Hearing representation included', 'No additional fee if we don\'t win', 'Dedicated case manager assigned'],
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    premium: true,
  },
];

export default function ServiceCards() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          Our Reports
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          Choose Your Report
        </h2>
        <p className="mt-4 text-cream/40 max-w-xl mx-auto leading-relaxed">
          Each report is built from real market data, professionally analyzed, and reviewed
          before delivery.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {services.map((svc, i) => {
          const href = svc.premium
            ? `/start?service=${svc.service}&tier=full-representation`
            : `/start?service=${svc.service}`;

          return (
            <Link
              key={`${svc.service}-${svc.tier ?? 'auto'}`}
              href={href}
              data-animate
              data-delay={String((i + 1) * 100)}
              className={`
                group relative rounded-xl p-8 flex flex-col no-underline
                transition-all duration-300 hover:-translate-y-1 hover:shadow-gold-lg
                ${svc.popular ? 'card-elevated ring-2 ring-gold/30 animate-glow' : ''}
                ${svc.premium ? 'card-elevated ring-2 ring-[#d4a843]/40' : ''}
                ${!svc.popular && !svc.premium ? 'card-premium hover:border-gold/30' : ''}
              `}
            >
              {/* Most Popular badge */}
              {svc.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="relative bg-gradient-to-r from-gold-light via-gold to-gold-dark text-navy-deep text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider overflow-hidden">
                    Most Popular
                    <span className="absolute inset-0 animate-shimmer rounded-full" />
                  </span>
                </div>
              )}

              {/* Premium badge */}
              {svc.premium && (
                <div className="absolute -top-3 right-6 z-10">
                  <span className="bg-[#d4a843] text-navy-deep text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Premium
                  </span>
                </div>
              )}

              <div className="text-gold/80 mb-5 transition-transform duration-300 group-hover:scale-110">{svc.icon}</div>

              <h3 className="font-display text-xl text-cream mb-2">{svc.title}</h3>
              <p className="text-[13px] text-cream/40 leading-relaxed mb-6 flex-grow">
                {svc.description}
              </p>

              <ul className="space-y-2 mb-8">
                {svc.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-cream/55">
                    <svg className="w-3.5 h-3.5 text-gold/50 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    {formatPrice(getPriceCents(svc.service, 'residential', svc.tier ?? 'auto'))}
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
          );
        })}
      </div>
    </section>
  );
}
