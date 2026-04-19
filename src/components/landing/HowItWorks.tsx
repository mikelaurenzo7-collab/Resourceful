const steps = [
  {
    number: '01',
    title: 'Point Claude at the Opportunity',
    description:
      'Enter the address, choose the workflow, and add any context that matters. Uploading a tax bill lowers the price and gives Claude a cleaner starting point.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Claude Builds the Case',
    description:
        'Claude pulls the comparables, scores the evidence, maps county workflow requirements, and packages the strongest angle for action. Most AI-built cases are ready within 48 hours.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Launch With a Next Move',
    description:
      'The output is not just a report. It is a customer-ready action package with valuation evidence, property intelligence, filing guidance, and the next operational step already framed.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          How Claude Operates
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          Three Steps to an AI-Run Workflow
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-12 md:gap-8 lg:gap-12">
        {steps.map((step, i) => (
          <div
            key={step.number}
            className="relative group"
            data-animate={i % 2 === 0 ? 'slide-left' : 'slide-right'}
            data-delay={String((i + 1) * 200)}
          >
            {/* Connector line — behind content, clipped to gap between cards */}
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-10 left-[calc(100%-8px)] w-[calc(100%-56px)] h-px bg-gradient-to-r from-gold/30 via-gold/15 to-transparent -z-10" />
            )}

            <div className="flex items-center gap-4 mb-6">
              <div
                className="flex items-center justify-center w-14 h-14 rounded-2xl border border-gold/20 bg-gold/[0.06] text-gold/80 transition-all duration-300 group-hover:border-gold/40 group-hover:bg-gold/[0.1] group-hover:shadow-[0_0_20px_rgba(212,168,71,0.1)]"
              >
                {step.icon}
              </div>
              <span className="font-display text-5xl text-cream/[0.06] select-none">{step.number}</span>
            </div>

            <h3 className="font-display text-lg text-cream mb-2">{step.title}</h3>
            <p className="text-[13px] text-cream/40 leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
