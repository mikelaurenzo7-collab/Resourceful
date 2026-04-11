// ─── Property Intelligence Section ───────────────────────────────────────────
// "The future of real estate is knowing what your property is worth — always."
// Shows a compelling visual breakdown of what the REsourceful report covers,
// positioned as the intelligence layer every homeowner deserves.

import Link from 'next/link';

const capabilities = [
  {
    title: 'Comparable Sales Engine',
    description: 'Claude Sonnet analyzes recent arm’s-length sales and adjusts each one for size, age, condition, and location, creating the valuation backbone for every case.',
    metric: 'Case Foundation',
    icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z',
  },
  {
    title: 'Photo Evidence Intelligence',
    description: 'Customers upload property photos and Gemini converts them into defensible condition evidence the assessor likely missed, including wear, deferred maintenance, and visible risk factors.',
    metric: 'Multimodal Review',
    icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    title: 'County Workflow Memory',
    description: 'Every county has different deadlines, forms, and hearing procedures. The AI keeps those requirements organized so each case ships with the right local workflow.',
    metric: 'Workflow Coverage',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  },
  {
    title: 'Outcome Learning Loop',
    description: 'Every completed case makes the system sharper. The platform compounds market research, county nuance, and outcome signals into a better playbook for the next property.',
    metric: 'Compounding Edge',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
];

export default function PropertyIntelligence() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center mb-16" data-animate>
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          The Operating System
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          More Than a Report — The AI That Runs the Case
        </h2>
        <p className="mt-4 text-sm text-cream/35 max-w-xl mx-auto leading-relaxed">
          Resourceful is designed as an AI-native operating layer, not a static PDF shop. The AI runs the research, assembles the evidence, and keeps the business getting smarter with every case shipped.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {capabilities.map((cap, i) => (
          <div
            key={cap.title}
            className="group relative rounded-xl border border-cream/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-6 hover:border-gold/20 hover:shadow-[0_0_30px_rgba(212,168,71,0.04)] transition-all duration-300"
            data-animate={i % 2 === 0 ? 'slide-left' : 'slide-right'}
            data-delay={String((i + 1) * 100)}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gold/[0.08] border border-gold/[0.1] flex items-center justify-center flex-shrink-0 group-hover:bg-gold/[0.12] group-hover:border-gold/20 group-hover:shadow-[0_0_15px_rgba(212,168,71,0.08)] transition-all">
                <svg className="w-5 h-5 text-gold/70 group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={cap.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2.5">
                  <h3 className="font-display text-base text-cream">{cap.title}</h3>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gold/70 bg-gold/[0.08] border border-gold/10 px-2.5 py-0.5 rounded-full whitespace-nowrap sm:ml-auto">
                    {cap.metric}
                  </span>
                </div>
                <p className="text-[13px] text-cream/35 leading-relaxed">{cap.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Value Prop Closer */}
      <div className="mt-12 text-center" data-animate>
        <div className="mx-auto mb-5 flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs text-cream/50">
          <div className="hidden h-px w-8 bg-cream/10 sm:block" />
          The legacy market sells documents. Resourceful runs a repeatable tax-reduction machine.
          <div className="hidden h-px w-8 bg-cream/10 sm:block" />
        </div>
        <div>
          <Link
            href="/start"
            className="inline-flex items-center gap-2 text-sm font-semibold text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark px-7 py-3 rounded-lg hover:shadow-gold hover:brightness-110 transition-all duration-200"
          >
            Launch My AI Workflow
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
