import Hero from '@/components/landing/Hero';
import ComparisonSection from '@/components/landing/ComparisonSection';
import HowItWorks from '@/components/landing/HowItWorks';
import WhatYouGet from '@/components/landing/WhatYouGet';
import SavingsHighlight from '@/components/landing/SavingsHighlight';
import Testimonials from '@/components/landing/Testimonials';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';
import { ServiceJsonLd, FAQJsonLd } from '@/components/seo/JsonLd';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <ServiceJsonLd />
      <FAQJsonLd />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gold/5 bg-navy-deep/80 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
          <Link href="/" className="font-display text-xl text-gold">
            Resourceful
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-cream/50 hover:text-cream transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/start"
              className="text-sm font-medium text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark px-5 py-2 rounded-lg hover:shadow-gold transition-all duration-200"
            >
              Get My Report
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <Hero />

      {/* Social proof bar */}
      <section className="border-y border-gold/10 bg-navy/30">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl text-cream">Over 50%</p>
              <p className="text-xs text-cream/40">of properties are over-assessed</p>
            </div>
          </div>
          <div className="hidden md:block h-8 w-px bg-gold/10" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl text-cream">Expert-Reviewed</p>
              <p className="text-xs text-cream/40">every report checked before delivery</p>
            </div>
          </div>
          <div className="hidden md:block h-8 w-px bg-gold/10" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl text-cream">1&ndash;2 Days</p>
              <p className="text-xs text-cream/40">report turnaround</p>
            </div>
          </div>
        </div>
      </section>

      {/* The problem — emotional hook */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="font-display text-3xl md:text-4xl text-cream leading-snug text-balance">
          Counties Make Mistakes.{' '}
          <span className="text-cream/40">You Pay for Them.</span>
        </h2>
        <p className="mt-6 text-cream/50 max-w-2xl mx-auto text-lg leading-relaxed">
          Property assessments are mass-produced estimates, not precision appraisals.
          They miss condition issues, use outdated data, and routinely overvalue properties.
          The result? Millions of homeowners quietly overpay every single year.
        </p>
        <p className="mt-4 text-gold font-medium text-lg">
          An appeal puts the evidence in your hands to fix it.
        </p>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>

      {/* How it works */}
      <HowItWorks />

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>

      {/* What you get */}
      <WhatYouGet />

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>

      {/* Comparison */}
      <ComparisonSection />

      {/* Savings highlight */}
      <SavingsHighlight />

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>

      {/* Testimonials + Money-back guarantee */}
      <Testimonials />

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>

      {/* FAQ */}
      <FAQ />

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="card-premium rounded-2xl p-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-cream">
            Ready to Stop Overpaying?
          </h2>
          <p className="mt-4 text-cream/50 max-w-lg mx-auto">
            Your filing deadline isn&rsquo;t tomorrow &mdash; but every day you wait is another day overpaying.
            Enter your address, get your report in 1&ndash;2 days, and file when you&rsquo;re ready.
          </p>
          <Link
            href="/start"
            className="mt-8 inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
          >
            Get My Report
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="mt-4 text-sm text-cream/30">
            From $59 &middot; Expert-reviewed &middot; Money-back guarantee
          </p>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
