/**
 * SampleReport — Shows visitors what they'll receive.
 * Visual preview of report sections without actual data.
 * Reduces purchase anxiety by answering "what am I paying for?"
 */

const reportSections = [
  {
    title: 'Executive Summary',
    description: 'Your concluded market value, the over-assessment amount, and projected annual tax savings — all on page one.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    title: 'Comparable Sales Grid',
    description: '5–10 recent arm\'s-length sales with line-item adjustments for size, age, condition, and location. The same grid format appraisers use.',
    icon: 'M3 10h18M3 14h18M3 18h18M3 6h18',
  },
  {
    title: 'Condition Analysis',
    description: 'AI-powered analysis of your property photos documenting deferred maintenance, functional obsolescence, and external factors.',
    icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z',
  },
  {
    title: 'Assessment Ratio Analysis',
    description: 'How your assessment compares to your county\'s target ratio and whether it falls outside IAAO acceptable variance.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    title: 'Filing Instructions',
    description: 'Step-by-step instructions specific to your county: deadlines, forms, portal links, what to say at the hearing, and what to bring.',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Market Research',
    description: 'Local market trends, median sale prices, and neighborhood analysis that supports your valuation argument.',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
];

export default function SampleReport() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          What You&apos;ll Receive
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          A 16–22 Page Professional Report
        </h2>
        <p className="mt-4 text-cream/40 max-w-xl mx-auto leading-relaxed">
          The same evidence format and methodology licensed appraisers present to Boards of Review. Delivered as a downloadable PDF.
        </p>
      </div>

      {/* Report "pages" preview */}
      <div className="relative">
        {/* Decorative report frame */}
        <div className="card-elevated rounded-2xl p-8 md:p-10 overflow-hidden relative">
          {/* Subtle document texture */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold/30 via-gold/50 to-gold/30" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportSections.map((section, i) => (
              <div
                key={section.title}
                data-animate
                data-delay={String((i + 1) * 80)}
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
                    <p className="text-[12px] text-cream/35 leading-relaxed">{section.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom accent */}
          <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid rgba(212, 168, 71, 0.08)' }}>
            <p className="text-xs text-cream/50">
              Includes cover page, table of contents, methodology disclosure, and legal disclaimers.
              All reports are quality-reviewed before delivery.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
