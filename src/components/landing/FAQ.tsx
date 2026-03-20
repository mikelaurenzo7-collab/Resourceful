'use client';

import { useState } from 'react';

const faqs = [
  {
    question: 'What is a property tax appeal?',
    answer:
      'A property tax appeal is a formal request to your county\'s Board of Review to lower your property\'s assessed value. If your home is assessed higher than its true market value, you\'re paying more in taxes than you should. An appeal presents evidence — comparable sales, condition documentation, and valuation analysis — to demonstrate the correct value. Successful appeals result in lower assessments and reduced annual tax bills, often saving homeowners hundreds to thousands of dollars per year.',
  },
  {
    question: 'What does "pro se" mean, and do I need an attorney?',
    answer:
      'Pro se means representing yourself without an attorney. Property tax appeals are one of the most accessible legal processes for self-representation. Our reports are specifically designed to give you everything you need to file and argue your own appeal — the same quality of evidence that attorneys and tax consultants present. You fill out a simple form, attach our report, and attend a brief hearing (often virtual). No legal training required.',
  },
  {
    question: 'What makes your report credible to the Board of Review?',
    answer:
      'Our reports follow the same methodology used by professional appraisers and tax attorneys: comparable sales analysis with line-item adjustments, assessment ratio calculations, condition documentation with photographs, and clear market value conclusions. The Board of Review evaluates evidence, not credentials. A well-documented report with solid comparable sales is persuasive regardless of who presents it. We use the same data sources (MLS, public records, ATTOM) that assessors rely on.',
  },
  {
    question: 'How long does it take to receive my report?',
    answer:
      'Most reports are delivered within 48 hours of completing your submission (address, photos, and payment). Complex commercial or industrial properties may take up to 72 hours. You\'ll receive an email notification when your report is ready, and you can download it directly from your dashboard. We recommend starting the process at least 2-3 weeks before your county\'s appeal deadline.',
  },
  {
    question: 'What if I don\'t win my appeal?',
    answer:
      'While we can\'t guarantee outcomes — every Board of Review is different — our reports are built on the same evidence standards that professional tax attorneys use. Historically, properties with documented over-assessment and strong comparable sales evidence have a high success rate. Even if the Board doesn\'t adopt your full requested value, partial reductions are common and still result in meaningful tax savings. There is no penalty for filing an appeal that isn\'t granted.',
  },
  {
    question: 'What does a Pre-Purchase Analysis tell me?',
    answer:
      'A Pre-Purchase Analysis gives you an independent, data-driven fair market value for a property you\'re considering buying — before you\'re committed. It compares the seller\'s asking price against adjusted comparable sales from the actual market, flags red flags like deferred maintenance or flood zone exposure, and delivers a negotiation memo with dollar-specific justification for a lower offer. For investment properties, it also projects NOI, cap rate, and cash-on-cash return at different purchase prices. You\'ll know exactly what the property is worth and what leverage you have.',
  },
  {
    question: 'How does a Pre-Listing Report help me sell for more?',
    answer:
      'A Pre-Listing Report arms you with the same comparable sales data your buyers will bring to the table — so you can set a defensible price instead of guessing. It identifies your property\'s market ceiling, ranks value-add improvements by return on investment so you spend money only where it pays off, and profiles the likely buyer so you can position the listing accordingly. The report also analyzes market timing and absorption rates so you can choose when to list for maximum competition. Sellers who price based on evidence typically receive stronger offers and fewer low-ball counters.',
  },
  {
    question: 'Do you cover commercial and industrial properties?',
    answer:
      'Yes. We cover every property type across all 3,143 U.S. counties — residential single-family, condos, multifamily, commercial office, retail, hotel, industrial warehouse, flex space, self-storage, mixed-use, land, and special-purpose properties. Commercial and industrial reports include an income approach analysis (NOI/cap rate capitalization) alongside the comparable sales analysis. Pricing varies by property type; see the pricing section for details.',
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
