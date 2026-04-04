import Hero from '@/components/landing/Hero';
import ServiceCards from '@/components/landing/ServiceCards';
import HowItWorks from '@/components/landing/HowItWorks';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';
import { ServiceJsonLd, FAQJsonLd } from '@/components/seo/JsonLd';
import { ScrollAnimations } from '@/components/ui/ScrollAnimations';
import Link from 'next/link';
import Wordmark from '@/components/ui/Wordmark';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <ScrollAnimations />
      <ServiceJsonLd />
      <FAQJsonLd />
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-deep/80 backdrop-blur-xl nav-shadow">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
          <Link href="/" className="font-display text-xl text-cream hover:text-gold-light transition-colors">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-cream/60 hover:text-cream transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2 focus:ring-offset-navy-deep rounded-md px-2 py-1"
            >
              Sign In
            </Link>
            <Link
              href="/start"
              className="text-sm font-medium text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark px-5 py-2.5 rounded-lg hover:shadow-gold hover:brightness-110 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-navy-deep"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <Hero />

      {/* Social proof bar */}
      <section className="relative bg-navy/40" data-animate>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/[0.03] to-transparent pointer-events-none" />
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-center gap-10 md:gap-12 relative">
          <div className="flex items-center gap-4" data-animate data-delay="100">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl text-cream">Over 50%</p>
              <p className="text-xs text-cream/40">of properties are over-assessed nationwide</p>
            </div>
          </div>
          <div className="hidden md:block h-10 w-px bg-gradient-to-b from-transparent via-gold/15 to-transparent" />
          <div className="flex items-center gap-4" data-animate data-delay="250">
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl text-cream">$800 &ndash; $3,000+</p>
              <p className="text-xs text-cream/40">average annual savings from a successful appeal</p>
            </div>
          </div>
          <div className="hidden md:block h-10 w-px bg-gradient-to-b from-transparent via-gold/15 to-transparent" />
          <div className="flex items-center gap-4" data-animate data-delay="400">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-2xl text-cream">Same Day</p>
              <p className="text-xs text-cream/40">report delivery for most properties</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <ServiceCards />

      {/* Methodology trust bar */}
      <section className="relative bg-navy/30 border-y border-gold/[0.06]" data-animate>
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="text-center mb-10">
            <span className="text-sm font-medium tracking-widest text-gold uppercase">
              Our Methodology
            </span>
            <h2 className="font-display text-2xl md:text-3xl text-cream mt-3">
              The Same Evidence Licensed Appraisers Use
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3', label: 'IAAO Standards', desc: 'International appraisal methodology' },
              { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: '5-10 Comparables', desc: 'Recent arm\'s-length sales' },
              { icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z', label: 'Line-Item Adjustments', desc: 'Size, age, condition, location' },
              { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'Human Reviewed', desc: 'Every report quality-checked' },
            ].map((item, i) => (
              <div key={i} className="text-center" data-animate data-delay={String(i * 100)}>
                <div className="w-12 h-12 rounded-xl bg-gold/[0.08] border border-gold/[0.12] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-gold/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-cream">{item.label}</p>
                <p className="text-xs text-cream/35 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <HowItWorks />

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="divider-glow" />
      </div>

      {/* FAQ */}
      <FAQ />

      {/* Trust & guarantee section */}
      <section className="mx-auto max-w-6xl px-6 py-20" data-animate>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="card-premium rounded-xl p-8 text-center" data-animate data-delay="100">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-display text-lg text-cream mb-2">Satisfaction Guarantee</h3>
            <p className="text-sm text-cream/40 leading-relaxed">
              If your photo-supported appeal is denied in full, send us the denial letter for a complete refund. No questions asked.
            </p>
          </div>
          <div className="card-premium rounded-xl p-8 text-center" data-animate data-delay="200">
            <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-display text-lg text-cream mb-2">Your Data Is Secure</h3>
            <p className="text-sm text-cream/40 leading-relaxed">
              Bank-level encryption. Your photos, tax bills, and personal information are never shared or sold. Delete your data anytime.
            </p>
          </div>
          <div className="card-premium rounded-xl p-8 text-center" data-animate data-delay="300">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </div>
            <h3 className="font-display text-lg text-cream mb-2">Nationwide Coverage</h3>
            <p className="text-sm text-cream/40 leading-relaxed">
              Every county in every state. County-specific filing deadlines, forms, board contacts, and hearing procedures — automatically tailored to your location.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24" data-animate>
        <div className="relative card-elevated rounded-2xl p-12 md:p-20 text-center overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gold/[0.04] rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[150px] bg-gold/[0.03] rounded-full blur-[80px] pointer-events-none" />

          <h2 className="relative font-display text-3xl md:text-5xl text-cream leading-tight">
            Ready to Stop Overpaying?
          </h2>
          <p className="relative mt-5 text-cream/50 max-w-lg mx-auto text-lg leading-relaxed">
            Takes 5 minutes. We pull comparable sales, analyze your property, and build
            your full evidence package. Upload your tax bill to save 15%.
          </p>
          <Link
            href="/start"
            className="relative mt-10 inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-gold-light via-gold to-gold-dark px-10 py-5 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.03] hover:brightness-110 btn-glow animate-glow"
          >
            Get My Property Report
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
