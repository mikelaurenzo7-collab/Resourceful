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
      'Our reports are built on the same evidence standards professional appraisers use: comparable sales analysis with line-item adjustments, assessment ratio calculations, and condition documentation with photographs. We use the same data sources that assessors rely on — ATTOM (which powers Zillow and Redfin), MLS records, and county public records. The Board of Review evaluates the quality of evidence presented, and a well-documented report with strong comparable sales data is consistently persuasive.',
  },
  {
    question: 'How long does it take to receive my report?',
    answer:
      'Most reports are delivered within 48 hours of completing your submission (address, photos, and payment). Complex commercial or industrial properties may take up to 72 hours. You\'ll receive an email notification when your report is ready, and you can download it directly from your dashboard. We recommend starting the process at least 2-3 weeks before your county\'s appeal deadline.',
  },
  {
    question: 'What if I don\'t win my appeal?',
    answer:
      'There is no penalty for filing an appeal — your taxes will never go up as a result. While every Board of Review is different, properties with documented over-assessment and strong comparable sales evidence succeed the majority of the time. Even partial reductions are common and result in meaningful savings. If the Board doesn\'t adopt your full requested value, you can refile next year with updated data. Our reports include a satisfaction guarantee — see our Terms of Service for details.',
  },
  {
    question: 'How accurate is your analysis?',
    answer:
      'Our analysis follows IAAO (International Association of Assessing Officers) standards for mass appraisal. We use 5\u201310 comparable sales with line-item adjustments for size, age, condition, and location — the same methodology licensed appraisers use. Comparable sales data comes from ATTOM, which aggregates MLS, county recorder, and public records data nationwide. Our calibration system continuously improves accuracy by comparing our concluded values against actual outcomes.',
  },
  {
    question: 'Can real estate agents use this instead of a CMA?',
    answer:
      'Yes. Our Pre-Listing and Pre-Purchase reports go deeper than a traditional CMA: they include assessment ratio analysis, tax appeal feasibility, condition-based adjustments from photos, and a formal adjustment grid. Agents use these to strengthen listings, substantiate pricing, and address buyer concerns about property taxes. For volume orders or white-label options, reach out to our team.',
  },
  {
    question: 'What happens after I file my appeal?',
    answer:
      'Timelines vary by county. Most counties schedule a hearing within 30\u201390 days of filing. Some offer an informal review first (we\'ll tell you if yours does). At the hearing, you or your representative present the evidence from your report. The board issues a decision, usually within 2\u20134 weeks. If you\'re unsatisfied, most states allow a further appeal to a state-level board. Your report includes all of this detail for your specific county.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <div className="text-center mb-14">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
          Common Questions
        </span>
        <h2 className="font-display text-3xl md:text-4xl text-cream mt-3 tracking-tight">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div
            key={i}
            data-animate
            data-delay={String((i + 1) * 100)}
            className={`card-premium rounded-xl overflow-hidden transition-all duration-300 ${
              openIndex === i ? 'border-l-2 border-l-gold/50 shadow-[0_0_20px_rgba(212,168,71,0.06)]' : 'hover:border-l-2 hover:border-l-gold/20'
            }`}
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              aria-expanded={openIndex === i}
              aria-controls={`faq-answer-${i}`}
              id={`faq-question-${i}`}
              className="w-full flex items-center justify-between px-6 py-5 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gold/50 rounded-xl"
            >
              <span className="font-medium text-cream pr-4">{faq.question}</span>
              <svg
                className={`w-5 h-5 text-gold flex-shrink-0 transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  openIndex === i ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              id={`faq-answer-${i}`}
              role="region"
              aria-labelledby={`faq-question-${i}`}
              className="accordion-content"
              style={{
                maxHeight: openIndex === i ? '800px' : '0',
                opacity: openIndex === i ? 1 : 0,
                transition: 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-out',
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
