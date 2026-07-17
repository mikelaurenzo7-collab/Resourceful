import Link from 'next/link';

const capabilities = [
  {
    title: 'Comparable evidence',
    description:
      'Relevant sales are screened for proximity, timing, property similarity, and source quality. Adjustments and exclusions remain visible for review.',
    metric: 'Market support',
    icon: 'M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.6a1 1 0 0 1-.3.7l-6.4 6.4a1 1 0 0 0-.3.7V17l-4 4v-6.6a1 1 0 0 0-.3-.7L3.3 7.3a1 1 0 0 1-.3-.7V4Z',
  },
  {
    title: 'Condition documentation',
    description:
      'Submitted photos help document visible condition and deferred maintenance. Observations are separated from unsupported dollar conclusions and remain subject to review.',
    metric: 'Property evidence',
    icon: 'M3 9a2 2 0 0 1 2-2h.9a2 2 0 0 0 1.7-.9l.8-1.2A2 2 0 0 1 10.1 4h3.8a2 2 0 0 1 1.7.9l.8 1.2a2 2 0 0 0 1.7.9h.9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Zm12 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  },
  {
    title: 'Jurisdiction guidance',
    description:
      'Deadlines, authorities, forms, evidence requirements, and filing paths are organized by jurisdiction. Missing or stale rules are flagged instead of filled with assumptions.',
    metric: 'Filing readiness',
    icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  },
  {
    title: 'Outcome tracking',
    description:
      'The workflow is designed to capture whether a case was filed, accepted, heard, settled, denied, or granted—and why—so future decisions improve from real outcomes.',
    metric: 'Case accountability',
    icon: 'm21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  },
];

export default function PropertyIntelligence() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24" aria-labelledby="property-intelligence-heading">
      <div className="text-center mb-16" data-animate>
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          The Evidence Layer
        </span>
        <h2 id="property-intelligence-heading" className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          More useful than a black-box estimate
        </h2>
        <p className="mt-4 text-sm text-cream/45 max-w-2xl mx-auto leading-relaxed">
          Resourceful helps organize the facts behind a property decision. The goal is not to make automation sound authoritative—it is to make the evidence easier to inspect, challenge, and act on.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {capabilities.map((capability, index) => (
          <article
            key={capability.title}
            className="group relative rounded-xl border border-cream/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-6 hover:border-gold/20 hover:shadow-[0_0_30px_rgba(212,168,71,0.04)] transition-all duration-300"
            data-animate={index % 2 === 0 ? 'slide-left' : 'slide-right'}
            data-delay={String((index + 1) * 100)}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gold/[0.08] border border-gold/[0.1] flex items-center justify-center flex-shrink-0 group-hover:bg-gold/[0.12] group-hover:border-gold/20 transition-all">
                <svg className="w-5 h-5 text-gold/70 group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={capability.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2.5">
                  <h3 className="font-display text-base text-cream">{capability.title}</h3>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gold/70 bg-gold/[0.08] border border-gold/10 px-2.5 py-0.5 rounded-full whitespace-nowrap sm:ml-auto">
                    {capability.metric}
                  </span>
                </div>
                <p className="text-sm text-cream/50 leading-relaxed">{capability.description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-12 text-center" data-animate>
        <p className="mx-auto mb-5 max-w-2xl text-sm leading-relaxed text-cream/50">
          A useful property analysis should show its work, state its limits, and leave the customer with a defensible next step.
        </p>
        <Link
          href="/start"
          className="inline-flex items-center gap-2 text-sm font-semibold text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark px-7 py-3 rounded-lg hover:shadow-gold hover:brightness-110 transition-all duration-200"
        >
          Review my property
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m17 8 4 4m0 0-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
