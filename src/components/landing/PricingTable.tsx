import Link from 'next/link';
import { formatPrice, getPriceCents } from '@/config/pricing';

const tiers = [
  {
    name: 'Case Analysis',
    tier: 'auto' as const,
    description:
      'A reviewable evidence package for owners who are comfortable filing and presenting the case themselves.',
    features: [
      'Relevant comparable sales and adjustment grid',
      'Assessment and property-record review',
      'Condition evidence from submitted photos',
      'Jurisdiction-specific next-step checklist',
      'Source and limitation disclosures',
    ],
    cta: 'Start my analysis',
  },
  {
    name: 'Expert Review',
    tier: 'expert_reviewed' as const,
    description:
      'The complete case analysis plus professional review of the evidence, conclusions, and customer-ready package.',
    features: [
      'Everything in Case Analysis',
      'Professional review before delivery',
      'Comparable and adjustment quality check',
      'Clearer limitations and action priorities',
      'Priority delivery target',
    ],
    cta: 'Choose expert review',
    popular: true,
  },
  {
    name: 'Guided Filing',
    tier: 'guided_filing' as const,
    description:
      'Expert Review plus a live working session to help you prepare the filing and understand the hearing process.',
    features: [
      'Everything in Expert Review',
      'Live filing-preparation session',
      'Evidence and form walkthrough',
      'Hearing preparation and talking points',
      'Support through the initial filing step',
    ],
    cta: 'Choose guided filing',
    appealOnly: true,
  },
];

export default function PricingTable() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24" id="pricing" aria-labelledby="pricing-heading">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          Clear Service Levels
        </span>
        <h2 id="pricing-heading" className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          Pay for the level of help you need
        </h2>
        <p className="mt-4 text-cream/45 max-w-2xl mx-auto leading-relaxed">
          Every package starts with the same evidence standards. The difference is the level of professional review and filing support included.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {tiers.map((tier, index) => {
          const price = getPriceCents('tax_appeal', 'residential', tier.tier);
          const href = tier.tier === 'auto'
            ? '/start?service=tax_appeal'
            : `/start?service=tax_appeal&tier=${tier.tier.replace('_', '-')}`;

          return (
            <article
              key={tier.tier}
              data-animate
              data-delay={String((index + 1) * 100)}
              className={`relative rounded-xl p-7 flex flex-col transition-all duration-300 ${
                tier.popular ? 'card-shimmer ring-2 ring-gold/30' : 'card-premium'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-gold-light via-gold to-gold-dark text-navy-deep text-[10px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="font-display text-xl text-cream">{tier.name}</h3>
              <p className="text-sm text-cream/50 leading-relaxed mt-2 mb-5">
                {tier.description}
              </p>

              <div className="mb-6">
                <span className="font-display text-3xl text-gold text-glow-gold">{formatPrice(price)}</span>
                <span className="text-xs text-cream/50 ml-1.5">residential starting price</span>
              </div>

              <ul className="space-y-2.5 mb-8 flex-grow">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-cream/70">
                    <svg className="w-4 h-4 text-gold/55 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {tier.appealOnly && (
                <p className="text-xs text-cream/50 mb-3">Available for tax-appeal matters.</p>
              )}

              <Link
                href={href}
                className={`text-center text-sm font-semibold py-3 rounded-lg transition-all duration-200 ${
                  tier.popular
                    ? 'btn-premium-glow text-navy-deep shadow-gold hover:shadow-gold-lg'
                    : 'border border-gold/20 text-gold hover:border-gold/40 hover:bg-gold/[0.05]'
                }`}
              >
                {tier.cta}
              </Link>
            </article>
          );
        })}
      </div>

      <div className="mx-auto mt-8 max-w-3xl space-y-2 text-center text-xs leading-relaxed text-cream/50">
        <p>Upload a readable tax bill and save 15% where the discount is shown at checkout. Commercial and complex-property pricing varies by scope.</p>
        <p>Filing, representation, and attorney services are offered only after jurisdiction and eligibility review and are not included unless expressly stated in a written engagement.</p>
      </div>
    </section>
  );
}
