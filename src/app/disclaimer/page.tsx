import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Disclaimer | Resourceful',
  description:
    'Important limitations and service boundaries for Resourceful property analysis, filing guidance, AI-assisted research, and jurisdiction-specific information.',
  openGraph: {
    title: 'Disclaimer | Resourceful',
    description: 'Important limitations and service boundaries for Resourceful property analysis and support services.',
    type: 'website',
  },
};

export default function DisclaimerPage() {
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
        <h1 className="font-display text-3xl md:text-4xl text-cream mb-2">Disclaimer</h1>
        <p className="text-sm text-cream/30 mb-12">Last updated: July 16, 2026</p>

        <div className="prose-legal space-y-10 text-sm text-cream/60 leading-relaxed">
          <section className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-6">
            <h2 className="text-lg font-semibold text-amber-400 mb-3">Know what you are buying</h2>
            <p>
              Unless a separate written engagement expressly states otherwise, Resourceful provides an
              informational property analysis. It is not legal advice, tax advice, a certified appraisal, a lender
              appraisal, or representation before an assessment authority. The selected checkout package and
              delivered scope control what is included.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">Not legal, tax, or financial advice</h2>
            <p>
              Resourceful is not a law firm and does not create an attorney-client, fiduciary, or tax-adviser
              relationship through the website or a standard purchase. Laws, procedures, risks, and remedies vary
              by jurisdiction. Consult an appropriately qualified local professional when the decision or deadline
              is material, uncertain, or contested.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">Not a certified appraisal</h2>
            <p>
              A standard Resourceful work product is not a certified appraisal or USPAP appraisal report and should
              not be represented as one. Regulated appraisal work is included only when a separately engaged,
              appropriately credentialed appraiser reviews, signs, and assumes responsibility for the defined
              assignment. A comparable-sales grid or professional-looking PDF does not by itself create appraisal
              status.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">Filing and representation boundary</h2>
            <p>
              Case Analysis and Expert Review do not include filing or representation. Guided Filing is educational
              and administrative support while the owner remains responsible for the filing. Representation,
              attorney services, or filing on a customer&apos;s behalf require jurisdictional authority, professional
              availability, executed authorization, and a separate written engagement identifying the responsible
              person and exact scope.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">AI-assisted analysis</h2>
            <p>
              Resourceful may use AI to extract information, organize research, screen comparable sales, perform
              calculations, and draft content. AI can omit facts, misunderstand records, or generate incorrect text
              or arithmetic. AI does not create professional authority or guarantee accuracy. Material facts,
              calculations, deadlines, and conclusions should be reviewed critically before use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">No guaranteed outcome</h2>
            <p>
              Resourceful does not guarantee appeal eligibility, acceptance, a lower assessment, lower taxes, or a
              favorable decision. Filing an appeal may carry different consequences in different jurisdictions,
              including the possibility of broader review. Resourceful will not claim that an assessment can never
              increase. Confirm the applicable local rule before filing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">Data accuracy and source limitations</h2>
            <p>
              Work products may rely on public records, customer submissions, licensed data, imagery, and other
              third-party sources. Those sources may be incomplete, stale, inconsistent, or wrong. Property facts,
              comparable sales, assessment values, imagery dates, and filing requirements should be source-labeled
              and independently checked when material.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">Condition evidence and photographs</h2>
            <p>
              Submitted or street-level photographs can support observations about visible condition, but they do
              not establish concealed conditions, repair costs, causation, code compliance, structural safety, or a
              specific dollar adjustment without adequate supporting evidence and appropriate review. Imagery may
              be outdated or may depict the wrong location.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">Deadlines and jurisdictional variation</h2>
            <p>
              Assessment cycles, review authorities, deadlines, forms, fees, signature requirements, and hearing
              procedures vary and may change without notice. A deadline shown by Resourceful is not a substitute for
              confirmation with the responsible authority. Missing or unverified local rules should be treated as a
              stop condition, not an invitation to guess.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">Customer responsibility</h2>
            <p>
              You remain responsible for reviewing the work product, correcting inaccurate information, confirming
              the current procedural requirements, deciding whether to proceed, signing and submitting documents
              unless a separate engagement says otherwise, attending required proceedings, and preserving filing
              and decision records.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cream mb-3">Questions</h2>
            <p>
              Questions about the service scope or these limitations may be sent to{' '}
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
