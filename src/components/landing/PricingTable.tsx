import Link from 'next/link';
import { formatPrice, getPriceCents } from '@/config/pricing';

const tiers = [
  {
    name: 'Auto Report',
    tier: 'auto' as const,
    description: 'AI-generated evidence package reviewed by our team before delivery.',
    features: [
      '5–10 comparable sales with adjustments',
      'Assessment ratio analysis',
      'Condition documentation from photos',
      'County-specific filing guide',
      'PDF report delivered in 48 hours',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Expert Reviewed',
    tier: 'expert_reviewed' as const,
    description: 'Everything in Auto, plus a licensed appraiser reviews your report line-by-line.',
    features: [
      'Everything in Auto Report',
      'Licensed appraiser review',
      'Enhanced comparable selection',
      'Detailed adjustment narratives',
      'Priority 24-hour delivery',
    ],
    cta: 'Get Started',
    popular: true,
  },
  {
    name: 'Guided Filing',
    tier: 'guided_filing' as const,
    description: 'Expert-reviewed report plus a live session where we walk you through filing.',
    features: [
      'Everything in Expert Reviewed',
      'Live guided filing session',
      'Evidence preparation walkthrough',
      'Hearing prep coaching',
      'Email support through resolution',
    ],
    cta: 'Get Started',
    appealOnly: true,
  },
  {
    name: 'Full Representation',
    tier: 'full_representation' as const,
    description: 'We handle everything — filing, evidence, and hearing representation.',
    features: [
      'Everything in Guided Filing',
      'We file the appeal for you',
      'Hearing representation included',
      'Dedicated case manager',
      'Available in select counties',
    ],
    cta: 'Get Started',
    premium: true,
    appealOnly: true,
  },
];

export default function PricingTable() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24" id="pricing">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          Transparent Pricing
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          Choose Your Level of Support
        </h2>
        <p className="mt-4 text-cream/40 max-w-xl mx-auto leading-relaxed">
          Every tier includes the same professional evidence package. Tax-appeal support scales from do-it-yourself filing to full representation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {tiers.map((t, i) => {
          const price = getPriceCents('tax_appeal', 'residential', t.tier);
          const href = t.tier === 'auto'
            ? '/start'
            : `/start?tier=${t.tier.replace('_', '-')}`;

          return (
            <div
              key={t.tier}
              data-animate
              data-delay={String((i + 1) * 100)}
              className={`
                relative rounded-xl p-7 flex flex-col
                transition-all duration-300
                ${t.popular
                  ? 'card-shimmer ring-2 ring-gold/30'
                  : t.premium
                  ? 'card-elevated ring-2 ring-[#d4a843]/40'
                  : 'card-premium'}
              `}
            >
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-gold-light via-gold to-gold-dark text-navy-deep text-[10px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider animate-badge-pulse">
                    Most Popular
                  </span>
                </div>
              )}
              {t.premium && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-[#d4a843] text-navy-deep text-[10px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider animate-badge-pulse">
                    Premium
                  </span>
                </div>
              )}

              <h3 className="font-display text-lg text-cream">{t.name}</h3>
              <p className="text-[12px] text-cream/35 leading-relaxed mt-2 mb-5">
                {t.description}
              </p>

              <div className="mb-6">
                <span className="font-display text-3xl text-gold text-glow-gold">{formatPrice(price)}</span>
                <span className="text-xs text-cream/50 ml-1.5">residential</span>
              </div>

              <ul className="space-y-2.5 mb-8 flex-grow">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-cream/70">
                    <svg className="w-3.5 h-3.5 text-gold/50 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {t.appealOnly && (
                <p className="text-[10px] text-cream/50 mb-3">Tax appeal reports only</p>
              )}

              <Link
                href={href}
                className={`
                  text-center text-sm font-semibold py-3 rounded-lg transition-all duration-200
                  ${t.popular || t.premium
                    ? 'btn-premium-glow text-navy-deep shadow-gold hover:shadow-gold-lg'
                    : 'border border-gold/20 text-gold hover:border-gold/40 hover:bg-gold/[0.05] hover:shadow-[0_0_15px_rgba(212,168,71,0.05)]'}
                `}
              >
                {t.cta}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-cream/50 mt-8">
        Upload your tax bill at checkout and save 15% on any tier. Commercial and industrial properties start at $99.
      </p>
    </section>
  );
}
