import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | Resourceful',
  description:
    'Terms of Service for Resourceful property tax appeal reports. Read our terms covering report delivery, money-back guarantee, refund policy, and usage guidelines.',
  openGraph: {
    title: 'Terms of Service | Resourceful',
    description: 'Terms governing the use of Resourceful property tax appeal reports and related services.',
    type: 'website',
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-pattern">
      {/* Nav */}
      <nav className="bg-navy-deep/80 backdrop-blur-xl nav-shadow">
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
        <h1 className="font-display text-3xl md:text-4xl text-cream mb-2">Terms of Service</h1>
        <p className="text-sm text-cream/30 mb-12">Last updated: March 17, 2026</p>

        <div className="prose-legal space-y-10 text-sm text-cream/60 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">1. Overview</h2>
            <p>
              Resourceful (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) provides data-driven property analysis
              reports, including property tax appeal reports, pre-purchase analyses, and pre-listing reports
              (collectively, &quot;Reports&quot;). By purchasing or using a Report, you (&quot;you,&quot;
              &quot;client,&quot; &quot;user&quot;) agree to these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">2. Nature of Services</h2>
            <p>
              <strong className="text-cream/80">Reports are informational tools, not legal advice.</strong> Our
              Reports compile publicly available property data, comparable sales, and professional analysis to
              support your independent decision-making. We are not a law firm, we do not practice law, and
              nothing in our Reports or communications constitutes legal advice or creates an attorney-client
              relationship.
            </p>
            <p className="mt-3">
              Tax appeal reports are designed to support &quot;pro se&quot; (self-represented) filings. You are
              responsible for filing your own appeal, attending any hearings, and making all decisions regarding
              your property tax assessment. We recommend consulting a licensed attorney or tax professional if
              you have questions about the legal process in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">3. No Guarantee of Outcome</h2>
            <p>
              We do not guarantee any specific result from using our Reports, including but not limited to
              reductions in assessed value, lower property taxes, or favorable hearing outcomes. Every
              jurisdiction&apos;s Board of Review or Assessment Appeals Board operates independently and may
              reach different conclusions based on the same evidence. Past results do not guarantee future
              outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">4. Money-Back Guarantee</h2>
            <p>
              For tax appeal reports where the client has submitted property photographs (&quot;photo-supported
              reports&quot;), we offer a money-back guarantee under the following conditions:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                You must file the appeal with your county&apos;s Board of Review or equivalent body using our
                Report as evidence.
              </li>
              <li>
                Your appeal must be denied in full (no reduction granted whatsoever).
              </li>
              <li>
                You must provide documentation of the denial (e.g., a copy of the Board&apos;s decision letter)
                within 30 days of the decision.
              </li>
              <li>
                Reports purchased without photo submissions (&quot;data-only reports&quot;) are not eligible for
                the money-back guarantee.
              </li>
              <li>
                Pre-purchase and pre-listing reports are not eligible for the money-back guarantee.
              </li>
            </ul>
            <p className="mt-3">
              Refund requests should be submitted via email with the denial documentation attached.
              Refunds are processed within 10 business days of approval.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">5. Payment and Delivery</h2>
            <p>
              Payment is collected at the time of order. Reports are generated automatically and delivered to the
              email address you provide. Typical delivery time is within a few hours, though complex properties
              may take longer. All sales are final except as provided under the Money-Back Guarantee (Section 4).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">6. Data Accuracy</h2>
            <p>
              Our Reports use data from public records, the ATTOM Data API, and other third-party sources. While
              we strive for accuracy, we do not warrant that all data is complete, current, or error-free. You
              should independently verify property data, comparable sales, and assessment values before relying
              on them for legal filings. We are not responsible for errors in third-party data sources.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">7. Photographs and User-Submitted Content</h2>
            <p>
              By uploading photographs or other content, you represent that you have the right to share that
              content and grant us a limited license to use it solely for the purpose of generating your Report.
              We do not sell or distribute your photographs. Photos are stored securely and retained for the
              period necessary to generate and support your Report.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">8. Intellectual Property</h2>
            <p>
              You receive a personal, non-transferable license to use your Report for its intended purpose
              (e.g., filing a tax appeal, evaluating a property). You may not resell, redistribute, or
              commercially repurpose Reports. The report format, methodology, and analysis remain our
              intellectual property.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Resourceful shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages arising from or related to your
              use of our Reports, including but not limited to failed appeals, missed deadlines, inaccurate
              data, or decisions made based on Report content. Our total liability shall not exceed the amount
              you paid for the specific Report in question.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">10. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Resourceful, its officers, employees, and agents from any
              claims, damages, losses, or expenses arising from your use of our Reports, your filing of any
              appeal or legal proceeding, or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">11. Filing Deadlines</h2>
            <p>
              Our Reports include county-specific filing deadline information to the best of our knowledge.
              However, <strong className="text-cream/80">you are solely responsible for confirming and meeting
              all applicable deadlines</strong> with your county&apos;s Board of Review or equivalent body. We
              are not liable for missed deadlines or expired filing windows.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">12. Modifications</h2>
            <p>
              We may update these Terms at any time. Changes take effect upon posting. Continued use of our
              services after changes constitutes acceptance of the updated Terms. We recommend reviewing this
              page periodically.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">13. Contact</h2>
            <p>
              For questions about these Terms, refund requests, or other inquiries, contact us at{' '}
              <a href="mailto:support@resourceful.app" className="text-gold hover:text-gold-light transition-colors">
                support@resourceful.app
              </a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
