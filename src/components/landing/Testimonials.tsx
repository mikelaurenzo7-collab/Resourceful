const proofPoints = [
  {
    title: 'Source-labeled evidence',
    description:
      'Property facts, comparable sales, assessment records, and jurisdiction rules are presented with their source and review status so customers can verify what supports the case.',
    detail: 'No anonymous estimates presented as fact',
  },
  {
    title: 'Jurisdiction readiness gate',
    description:
      'A tax-appeal package is only represented as filing-ready when the applicable authority, deadline rule, required documents, and filing steps have been verified for the jurisdiction.',
    detail: 'Unknown rules fail closed',
  },
  {
    title: 'Human-controlled conclusions',
    description:
      'AI assists with research, organization, and drafting. Material valuation conclusions, filing decisions, and regulated professional work remain subject to the appropriate human review.',
    detail: 'Automation supports judgment; it does not replace it',
  },
  {
    title: 'Outcome accountability',
    description:
      'Each completed case is designed to capture filing proof, hearing status, the final decision, granted value, savings, and the reason for the result instead of stopping at report delivery.',
    detail: 'The workflow ends with a recorded outcome',
  },
];

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24" aria-labelledby="proof-heading">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          Proof Before Promotion
        </span>
        <h2 id="proof-heading" className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          Trust the evidence trail, not a marketing claim
        </h2>
        <p className="mt-4 text-cream/45 max-w-2xl mx-auto leading-relaxed">
          Resourceful does not publish invented testimonials or imply guaranteed savings. Confidence should come from traceable evidence, clear service boundaries, and a reviewable process.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {proofPoints.map((item, index) => (
          <article
            key={item.title}
            data-animate
            data-delay={String((index + 1) * 100)}
            className="card-premium rounded-xl p-7"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-gold/[0.07] text-gold/80">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="m9 12 2 2 4-4m5.6-4A12 12 0 0 1 12 3a12 12 0 0 1-8.6 3A12 12 0 0 0 3 9c0 5.6 3.8 10.3 9 11.6 5.2-1.3 9-6 9-11.6 0-1-.1-2-.4-3Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-display text-lg text-cream">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream/60">{item.description}</p>
                <p className="mt-4 border-t border-gold/10 pt-3 text-xs font-medium text-gold/70">
                  {item.detail}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
