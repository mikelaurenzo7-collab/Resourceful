import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | Resourceful',
  description:
    'Terms governing Resourceful property analysis, expert review, guided filing support, payments, delivery, refund protection, and customer responsibilities.',
  openGraph: {
    title: 'Terms of Service | Resourceful',
    description: 'Terms governing Resourceful property analysis and related support services.',
    type: 'website',
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-pattern">
      <nav className="bg-navy-deep/80 backdrop-blur-xl nav-shadow" aria-label="Legal page navigation">
        <div className="mx-auto max-w-4xl px-6 flex items-center justify-between h-16">
          <Link href="/" className="font-display text-xl text-gold">
            Resourceful
          </Link>
          <Link href="/" className="text-sm text-cream/50 hover:text-cream transition-colors">
            Back to home
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl md:text-4xl text-cream mb-2">Terms of Service</h1>
        <p className="text-sm text-cream/30 mb-12">Last updated: July 16, 2026</p>

        <div className="prose-legal space-y-10 text-sm text-cream/60 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">1. Agreement and scope</h2>
            <p>
              Resourceful (&quot;Resourceful,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides
              AI-assisted property analysis and related support services. These Terms apply when you access the
              website, submit property information, purchase a service, receive a work product, or otherwise use
              Resourceful. By doing so, you agree to these Terms and the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">2. Service categories</h2>
            <p>Resourceful may offer the following service categories:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong className="text-cream/80">Case Analysis:</strong> an informational property work product
                that organizes available records, comparable evidence, condition evidence, assessment context,
                sources, limitations, and suggested next steps.
              </li>
              <li>
                <strong className="text-cream/80">Expert Review:</strong> Case Analysis with the additional review
                described at checkout. The reviewer&apos;s role, credentials, scope, and responsibility are limited
                to what the selected package and written delivery materials expressly state.
              </li>
              <li>
                <strong className="text-cream/80">Guided Filing:</strong> analysis plus a live educational and
                administrative working session. Unless a separate written engagement states otherwise, you remain
                responsible for deciding whether to file, signing and submitting documents, meeting deadlines, and
                appearing at proceedings.
              </li>
              <li>
                <strong className="text-cream/80">Representation or regulated professional services:</strong> these
                are not created merely by selecting an option on the website. They require a separate eligibility
                review, jurisdictional authority, professional availability, any required authorization, and a
                written engagement that identifies the responsible professional and exact scope.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">3. Not legal advice or a certified appraisal</h2>
            <p>
              Unless a separate written engagement expressly states otherwise, Resourceful is not acting as your
              lawyer, tax adviser, fiduciary, authorized representative, or appraiser. Standard work products are
              informational property analyses and are not legal advice, certified appraisals, lender appraisals, or
              USPAP appraisal reports. No attorney-client, fiduciary, appraisal, or other regulated professional
              relationship is created by use of the website or purchase of a standard service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">4. Use of artificial intelligence</h2>
            <p>
              Resourceful may use artificial intelligence to assist with document extraction, research
              organization, comparable screening, calculations, drafting, and workflow support. AI output can be
              incomplete or wrong. AI does not create filing authority, guarantee a result, replace required
              professional judgment, or convert an unsigned analysis into a regulated professional work product.
              The level of human review included in your purchase is the level stated at checkout and in the
              delivered work product.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">5. No guarantee of eligibility or outcome</h2>
            <p>
              Resourceful does not guarantee that an appeal is available, timely, accepted, or advisable; that an
              assessment will decrease; that taxes will decrease; that an assessment cannot increase; or that any
              authority will accept the evidence or conclusion. Assessment authorities operate independently, and
              local rules and the scope of review vary. Past results do not guarantee future outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">6. Your responsibilities</h2>
            <p>You are responsible for:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>providing accurate, complete, and lawfully obtained information and documents;</li>
              <li>reviewing property facts, names, parcel identifiers, dates, values, and calculations;</li>
              <li>confirming current filing deadlines, authorities, forms, fees, signature rules, and procedures;</li>
              <li>deciding whether to rely on or submit a work product;</li>
              <li>obtaining legal, tax, appraisal, or other professional advice when appropriate; and</li>
              <li>preserving copies and proof of any filing, delivery, hearing, or decision.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">7. Data sources and accuracy</h2>
            <p>
              Resourceful may use public records, customer submissions, licensed data, and other third-party
              sources. Coverage, timeliness, and accuracy vary by property and jurisdiction. We do not warrant that
              third-party data is complete, current, or error-free. Source labels, retrieval dates, confidence
              indicators, and limitations are part of the work product and should be reviewed before use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">8. Orders, pricing, and payment</h2>
            <p>
              The price, included service level, delivery target, and any discount are shown before payment. Taxes,
              filing fees, government charges, hearing fees, professional fees, or third-party costs are not
              included unless expressly listed. Resourceful may reject, pause, or refund an order when required
              data is unavailable, the assignment is outside scope, the jurisdiction is unsupported, or a service
              requires a separate engagement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">9. Delivery and scope changes</h2>
            <p>
              Delivery timing begins after payment and receipt of the information reasonably required for the
              selected service. Data-limited, complex, commercial, industrial, agricultural, or professionally
              reviewed assignments may require additional time or a revised scope. Resourceful will not knowingly
              substitute a materially different service without disclosure. If the agreed service cannot be
              delivered, we may offer a revised scope, service credit, or refund as appropriate.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">10. Limited money-back protection</h2>
            <p>
              For eligible photo-supported tax-appeal Case Analysis purchases, Resourceful offers the limited
              refund protection below. This is not a guarantee of outcome. To qualify:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>the order must be identified as eligible for the protection at checkout;</li>
              <li>you must submit usable property photographs before the work product is finalized;</li>
              <li>you must timely file the appeal using the Resourceful work product as supporting evidence;</li>
              <li>the initial review authority must deny the requested reduction in full;</li>
              <li>you must provide filing proof and the complete written decision within 30 days of the decision; and</li>
              <li>the denial must not result from a missed deadline, incomplete filing, inaccurate customer input, failure to appear, settlement, withdrawal, or a material change after delivery.</li>
            </ul>
            <p className="mt-3">
              Pre-purchase, pre-listing, data-only, guided-service, representation, government-fee, and third-party
              professional charges are not covered unless expressly stated. Approved refunds are limited to the
              eligible Resourceful service fee and are processed to the original payment method.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">11. Customer content</h2>
            <p>
              You represent that you have the right to provide photographs, documents, and other content. You grant
              Resourceful a limited license to use that content to provide, secure, support, and improve the ordered
              service. We do not acquire ownership of your content. Retention and deletion are governed by the
              Privacy Policy and applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">12. Intellectual property and permitted use</h2>
            <p>
              Upon payment, you may use the delivered work product for the property decision and related proceeding
              for which it was prepared, subject to these Terms. You may not resell, white-label, systematically
              extract, or commercially redistribute Resourceful work products, templates, methods, or software
              without written permission. Partner rights are governed by the applicable partner agreement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">13. Third-party services</h2>
            <p>
              Resourceful may rely on payment processors, data providers, hosting providers, email providers, map
              or imagery providers, and other third parties. Their services may be unavailable, delayed, or subject
              to separate terms. Resourceful is not responsible for a government body&apos;s portal, decision, delay,
              or change in rules.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">14. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Resourceful will not be liable for indirect, incidental,
              special, consequential, exemplary, or punitive damages; lost savings; lost profits; missed deadlines;
              increased assessments; or decisions by assessment authorities or other third parties. Resourceful&apos;s
              aggregate liability arising from a specific order will not exceed the amount paid to Resourceful for
              that order. Some jurisdictions do not allow certain limitations, so portions of this section may not
              apply to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">15. Indemnification</h2>
            <p>
              To the extent permitted by law, you agree to indemnify and hold Resourceful and its personnel harmless
              from third-party claims arising from unlawful or unauthorized customer content, your material breach
              of these Terms, or your misuse or unauthorized redistribution of a work product.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">16. Changes and severability</h2>
            <p>
              We may update these Terms prospectively. The version in effect when you place an order governs that
              order unless the parties agree otherwise. If any provision is unenforceable, the remaining provisions
              remain in effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">17. Contact</h2>
            <p>
              Questions, scope concerns, and eligible refund requests may be sent to{' '}
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
