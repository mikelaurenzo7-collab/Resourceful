import Link from 'next/link';
import { getPriceCents, formatPrice } from '@/config/pricing';

interface ServiceDef {
  title: string;
  service: 'tax_appeal' | 'pre_purchase' | 'pre_listing';
  description: string;
  features: string[];
  cta: string;
  icon: React.ReactNode;
  primary?: boolean;
}

const services: ServiceDef[] = [
  {
    title: 'Property Tax Appeal',
    service: 'tax_appeal',
    description:
      'Understand whether the assessment appears supportable, what evidence strengthens the case, and what the jurisdiction requires next.',
    features: [
      'Assessment and property-record review',
      'Relevant comparable-sales analysis',
      'Condition evidence and source notes',
      'Filing-readiness checklist',
    ],
    cta: 'Review my assessment',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0-3 9a5 5 0 0 0 6 0L6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6 0l-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    primary: true,
  },
  {
    title: 'Pre-Purchase Review',
    service: 'pre_purchase',
    description:
      'Pressure-test value, recorded assessment, property taxes, and appeal exposure before a purchase decision becomes expensive to reverse.',
    features: [
      'Value and assessment comparison',
      'Recorded tax-burden review',
      'Property and neighborhood evidence',
      'Decision risks and open questions',
    ],
    cta: 'Evaluate a purchase',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
      </svg>
    ),
  },
  {
    title: 'Pre-Listing Review',
    service: 'pre_listing',
    description:
      'Prepare a supportable pricing and property-tax story before listing so buyers receive clearer facts and fewer surprises.',
    features: [
      'Independent value evidence',
      'Assessment and tax context',
      'Property-condition documentation',
      'Buyer-ready discussion points',
    ],
    cta: 'Prepare a listing',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4" />
      </svg>
    ),
  },
];

export default function ServiceCards() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24" aria-labelledby="services-heading">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          Choose the Decision
        </span>
        <h2 id="services-heading" className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          Start with the property question you need answered
        </h2>
        <p className="mt-4 text-cream/45 max-w-2xl mx-auto leading-relaxed">
          Resourceful turns scattered records and property evidence into a reviewable analysis and a clear next step. Tax appeals are the core service; purchase and listing reviews use the same evidence discipline.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {services.map((service, index) => {
          const href = `/start?service=${service.service}`;

          return (
            <Link
              key={service.service}
              href={href}
              data-animate
              data-delay={String((index + 1) * 100)}
              className={`group relative rounded-xl p-8 flex flex-col no-underline transition-all duration-300 hover:-translate-y-1 hover:shadow-gold-lg focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-navy-deep ${
                service.primary ? 'card-elevated ring-2 ring-gold/30' : 'card-premium hover:border-gold/30'
              }`}
            >
              {service.primary && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-gold-light via-gold to-gold-dark text-navy-deep text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                    Core Service
                  </span>
                </div>
              )}

              <div className="text-gold/80 mb-5 transition-all duration-300 group-hover:scale-105 group-hover:text-gold">
                {service.icon}
              </div>

              <h3 className="font-display text-xl text-cream mb-2">{service.title}</h3>
              <p className="text-sm text-cream/50 leading-relaxed mb-6 flex-grow">
                {service.description}
              </p>

              <ul className="space-y-2 mb-8">
                {service.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-cream/65">
                    <svg className="w-4 h-4 text-gold/50 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="flex items-end justify-between mt-auto pt-6 border-t border-gold/10">
                <div>
                  <span className="text-[10px] text-cream/40 uppercase tracking-wider">Starting at</span>
                  <p className="font-display text-3xl text-gold">
                    {formatPrice(getPriceCents(service.service, 'residential'))}
                  </p>
                </div>
                <span className="text-sm text-gold/75 group-hover:text-gold transition-colors font-medium flex items-center gap-1">
                  {service.cta}
                  <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
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
