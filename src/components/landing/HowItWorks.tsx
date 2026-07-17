const steps = [
  {
    number: '01',
    title: 'Check the property and the deadline',
    description:
      'Enter the property address and share the assessment notice or tax bill when available. Resourceful checks the records it can verify and identifies the jurisdiction, filing window, and missing inputs.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.7 16.7 13.4 21a2 2 0 0 1-2.8 0l-4.3-4.3a8 8 0 1 1 11.4 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Build and review the evidence',
    description:
      'The workfile organizes property facts, comparable sales, condition evidence, assessment analysis, and source limitations. The selected service level determines the human review applied before delivery.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Take the next supported action',
    description:
      'Receive the analysis, evidence index, limitations, and next-step checklist. Filing or representation is included only when the jurisdiction, authority, scope, and written engagement expressly support it.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2Z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24" aria-labelledby="how-it-works-heading">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          How It Works
        </span>
        <h2 id="how-it-works-heading" className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          From scattered records to a defensible next step
        </h2>
        <p className="mt-4 text-cream/45 max-w-2xl mx-auto leading-relaxed">
          Resourceful is designed to move the case forward without blurring the line between analysis, filing assistance, legal representation, and regulated appraisal work.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-12 md:gap-8 lg:gap-12">
        {steps.map((step, index) => (
          <div
            key={step.number}
            className="relative group"
            data-animate={index % 2 === 0 ? 'slide-left' : 'slide-right'}
            data-delay={String((index + 1) * 200)}
          >
            {index < steps.length - 1 && (
              <div className="hidden md:block absolute top-10 left-[calc(100%-8px)] w-[calc(100%-56px)] h-px bg-gradient-to-r from-gold/30 via-gold/15 to-transparent -z-10" />
            )}

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl border border-gold/20 bg-gold/[0.06] text-gold/80 transition-all duration-300 group-hover:border-gold/40 group-hover:bg-gold/[0.1]">
                {step.icon}
              </div>
              <span className="font-display text-5xl text-cream/[0.06] select-none">{step.number}</span>
            </div>

            <h3 className="font-display text-lg text-cream mb-2">{step.title}</h3>
            <p className="text-sm text-cream/50 leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
