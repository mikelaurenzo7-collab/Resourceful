const deliverables = [
  {
    title: 'Comparable Sales Analysis',
    description:
      '5+ recently sold properties in your area, with line-item adjustments for size, condition, and features — the same evidence appraisers present.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
  {
    title: 'Market Value Conclusion',
    description:
      'A defensible market value estimate based on real sales data — not the county\'s numbers. This is the figure you present to the appeal board.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'County Filing Guide',
    description:
      'Step-by-step instructions specific to your county — which form to file, where to send it, what deadlines to hit, and what to expect at the hearing.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Professional PDF Report',
    description:
      'A polished, print-ready document you attach to your appeal filing. Formatted for credibility — because presentation matters at the Board of Review.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Assessment Ratio Analysis',
    description:
      'We calculate whether your assessment is equitable compared to similar properties. Inequity is one of the strongest grounds for a successful appeal.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    title: 'Expert Review',
    description:
      'Every report is reviewed by our team before it reaches you. We check the data, verify the comps, and ensure your case is as strong as possible.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

export default function WhatYouGet() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center mb-16">
        <span className="text-sm font-medium tracking-widest text-gold uppercase">
          What&rsquo;s Included
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3 text-balance">
          Everything You Need to Win Your Appeal
        </h2>
        <p className="mt-4 text-cream/50 max-w-lg mx-auto">
          The same quality of evidence that tax attorneys and professional appraisers present —
          prepared for you, reviewed by experts.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {deliverables.map((item) => (
          <div
            key={item.title}
            className="card-premium rounded-xl p-6 transition-all duration-300 hover:border-gold/40"
          >
            <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-gold/10 text-gold mb-4">
              {item.icon}
            </div>
            <h3 className="font-display text-lg text-cream mb-2">{item.title}</h3>
            <p className="text-sm text-cream/50 leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
