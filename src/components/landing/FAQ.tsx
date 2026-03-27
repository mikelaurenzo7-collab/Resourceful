'use client';

import { useState } from 'react';

const faqs = [
  {
    question: 'What is a property tax appeal?',
    answer:
      'A property tax appeal is a formal request to your county\'s Board of Review to lower your property\'s assessed value. If your home is assessed higher than its true market value, you\'re paying more in taxes than you should. An appeal presents evidence — comparable sales, condition documentation, and valuation analysis — to demonstrate the correct value. Successful appeals result in lower assessments and reduced annual tax bills, often saving homeowners hundreds to thousands of dollars per year.',
  },
  {
    question: 'Do I have to file the appeal myself?',
    answer:
      'Not necessarily. With our Full Representation package, we file the appeal on your behalf and attend the hearing as your authorized representative — you don\'t have to do anything. With Guided Filing, we walk you through every step on a live call so you feel fully prepared. And even with our standard Professional Report, you get a step-by-step filing guide tailored to your county. Property tax appeals are one of the most accessible processes for self-representation — no legal training required.',
  },
  {
    question: 'What makes your report credible to the Board of Review?',
    answer:
      'Our reports follow the same methodology used by professional appraisers: comparable sales analysis with line-item adjustments, assessment ratio calculations, condition documentation with photographs, and clear market value conclusions. The Board of Review evaluates evidence, not credentials. A well-documented report with solid comparable sales is persuasive regardless of who presents it. We use the same data sources (MLS, public records, ATTOM) that assessors rely on.',
  },
  {
    question: 'How long does it take to receive my report?',
    answer:
      'Most reports are delivered within 48 hours of completing your submission (address, photos, and payment). Complex commercial or industrial properties may take up to 72 hours. You\'ll receive an email notification when your report is ready, and you can download it directly from your dashboard. We recommend starting the process at least 2-3 weeks before your county\'s appeal deadline.',
  },
  {
    question: 'What if I don\'t win my appeal?',
    answer:
      'While we can\'t guarantee outcomes — every Board of Review is different — our reports are built on rigorous appraisal evidence standards. Historically, properties with documented over-assessment and strong comparable sales evidence have a high success rate. Even if the Board doesn\'t adopt your full requested value, partial reductions are common and still result in meaningful tax savings. There is no penalty for filing an appeal that isn\'t granted.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <div className="text-center mb-16">
        <span className="text-sm font-medium tracking-widest text-gold uppercase">
          Common Questions
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="card-premium rounded-xl overflow-hidden transition-all duration-300"
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-6 py-5 text-left"
            >
              <span className="font-medium text-cream pr-4">{faq.question}</span>
              <svg
                className={`w-5 h-5 text-gold flex-shrink-0 transition-transform duration-300 ${
                  openIndex === i ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              className="accordion-content"
              style={{
                maxHeight: openIndex === i ? '500px' : '0',
                opacity: openIndex === i ? 1 : 0,
              }}
            >
              <div className="px-6 pb-5 text-sm text-cream/60 leading-relaxed">
                {faq.answer}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
