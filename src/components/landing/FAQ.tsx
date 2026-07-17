'use client';

import { useState } from 'react';

const faqs = [
  {
    question: 'What does Resourceful help me decide?',
    answer:
      'Resourceful helps you understand whether the available evidence supports challenging an assessment, evaluating a purchase, or preparing a listing. The analysis organizes property records, relevant comparable sales, condition evidence, tax and assessment context, source limitations, and the next supported action.',
  },
  {
    question: 'What do I receive with a tax-appeal case?',
    answer:
      'The package may include a property and assessment summary, comparable-sales analysis, adjustment support, condition evidence, an evidence index, the requested-value rationale, jurisdiction-specific filing guidance, and clear limitations. The exact contents depend on the property, available data, jurisdiction, and service level selected.',
  },
  {
    question: 'Does Resourceful file or represent me?',
    answer:
      'Not by default. Case Analysis and Expert Review are analysis services, and Guided Filing supports you while you remain responsible for the filing. Filing, representation, or attorney services are offered only when the jurisdiction permits the arrangement, the appropriate professional is available, authorization requirements are satisfied, and a separate written engagement expressly includes that work.',
  },
  {
    question: 'Is this a licensed appraisal or legal advice?',
    answer:
      'No. A standard Resourceful work product is an AI-assisted property analysis, not legal advice, a certified appraisal, a lender appraisal, or a USPAP appraisal. A regulated appraisal or legal service is provided only when a separately engaged, appropriately credentialed professional reviews, signs, and assumes responsibility for that work.',
  },
  {
    question: 'How is AI used?',
    answer:
      'AI assists with extraction, research organization, comparable screening, drafting, and workflow support. It does not create filing authority, guarantee an outcome, replace required professional judgment, or turn an unsigned analysis into a licensed appraisal. Material conclusions and customer-facing work remain subject to the review controls stated for the selected service.',
  },
  {
    question: 'How long does delivery take?',
    answer:
      'The checkout experience shows the delivery target for the selected package. Timing begins after required information, payment, and usable documents are received. Complex, commercial, data-limited, or professionally reviewed assignments may take longer, and Resourceful should surface any material delay rather than silently lowering the scope.',
  },
  {
    question: 'Can you guarantee a reduction or tax savings?',
    answer:
      'No. Assessment authorities decide each matter independently, and the same evidence can lead to different results. Resourceful does not guarantee eligibility, acceptance, a lower assessment, tax savings, or a favorable hearing result. Any refund protection applies only under the written conditions shown in the Terms of Service.',
  },
  {
    question: 'Can filing an appeal increase my assessment?',
    answer:
      'That risk depends on the jurisdiction and the facts. Resourceful will not claim that an assessment can never increase. Confirm the applicable review authority, scope of review, deadline, and local rules before filing; seek qualified local advice when the consequences are unclear.',
  },
  {
    question: 'Where does the property data come from?',
    answer:
      'Resourceful uses available public records and approved third-party or licensed sources. Data quality and coverage vary by location. Important facts, comparable sales, deadlines, and filing requirements should be source-labeled and independently reviewable rather than presented as certain when the source is missing or stale.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mx-auto max-w-3xl px-6 py-24" aria-labelledby="faq-heading">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          Clear Answers
        </span>
        <h2 id="faq-heading" className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          Understand the service before you buy
        </h2>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <div
            key={faq.question}
            data-animate
            data-delay={String((index + 1) * 75)}
            className={`card-premium rounded-xl overflow-hidden transition-all duration-300 ${
              openIndex === index
                ? 'border-l-2 border-l-gold/50 shadow-[0_0_20px_rgba(212,168,71,0.06)]'
                : 'border-l-2 border-l-transparent hover:border-l-gold/20'
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              aria-expanded={openIndex === index}
              aria-controls={`faq-answer-${index}`}
              id={`faq-question-${index}`}
              className="w-full flex items-center justify-between px-6 py-5 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gold/50 rounded-xl"
            >
              <span className="font-medium text-cream pr-4">{faq.question}</span>
              <svg
                className={`w-5 h-5 text-gold flex-shrink-0 transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  openIndex === index ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
              </svg>
            </button>

            <div
              id={`faq-answer-${index}`}
              role="region"
              aria-labelledby={`faq-question-${index}`}
              className="accordion-content"
              style={{
                maxHeight: openIndex === index ? '900px' : '0',
                opacity: openIndex === index ? 1 : 0,
                transition: 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-out',
              }}
            >
              <div className="px-6 pb-5 text-sm text-cream/70 leading-relaxed">
                {faq.answer}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
