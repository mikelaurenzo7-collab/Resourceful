const steps = [
  {
    number: '01',
    title: 'Enter Your Address',
    description:
      'We instantly pull your current assessment, tax rate, and property details. You\'ll see your estimated savings before paying a cent.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Upload Photos',
    description:
      'Follow our guided checklist to photograph your property. Our AI analyzes condition, identifies issues the assessor missed, and documents deferred maintenance.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Receive Your Report',
    description:
      'Within 48 hours, receive a professional PDF report with comparable sales, valuation analysis, and step-by-step filing instructions for your county.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center mb-16">
        <span className="text-sm font-medium tracking-widest text-gold uppercase">
          How It Works
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3">
          Three Steps to Lower Taxes
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-12">
        {steps.map((step, i) => (
          <div key={step.number} className="relative">
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-10 left-full w-full h-px bg-gradient-to-r from-gold/30 to-transparent -translate-x-6" />
            )}

            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center justify-center w-14 h-14 rounded-full border border-gold/30 bg-gold/5 text-gold">
                {step.icon}
              </div>
              <span className="font-display text-4xl text-gold/20">{step.number}</span>
            </div>

            <h3 className="font-display text-xl text-cream mb-3">{step.title}</h3>
            <p className="text-sm text-cream/50 leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
