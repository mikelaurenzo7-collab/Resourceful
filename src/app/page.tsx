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
  title: 'RESOURCEFUL | Property Tax Appeal Evidence and Filing Support',
  description:
    'Review your property assessment, organize comparable sales and condition evidence, and understand the next filing step with an AI-assisted, human-controlled workflow.',
});

const trustSignals = [
  {
    title: 'Evidence first',
    description: 'Property facts, comparable sales, and condition evidence stay source-labeled and reviewable.',
  },
  {
    title: 'Clear service scope',
    description: 'Analysis, filing support, representation, and regulated appraisal work remain clearly separated.',
  },
  {
    title: 'Human reviewed',
    description: 'Unknowns are flagged, calculations stay visible, and every paid case is reviewed before delivery.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <ScrollAnimations />
      <ServiceJsonLd />
      <FAQJsonLd />

      <nav
        className="fixed inset-x-0 top-0 z-50 border-b border-cream/[0.06] bg-navy-deep/92 backdrop-blur-xl"
        aria-label="Primary navigation"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 md:h-20">
          <Link
            href="/"
            className="shrink-0 rounded-md font-display text-lg text-cream transition-colors hover:text-gold-light focus:outline-none focus:ring-2 focus:ring-gold/50 sm:text-xl"
            aria-label="RESOURCEFUL home"
          >
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="rounded-md px-2.5 py-2 text-xs text-cream/70 transition-colors hover:text-cream focus:outline-none focus:ring-2 focus:ring-gold/50 sm:px-3 sm:text-sm"
            >
              Sign in
            </Link>
            <Link
              href="/start"
              className="whitespace-nowrap rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-3.5 py-2 text-xs font-semibold text-navy-deep transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-navy-deep sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Review my property
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <Hero />

        <section className="relative border-y border-cream/[0.05]" aria-label="Service principles" data-animate>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-gold/[0.025] to-transparent" />
          <div className="relative mx-auto grid max-w-6xl gap-7 px-6 py-10 md:grid-cols-3 md:gap-10 md:py-12">
            {trustSignals.map((signal, index) => (
              <article
                key={signal.title}
                className="mx-auto max-w-sm text-center"
                data-animate
                data-delay={String((index + 1) * 100)}
              >
                <h2 className="font-display text-lg text-cream">{signal.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-cream/52">{signal.description}</p>
              </article>
            ))}
          </div>
        </section>

        <ServiceCards />
        <HowItWorks />

        <div className="mx-auto max-w-6xl px-6" aria-hidden="true">
          <div className="divider-glow" />
        </div>

        <SampleReport />

        <div className="mx-auto max-w-6xl px-6" aria-hidden="true">
          <div className="divider-glow" />
        </div>

        <PropertyIntelligence />

        <div className="mx-auto max-w-6xl px-6" aria-hidden="true">
          <div className="divider-glow" />
        </div>

        <Testimonials />

        <div className="mx-auto max-w-6xl px-6" aria-hidden="true">
          <div className="divider-glow" />
        </div>

        <PricingTable />

        <div className="mx-auto max-w-6xl px-6" aria-hidden="true">
          <div className="divider-glow" />
        </div>

        <FAQ />

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20" data-animate>
          <div className="card-elevated relative overflow-hidden rounded-2xl px-6 py-10 text-center sm:px-10 sm:py-14 md:px-16 md:py-16">
            <div className="pointer-events-none absolute left-1/2 top-0 h-[280px] w-[min(700px,120vw)] -translate-x-1/2 rounded-full bg-gold/[0.04] blur-[120px]" />
            <h2 className="text-glow-gold relative font-display text-3xl leading-tight tracking-tight text-cream md:text-5xl">
              Start with the assessment, not a sales pitch
            </h2>
            <p className="relative mx-auto mt-5 max-w-2xl text-base leading-relaxed text-cream/52 md:text-lg">
              Enter the property address, review the available public record, and see what is still needed before choosing a paid service.
            </p>
            <Link
              href="/start"
              className="btn-glow relative mt-8 inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-gold-light via-gold to-gold-dark px-7 py-3.5 text-sm font-semibold text-navy-deep shadow-gold transition-all hover:brightness-110 sm:mt-10 sm:px-10 sm:py-4 sm:text-base"
            >
              Review my property
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m17 8 4 4m0 0-4 4m4-4H3" />
              </svg>
            </Link>
            <p className="relative mx-auto mt-5 max-w-2xl text-xs leading-relaxed text-cream/35">
              Screening does not guarantee appeal eligibility, filing acceptance, a reduced assessment, or tax savings. Rules and deadlines vary by jurisdiction.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
