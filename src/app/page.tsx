import Hero from '@/components/landing/Hero';
import ServiceCards from '@/components/landing/ServiceCards';
import HowItWorks from '@/components/landing/HowItWorks';
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
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <Hero />

      {/* Social proof bar */}
      <section className="border-y border-gold/10 bg-navy/30">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl text-cream">Over 50%</p>
              <p className="text-xs text-cream/40">of properties nationwide are over-assessed</p>
            </div>
          </div>
          <div className="hidden md:block h-8 w-px bg-gold/10" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl text-cream">$800 &ndash; $3,000+</p>
              <p className="text-xs text-cream/40">average annual savings from a successful appeal</p>
            </div>
          </div>
          <div className="hidden md:block h-8 w-px bg-gold/10" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl text-cream">Minutes</p>
              <p className="text-xs text-cream/40">auto-report delivery time</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <ServiceCards />

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

      {/* FAQ */}
      <FAQ />

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="card-premium rounded-2xl p-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-cream">
            Ready to Stop Overpaying?
          </h2>
          <p className="mt-4 text-cream/50 max-w-lg mx-auto">
            Enter your address and let us run the numbers. Upload your tax bill to save 15% on your report.
          </p>
          <Link
            href="/start"
            className="mt-8 inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
          >
            Check My Property
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
