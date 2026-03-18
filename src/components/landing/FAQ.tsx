'use client';

import { useState } from 'react';

const faqs = [
  {
    question: 'How do I know if my property is over-assessed?',
    answer:
      'Over half of all properties in the U.S. are assessed above their actual market value. If your home\'s assessed value is higher than what comparable properties have recently sold for, you\'re likely overpaying. Our report does this exact analysis — we pull recent sales in your area and calculate whether your assessment is fair.',
  },
  {
    question: 'What makes your report credible to the Board of Review?',
    answer:
      'Our reports follow the same methodology used by professional appraisers and tax attorneys: comparable sales analysis with line-item adjustments, assessment ratio calculations, condition documentation, and clear market value conclusions. The Board evaluates evidence, not credentials. Every report is reviewed by our team before delivery to ensure accuracy and completeness.',
  },
  {
    question: 'Do I need an attorney to file an appeal?',
    answer:
      'No. Property tax appeals are one of the most accessible legal processes for self-representation (called "pro se" filing). Our report gives you everything you need — the evidence, the filing instructions for your specific county, and guidance on what to expect at the hearing. Most hearings are brief and straightforward, and many are now conducted virtually.',
  },
  {
    question: 'How long does it take to get my report?',
    answer:
      'Most reports are delivered within 1–2 business days. Every report goes through an expert review before reaching you, which is why we take a little extra time — we\'d rather be thorough than fast. You\'ll receive an email when your report is ready to download.',
  },
  {
    question: 'Can my taxes go up if I file an appeal?',
    answer:
      'No. Filing an appeal cannot increase your assessment. The worst possible outcome is that your assessment stays the same. There is no penalty or fee for filing an appeal. It\'s a risk-free process — which is why it\'s worth doing if you believe your property is over-assessed.',
  },
  {
    question: 'How much can I expect to save?',
    answer:
      'The average successful appeal saves homeowners $800–$1,400 per year, and those savings compound until the next reassessment. On a typical residential property, that can mean $3,000–$7,000+ in savings over a few years. Your report will include a specific estimate based on your property\'s assessment and local market data.',
  },
  {
    question: 'How is this different from hiring an appraiser?',
    answer:
      'A traditional appraisal costs $300–$500, requires an in-person appointment, and takes 1–2 weeks. Our reports use the same data sources (MLS records, public sales data) and the same methodology (comparable sales with adjustments), but we deliver in 1–2 days at a fraction of the cost. The key difference: we also include county-specific filing instructions and hearing guidance — things an appraisal alone doesn\'t cover.',
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
