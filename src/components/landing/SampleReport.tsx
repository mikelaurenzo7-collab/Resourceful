const reportSections = [
  {
    title: 'Decision Summary',
    description:
      'The property question, available assessment facts, supported value range or conclusion when appropriate, material limitations, and recommended next action.',
    icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
  },
  {
    title: 'Comparable Evidence Grid',
    description:
      'Relevant sales, source details, similarity factors, visible adjustments, and exclusion reasons. The number of usable comparables depends on the market and data available.',
    icon: 'M3 10h18M3 14h18M3 18h18M3 6h18',
  },
  {
    title: 'Property and Condition Evidence',
    description:
      'Recorded property characteristics, submitted photographs, visible observations, supporting notes, and clear separation between observed condition and unsupported valuation effects.',
    icon: 'M3 9a2 2 0 0 1 2-2h.9a2 2 0 0 0 1.7-.9l.8-1.2A2 2 0 0 1 10.1 4h3.8a2 2 0 0 1 1.7.9l.8 1.2a2 2 0 0 0 1.7.9h.9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z',
  },
  {
    title: 'Assessment Analysis',
    description:
      'The recorded assessment, assessment year, available ratio context, arithmetic used, and any data gaps that prevent a reliable comparison.',
    icon: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2Zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z',
  },
  {
    title: 'Evidence Index and Sources',
    description:
      'A reviewable list of documents, records, links, retrieval dates, and source limitations supporting the work product.',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  {
    title: 'Next-Step Guide',
    description:
      'For supported jurisdictions: the responsible authority, deadline rule, required materials, filing path, verification notes, and customer responsibilities.',
    icon: 'm21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  },
];

export default function SampleReport() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24" aria-labelledby="deliverables-heading">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          What You Receive
        </span>
        <h2 id="deliverables-heading" className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          A reviewable workfile—not a black-box score
        </h2>
        <p className="mt-4 text-cream/45 max-w-2xl mx-auto leading-relaxed">
          The exact length and sections vary with the property, service, jurisdiction, and available evidence. Every delivered section should earn its place by helping explain the conclusion or the next action.
        </p>
      </div>

      <div className="relative">
        <div className="card-elevated rounded-2xl p-8 md:p-10 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold/30 via-gold/50 to-gold/30" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportSections.map((section, index) => (
              <article
                key={section.title}
                data-animate
                data-delay={String((index + 1) * 80)}
                className="group"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-gold/[0.06] border border-gold/[0.08] flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:bg-gold/[0.1] group-hover:border-gold/[0.15]">
                    <svg className="w-4.5 h-4.5 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={section.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-cream/90 mb-1">{section.title}</h3>
                    <p className="text-xs text-cream/45 leading-relaxed">{section.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 pt-6 text-center border-t border-gold/10">
            <p className="text-xs leading-relaxed text-cream/50">
              Standard analyses are informational work products, not legal advice or certified appraisals. Professional review, filing support, or regulated services are included only when the selected package and written scope expressly say so.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
