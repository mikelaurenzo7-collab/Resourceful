import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { parseStateSlug, buildStateSlug } from '@/lib/utils/state-slug';
import { buildCountySlug } from '@/lib/utils/county-slug';
import { getActiveStates, getActiveCountiesByState } from '@/lib/repository/county-rules';
import Footer from '@/components/landing/Footer';

// ─── Static Params ───────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<{ stateSlug: string }[]> {
  try {
    const states = await getActiveStates();
    return states.map(s => ({ stateSlug: buildStateSlug(s.state_name) }));
  } catch {
    return [];
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stateSlug: string }>;
}): Promise<Metadata> {
  const { stateSlug } = await params;
  const stateName = parseStateSlug(stateSlug);

  const counties = await getActiveCountiesByState(stateName);
  if (counties.length === 0) return { title: 'State Not Found | Resourceful' };

  const title = `Property Tax Appeals in ${stateName} — All ${counties.length} Counties | Resourceful`;
  const description = `Professional property tax appeal reports for every county in ${stateName}. Find your county's assessment ratio, appeal deadline, filing instructions, and start your appeal today.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function StateIndexPage({
  params,
}: {
  params: Promise<{ stateSlug: string }>;
}) {
  const { stateSlug } = await params;
  const stateName = parseStateSlug(stateSlug);

  const counties = await getActiveCountiesByState(stateName);
  if (counties.length === 0) notFound();

  const stateAbbrev = counties[0].state_abbreviation;
  const defaultRatio = counties[0].assessment_ratio_residential;
  const defaultMethodology = counties[0].assessment_methodology;

  // Group counties by first letter for a directory-style layout
  const grouped = new Map<string, typeof counties>();
  for (const county of counties) {
    const letter = county.county_name.charAt(0).toUpperCase();
    if (!grouped.has(letter)) grouped.set(letter, []);
    grouped.get(letter)!.push(county);
  }

  return (
    <main className="min-h-screen bg-pattern">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-deep/80 backdrop-blur-xl nav-shadow">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
          <Link href="/" className="font-display text-xl text-gold">Resourceful</Link>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-cream/50 hover:text-cream transition-colors">
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
      <section className="pt-32 pb-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            {stateName} ({stateAbbrev})
          </span>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-cream mt-4 text-balance">
            Property Tax Appeals in {stateName}
          </h1>
          <p className="mt-6 text-lg text-cream/50 max-w-2xl mx-auto leading-relaxed">
            Professional property tax appeal reports for all {counties.length} counties in {stateName}.
            Select your county below to see filing deadlines, assessment ratios, and start your appeal.
          </p>
          <Link
            href="/start"
            className="mt-8 inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
          >
            Check My Property
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* State Overview Cards */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="card-premium rounded-xl p-6 text-center">
            <p className="text-sm text-cream/40 uppercase tracking-wider">Default Assessment Ratio</p>
            <p className="font-display text-3xl text-gold mt-2">
              {(defaultRatio * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-cream/30 mt-1">of market value</p>
          </div>
          <div className="card-premium rounded-xl p-6 text-center">
            <p className="text-sm text-cream/40 uppercase tracking-wider">Counties</p>
            <p className="font-display text-3xl text-cream mt-2">{counties.length}</p>
            <p className="text-xs text-cream/30 mt-1">with appeal intelligence</p>
          </div>
          <div className="card-premium rounded-xl p-6 text-center">
            <p className="text-sm text-cream/40 uppercase tracking-wider">Assessment Method</p>
            <p className="font-display text-lg text-cream mt-2">{defaultMethodology ?? 'Varies by county'}</p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>

      {/* County Directory */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-16">
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            County Directory
          </span>
          <h2 className="font-display text-3xl md:text-4xl text-cream mt-3">
            All {counties.length} {stateName} Counties
          </h2>
        </div>

        {Array.from(grouped.entries()).map(([letter, letterCounties]) => (
          <div key={letter} className="mb-10">
            <h3 className="font-display text-2xl text-gold mb-4 border-b border-gold/20 pb-2">
              {letter}
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {letterCounties.map(county => {
                const slug = buildCountySlug(county.county_name, county.state_abbreviation);
                const ratio = (county.assessment_ratio_residential * 100).toFixed(0);
                return (
                  <Link
                    key={county.county_fips}
                    href={`/appeal/${slug}`}
                    className="card-premium rounded-lg p-4 hover:border-gold/40 transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-cream font-medium group-hover:text-gold transition-colors">
                          {county.county_name}
                        </p>
                        <p className="text-xs text-cream/40 mt-0.5">
                          {ratio}% ratio · {county.appeal_board_name}
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-cream/20 group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>

      {/* State-Specific SEO Content */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-16">
          <span className="text-sm font-medium tracking-widest text-gold uppercase">
            Understanding {stateName} Property Taxes
          </span>
          <h2 className="font-display text-3xl md:text-4xl text-cream mt-3">
            Property Tax Assessment in {stateName}
          </h2>
        </div>

        <div className="prose-section max-w-3xl mx-auto space-y-8">
          <div>
            <h3 className="font-display text-xl text-cream mb-3">How {stateName} Assesses Property</h3>
            <p className="text-sm text-cream/50 leading-relaxed">
              In {stateName}, residential properties are generally assessed at {(defaultRatio * 100).toFixed(0)}% of their estimated market value.
              {defaultMethodology ? ` The standard assessment methodology is ${defaultMethodology.toLowerCase()}.` : ''}
              {' '}Each of the {counties.length} counties in {stateName} has its own assessor and appeal process, though the assessment ratio standards are set at the state level.
            </p>
          </div>

          <div>
            <h3 className="font-display text-xl text-cream mb-3">The Appeal Process</h3>
            <p className="text-sm text-cream/50 leading-relaxed">
              If you believe your property is over-assessed, {stateName} law provides a formal appeal process. Each county has a board of review or equalization that hears property tax appeals. The filing deadlines, required forms, and hearing formats vary by county — select your county above for specific instructions. In most {stateName} counties, there is no penalty for filing an appeal, and your assessment cannot be increased as a result.
            </p>
          </div>

          <div>
            <h3 className="font-display text-xl text-cream mb-3">Evidence That Wins Appeals</h3>
            <p className="text-sm text-cream/50 leading-relaxed">
              The strongest evidence in {stateName} property tax appeals includes recent comparable sales that show your property is worth less than the assessed value, an assessment ratio analysis demonstrating over-assessment relative to the {(defaultRatio * 100).toFixed(0)}% target, and photographs documenting condition issues like deferred maintenance, structural problems, or functional obsolescence that reduce market value. Our reports include all of this evidence in a professional format accepted by {stateName} appeal boards.
            </p>
          </div>

          <div>
            <h3 className="font-display text-xl text-cream mb-3">How Resourceful Helps</h3>
            <p className="text-sm text-cream/50 leading-relaxed">
              Resourceful generates professional property tax appeal reports for every county in {stateName}. Our system pulls county-specific assessment data, analyzes comparable sales with line-item adjustments, conducts an assessment ratio equity analysis, and packages everything into a report format accepted by {stateName}&apos;s appeal boards. Each report includes county-specific filing instructions for your particular jurisdiction.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="card-premium rounded-2xl p-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-cream">
            Ready to Appeal in {stateName}?
          </h2>
          <p className="mt-4 text-cream/50 max-w-lg mx-auto">
            Enter your address and select your county. We&apos;ll pull your
            assessment data and build your evidence package.
          </p>
          <Link
            href="/start"
            className="mt-8 inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
          >
            Start Your {stateName} Appeal
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
