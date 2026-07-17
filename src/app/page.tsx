import Hero from '@/components/landing/Hero';
import ServiceCards from '@/components/landing/ServiceCards';
import HowItWorks from '@/components/landing/HowItWorks';
import PropertyIntelligence from '@/components/landing/PropertyIntelligence';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';
import PricingTable from '@/components/landing/PricingTable';
import Testimonials from '@/components/landing/Testimonials';
import SampleReport from '@/components/landing/SampleReport';
import { ServiceJsonLd, FAQJsonLd } from '@/components/seo/JsonLd';
import { ScrollAnimations } from '@/components/ui/ScrollAnimations';
import Link from 'next/link';
import Wordmark from '@/components/ui/Wordmark';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Resourceful | Property Tax Appeal Evidence and Filing Support',
  description:
    'Review your property assessment, organize comparable sales and condition evidence, and understand the next filing step with an AI-assisted, human-controlled workflow.',
});

const trustSignals = [
  {
    title: 'Evidence first',
    description: 'Property facts, comparable sales, and condition evidence stay source-labeled and reviewable.',
  },
  {
    title: 'Scope made clear',
    description: 'Analysis, guided filing, representation, and regulated appraisal work are never presented as the same service.',
  },
  {
    title: 'Unknowns fail closed',
    description: 'Unverified deadlines, authority, or filing rules are flagged instead of guessed.',
  },
];

const operatingStandards = [
  {
    title: 'Traceable sources',
    description: 'Material evidence identifies where it came from and what still needs verification.',
  },
  {
    title: 'Reviewable calculations',
    description: 'Valuation logic and adjustments remain visible rather than hidden behind a score.',
  },
  {
    title: 'Jurisdiction controls',
    description: 'Filing guidance is tied to the applicable authority, deadline rule, and required documents.',
  },
  {
    title: 'Recorded outcomes',
    description: 'The workflow is designed to capture filing proof, decisions, granted values, and reasons.',
  },
];

const commitments = [
  {
    title: 'No fabricated proof',
    description: 'Customer stories, savings claims, and professional credentials are published only when verified and authorized.',
  },
  {
    title: 'No hidden service boundary',
    description: 'Customers can see what is included, what they remain responsible for, and what requires a separate engagement.',
  },
  {
    title: 'No guaranteed outcome language',
    description: 'Assessment authorities decide each matter independently; Resourceful strengthens the evidence and the process, not the promise.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <ScrollAnimations />
      <ServiceJsonLd />
      <FAQJsonLd />

      <nav
        className="fixed top-0 left-0 right-0 z-50 bg-navy-deep/90 backdrop-blur-xl border-b border-cream/[0.04]"
        aria-label="Primary navigation"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="font-display text-lg sm:text-xl text-cream hover:text-gold-light transition-colors shrink-0">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/login"
              className="hidden sm:block text-sm text-cream/70 hover:text-cream transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2 focus:ring-offset-navy-deep rounded-md px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/start"
              className="text-xs sm:text-sm font-medium text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg hover:shadow-gold hover:brightness-110 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-navy-deep whitespace-nowrap"
            >
              Review my property
            </Link>
          </div>
        </div>
      </nav>

      <Hero />

      <section className="relative border-y border-cream/[0.04]" aria-label="Service principles" data-animate>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/[0.02] to-transparent pointer-events-none" />
        <div className="relative mx-auto grid max-w-6xl gap-6 px-6 py-10 md:grid-cols-3 md:gap-8">
          {trustSignals.map((signal, index) => (
            <div key={signal.title} className="text-center md:text-left" data-animate data-delay={String((index + 1) * 100)}>
              <p className="font-display text-lg text-cream">{signal.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-cream/50">{signal.description}</p>
            </div>
          ))}
        </div>
      </section>

      <ServiceCards />

      <section className="relative border-y border-cream/[0.04]" aria-labelledby="standards-heading" data-animate>
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
              The Resourceful Standard
            </span>
            <h2 id="standards-heading" className="font-display text-2xl md:text-3xl text-cream mt-3 tracking-tight">
              A property decision should be explainable
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-cream/45">
              Resourceful is built to show what supports the conclusion, what remains uncertain, and which next action is actually authorized.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {operatingStandards.map((item, index) => (
              <div key={item.title} className="text-center group" data-animate data-delay={String(index * 100)}>
                <div className="w-12 h-12 rounded-xl bg-gold/[0.08] border border-gold/[0.12] flex items-center justify-center mx-auto mb-3 transition-all duration-300 group-hover:bg-gold/[0.12] group-hover:border-gold/20">
                  <svg className="w-5 h-5 text-gold/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="m9 12 2 2 4-4m5.6-4A12 12 0 0 1 12 3a12 12 0 0 1-8.6 3A12 12 0 0 0 3 9c0 5.6 3.8 10.3 9 11.6 5.2-1.3 9-6 9-11.6 0-1-.1-2-.4-3Z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-cream">{item.title}</p>
                <p className="text-xs leading-relaxed text-cream/55 mt-1">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />

      <div className="mx-auto max-w-6xl px-6">
        <div className="divider-glow" />
      </div>

      <SampleReport />

      <div className="mx-auto max-w-6xl px-6">
        <div className="divider-glow" />
      </div>

      <PropertyIntelligence />

      <div className="mx-auto max-w-6xl px-6">
        <div className="divider-glow" />
      </div>

      <Testimonials />

      <div className="mx-auto max-w-6xl px-6">
        <div className="divider-glow" />
      </div>

      <PricingTable />

      <div className="mx-auto max-w-6xl px-6">
        <div className="divider-glow" />
      </div>

      <FAQ />

      <section className="mx-auto max-w-6xl px-6 py-20" aria-labelledby="commitments-heading" data-animate>
        <div className="mb-12 text-center">
          <span className="text-[11px] font-semibold tracking-[0.2em] text-gold/70 uppercase">
            Customer Commitments
          </span>
          <h2 id="commitments-heading" className="font-display text-2xl md:text-3xl text-cream mt-3 tracking-tight">
            Trust is part of the product
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {commitments.map((item, index) => (
            <article key={item.title} className="card-premium rounded-xl p-8 text-center group" data-animate data-delay={String((index + 1) * 100)}>
              <div className="w-12 h-12 rounded-xl bg-gold/[0.08] border border-gold/15 flex items-center justify-center mx-auto mb-5">
                <svg className="w-5 h-5 text-gold/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z" />
                </svg>
              </div>
              <h3 className="font-display text-lg text-cream mb-2">{item.title}</h3>
              <p className="text-sm text-cream/50 leading-relaxed">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24" data-animate>
        <div className="relative card-elevated rounded-2xl p-10 md:p-16 text-center overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gold/[0.04] rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-gold/[0.02] rounded-full blur-[80px] pointer-events-none" />

          <h2 className="relative font-display text-3xl md:text-5xl text-cream leading-tight tracking-tight text-glow-gold">
            Start with the assessment, not a sales pitch
          </h2>
          <p className="relative mt-5 text-cream/50 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            Enter the property address, review the available public record, and see what information is still needed before choosing a paid service.
          </p>
          <Link
            href="/start"
            className="relative mt-10 inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-gold-light via-gold to-gold-dark px-10 py-4 text-base font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.03] hover:brightness-110 btn-glow"
          >
            Review my property
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m17 8 4 4m0 0-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="relative mx-auto mt-5 max-w-2xl text-xs leading-relaxed text-cream/35">
            Screening does not guarantee appeal eligibility, filing acceptance, a reduced assessment, or tax savings. Rules and deadlines vary by jurisdiction.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
