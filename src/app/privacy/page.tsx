import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Resourceful',
  description:
    'Privacy Policy for Resourceful. Learn how we collect, use, and protect your personal information when you use our property tax appeal and analysis services.',
  openGraph: {
    title: 'Privacy Policy | Resourceful',
    description: 'How Resourceful collects, uses, and protects your personal information.',
    type: 'website',
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-pattern">
      {/* Nav */}
      <nav className="border-b border-gold/5 bg-navy-deep/80 backdrop-blur-lg">
        <div className="mx-auto max-w-4xl px-6 flex items-center justify-between h-16">
          <Link href="/" className="font-display text-xl text-gold">
            Resourceful
          </Link>
          <Link href="/" className="text-sm text-cream/50 hover:text-cream transition-colors">
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl md:text-4xl text-cream mb-2">Privacy Policy</h1>
        <p className="text-sm text-cream/30 mb-12">Last updated: March 17, 2026</p>

        <div className="prose-legal space-y-10 text-sm text-cream/60 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">1. Information We Collect</h2>
            <p>We collect the following categories of information:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-cream/80">Contact information:</strong> Email address and optional name
                provided during checkout.
              </li>
              <li>
                <strong className="text-cream/80">Property information:</strong> Street address, city, state,
                county, and property type that you enter to generate your report.
              </li>
              <li>
                <strong className="text-cream/80">Property condition details:</strong> Issues you select (e.g.,
                roof damage, foundation cracks), additional notes, and desired outcome.
              </li>
              <li>
                <strong className="text-cream/80">Photographs:</strong> Property photos you choose to upload.
              </li>
              <li>
                <strong className="text-cream/80">Payment information:</strong> Processed securely by Stripe.
                We do not store credit card numbers, CVVs, or full card details on our servers.
              </li>
              <li>
                <strong className="text-cream/80">Usage data:</strong> Standard web analytics including pages
                visited, browser type, and referring URL.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-cream/80">Report generation:</strong> Your property address and
                condition details are used to pull public property records, comparable sales, and assessment data
                to generate your Report.
              </li>
              <li>
                <strong className="text-cream/80">Report delivery:</strong> Your email address is used to send
                your completed Report and any related communications.
              </li>
              <li>
                <strong className="text-cream/80">Report analysis:</strong> Property data and photos are processed
                by our analysis system to generate valuation analysis and narrative content.
                Your data is not used to train machine learning models.
              </li>
              <li>
                <strong className="text-cream/80">Payment processing:</strong> Payment data is handled
                exclusively by Stripe under their privacy policy.
              </li>
              <li>
                <strong className="text-cream/80">Service improvement:</strong> Anonymized, aggregated data
                may be used to improve our analysis methodology and service quality.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">3. Third-Party Services</h2>
            <p>We use the following third-party services to operate our platform:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-cream/80">Stripe</strong> — Payment processing. Subject to{' '}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light transition-colors">
                  Stripe&apos;s Privacy Policy
                </a>.
              </li>
              <li>
                <strong className="text-cream/80">Supabase</strong> — Database and file storage. Data is
                encrypted at rest and in transit.
              </li>
              <li>
                <strong className="text-cream/80">ATTOM Data</strong> — Public property records and comparable
                sales data.
              </li>
              <li>
                <strong className="text-cream/80">Google Maps Platform</strong> — Address autocomplete, geocoding,
                and Street View imagery. Subject to{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light transition-colors">
                  Google&apos;s Privacy Policy
                </a>.
              </li>
              <li>
                <strong className="text-cream/80">Anthropic</strong> — Data analysis and report generation.
                Your data is processed per Anthropic&apos;s commercial API terms and is not used for model
                training.
              </li>
              <li>
                <strong className="text-cream/80">Resend</strong> — Transactional email delivery.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">4. Data Retention</h2>
            <p>
              We retain your Report data (property information, photos, generated reports) for 12 months from
              the date of purchase to support warranty claims, refund requests, and customer support. After this
              period, data may be deleted. Payment records are retained as required by applicable tax and
              financial regulations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">5. Data Security</h2>
            <p>
              We implement industry-standard security measures including encryption in transit (TLS/HTTPS),
              encryption at rest for stored data, and Row-Level Security (RLS) on all database tables to ensure
              data isolation. Access to production systems is restricted to authorized personnel.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">6. What We Do Not Do</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>We do not sell your personal information to third parties.</li>
              <li>We do not use your data for targeted advertising.</li>
              <li>We do not share your photos or property details with other users.</li>
              <li>We do not use your data to train machine learning models.</li>
              <li>We do not store credit card details on our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Request a copy of the personal data we hold about you.</li>
              <li>Request deletion of your personal data.</li>
              <li>Correct inaccurate personal data.</li>
              <li>Opt out of marketing communications (we send transactional emails only).</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@resourceful.app" className="text-gold hover:text-gold-light transition-colors">
                privacy@resourceful.app
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">8. Cookies</h2>
            <p>
              We use essential cookies for session management and wizard state persistence. We do not use
              third-party tracking cookies or advertising cookies. Stripe may set cookies as part of their
              fraud detection system.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">9. Children&apos;s Privacy</h2>
            <p>
              Our services are not directed to individuals under 18. We do not knowingly collect personal
              information from children. If you believe a child has provided us with personal information,
              please contact us for deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. Changes will be posted on this page with an
              updated effective date. Continued use of our services after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">11. Contact</h2>
            <p>
              For privacy questions or data requests, contact us at{' '}
              <a href="mailto:privacy@resourceful.app" className="text-gold hover:text-gold-light transition-colors">
                privacy@resourceful.app
              </a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
