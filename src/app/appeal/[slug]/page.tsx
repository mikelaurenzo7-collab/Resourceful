import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { parseCountySlug, buildCountySlug } from '@/lib/utils/county-slug';
import { getCountyByName, getActiveCounties } from '@/lib/repository/county-rules';
import Footer from '@/components/landing/Footer';
import type { CountyRule } from '@/types/database';

// ─── Static Params (enables ISR for all active counties) ─────────────────────

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const counties = await getActiveCounties();
    return counties.map((c) => ({
      slug: buildCountySlug(c.county_name, c.state_abbreviation),
    }));
  } catch {
    // If DB is unavailable at build time, return empty — pages will be generated on demand
    return [];
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseCountySlug(slug);
  if (!parsed) return { title: 'County Not Found | Resourceful' };

  const county = await getCountyByName(parsed.countyName, parsed.stateAbbrev);
  if (!county) return { title: 'County Not Found | Resourceful' };

  const stateName = county.state_name;
  const filingMethod = getFilingMethodText(county);

  const title = `Property Tax Appeal in ${county.county_name}, ${stateName} | Resourceful`;
  const description = `Professional property tax appeal reports for ${county.county_name}. ${county.assessment_methodology}. File your appeal ${filingMethod}. ${county.appeal_board_name}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default async function CountyAppealPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parsed = parseCountySlug(slug);
  if (!parsed) notFound();

  const county = await getCountyByName(parsed.countyName, parsed.stateAbbrev);
  if (!county) notFound();

  const filingMethod = getFilingMethodText(county);
  const displayName = county.county_name;
  const stateName = county.state_name;
  const ratioPercent = (county.assessment_ratio_residential * 100).toFixed(0);

  return (
    <main className="min-h-screen bg-pattern">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-deep/80 backdrop-blur-lg">
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

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            {stateName} Property Tax Appeals
          </span>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-cream mt-4 text-balance">
            Property Tax Appeal in {displayName}, {stateName}
          </h1>
          <p className="mt-6 text-lg text-cream/50 max-w-2xl mx-auto leading-relaxed">
            Professional property tax appeal reports for {displayName} homeowners.
            Our analysis has helped property owners save an average of $800&ndash;$3,000+ per year.
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

      {/* County Info Cards */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Assessment Ratio */}
          <div className="card-premium rounded-xl p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border border-gold/30 bg-gold/5 mb-4">
              <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-cream/40 uppercase tracking-wider">Assessment Ratio</p>
            <p className="font-display text-2xl text-cream mt-1">{ratioPercent}% of Market Value</p>
          </div>

          {/* Appeal Board */}
          <div className="card-premium rounded-xl p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border border-gold/30 bg-gold/5 mb-4">
              <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-sm text-cream/40 uppercase tracking-wider">Appeal Board</p>
            <p className="font-display text-xl text-cream mt-1">{county.appeal_board_name}</p>
          </div>

          {/* Deadline */}
          <div className="card-premium rounded-xl p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border border-gold/30 bg-gold/5 mb-4">
              <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-cream/40 uppercase tracking-wider">Appeal Deadline</p>
            <p className="font-display text-xl text-cream mt-1">{county.appeal_deadline_rule}</p>
          </div>

          {/* Filing Fee */}
          <div className="card-premium rounded-xl p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border border-gold/30 bg-gold/5 mb-4">
              <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-cream/40 uppercase tracking-wider">Filing Fee</p>
            <p className="font-display text-2xl text-cream mt-1">
              {county.filing_fee_cents === 0
                ? 'No Fee'
                : `$${(county.filing_fee_cents / 100).toFixed(2)}`}
            </p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>

      {/* How It Works */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-16">
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            How It Works
          </span>
          <h2 className="font-display text-3xl md:text-4xl text-cream mt-3">
            Three Steps to Lower Taxes
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {/* Step 1 */}
          <div className="relative">
            <div className="hidden md:block absolute top-10 left-full w-full h-px bg-gradient-to-r from-gold/30 to-transparent -translate-x-6" />
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center justify-center w-14 h-14 rounded-full border border-gold/30 bg-gold/5 text-gold">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="font-display text-4xl text-gold/20">01</span>
            </div>
            <h3 className="font-display text-xl text-cream mb-3">Enter Your Address</h3>
            <p className="text-sm text-cream/50 leading-relaxed">
              We pull {displayName} assessment data and property details automatically.
              Upload your tax bill to save 15%.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative">
            <div className="hidden md:block absolute top-10 left-full w-full h-px bg-gradient-to-r from-gold/30 to-transparent -translate-x-6" />
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center justify-center w-14 h-14 rounded-full border border-gold/30 bg-gold/5 text-gold">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="font-display text-4xl text-gold/20">02</span>
            </div>
            <h3 className="font-display text-xl text-cream mb-3">Upload Photos</h3>
            <p className="text-sm text-cream/50 leading-relaxed">
              Our AI analyzes your property&apos;s condition, identifying issues that
              support a lower assessed value.
            </p>
          </div>

          {/* Step 3 */}
          <div>
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center justify-center w-14 h-14 rounded-full border border-gold/30 bg-gold/5 text-gold">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-display text-4xl text-gold/20">03</span>
            </div>
            <h3 className="font-display text-xl text-cream mb-3">Receive Your Report</h3>
            <p className="text-sm text-cream/50 leading-relaxed">
              Get a professional appeal report with comparable sales, evidence, and
              step-by-step {displayName} filing instructions.
            </p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>

      {/* County-Specific Appeal Process */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-16">
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            Local Appeal Process
          </span>
          <h2 className="font-display text-3xl md:text-4xl text-cream mt-3">
            How to Appeal in {displayName}
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Assessment Details */}
          <div className="card-premium rounded-xl p-8">
            <h3 className="font-display text-xl text-cream mb-6">Assessment Details</h3>
            <dl className="space-y-4">
              {county.assessment_cycle && (
                <div>
                  <dt className="text-sm text-cream/40 uppercase tracking-wider">Assessment Cycle</dt>
                  <dd className="text-cream mt-1">{county.assessment_cycle}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-cream/40 uppercase tracking-wider">Assessment Methodology</dt>
                <dd className="text-cream mt-1">{county.assessment_methodology}</dd>
              </div>
              <div>
                <dt className="text-sm text-cream/40 uppercase tracking-wider">Residential Ratio</dt>
                <dd className="text-cream mt-1">{ratioPercent}% of market value</dd>
              </div>
              {county.appeal_deadline_rule && (
                <div>
                  <dt className="text-sm text-cream/40 uppercase tracking-wider">Appeal Deadline</dt>
                  <dd className="text-cream mt-1">{county.appeal_deadline_rule}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Filing Information */}
          <div className="card-premium rounded-xl p-8">
            <h3 className="font-display text-xl text-cream mb-6">Filing Information</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-cream/40 uppercase tracking-wider">Filing Method</dt>
                <dd className="text-cream mt-1 capitalize">{filingMethod}</dd>
              </div>
              {county.portal_url && (
                <div>
                  <dt className="text-sm text-cream/40 uppercase tracking-wider">Online Portal</dt>
                  <dd className="mt-1">
                    <a
                      href={county.portal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold hover:text-gold-light transition-colors underline"
                    >
                      {county.appeal_board_name} Portal
                    </a>
                  </dd>
                </div>
              )}
              {county.hearing_format && (
                <div>
                  <dt className="text-sm text-cream/40 uppercase tracking-wider">Hearing Format</dt>
                  <dd className="text-cream mt-1">{county.hearing_format}</dd>
                </div>
              )}
              {county.appeal_form_name && (
                <div>
                  <dt className="text-sm text-cream/40 uppercase tracking-wider">Required Form</dt>
                  <dd className="mt-1">
                    {county.form_download_url ? (
                      <a
                        href={county.form_download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold hover:text-gold-light transition-colors underline"
                      >
                        {county.appeal_form_name}
                      </a>
                    ) : (
                      <span className="text-cream">{county.appeal_form_name}</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Informal Review */}
        {county.informal_review_available && (
          <div className="card-premium rounded-xl p-8 mt-8">
            <h3 className="font-display text-xl text-cream mb-4">Informal Review Available</h3>
            <p className="text-cream/60 leading-relaxed">
              {displayName} offers an informal review process before a formal hearing.
              {county.informal_review_notes && ` ${county.informal_review_notes}`}
            </p>
          </div>
        )}

        {/* Success Rate */}
        {county.success_rate_pct != null && (
          <div className="mt-8 card-premium rounded-xl p-8 text-center">
            <p className="text-sm text-cream/40 uppercase tracking-wider mb-2">
              Historical Appeal Success Rate
            </p>
            <p className="font-display text-4xl text-gold">{county.success_rate_pct}%</p>
            {county.success_rate_source && (
              <p className="text-xs text-cream/30 mt-2">Source: {county.success_rate_source}</p>
            )}
          </div>
        )}
      </section>

      {/* Pro Se Tips */}
      {county.pro_se_tips && (
        <>
          <div className="mx-auto max-w-6xl px-6">
            <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
          </div>
          <section className="mx-auto max-w-6xl px-6 py-24">
            <div className="text-center mb-12">
              <span className="text-sm font-medium tracking-widest text-gold uppercase">
                Expert Guidance
              </span>
              <h2 className="font-display text-3xl md:text-4xl text-cream mt-3">
                Tips for {displayName} Appeals
              </h2>
            </div>
            <div className="card-premium rounded-xl p-8">
              <p className="text-cream/60 leading-relaxed whitespace-pre-line">
                {county.pro_se_tips}
              </p>
            </div>
          </section>
        </>
      )}

      {/* Final CTA */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="card-premium rounded-2xl p-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-cream">
            Ready to Appeal in {displayName}?
          </h2>
          <p className="mt-4 text-cream/50 max-w-lg mx-auto">
            Enter your address and let us run the numbers. Upload your tax bill to save 15% on your report.
          </p>
          <Link
            href="/start"
            className="mt-8 inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
          >
            Start Your {displayName} Appeal
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFilingMethodText(county: CountyRule): string {
  const methods: string[] = [];
  if (county.accepts_online_filing) methods.push('online');
  if (county.accepts_email_filing) methods.push('by email');
  if (county.requires_mail_filing) methods.push('by mail');
  if (methods.length === 0) methods.push('by mail');
  return methods.join(' or ');
}
