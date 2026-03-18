import Link from 'next/link';

export default function SavingsHighlight() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="card-premium rounded-2xl overflow-hidden">
        <div className="grid md:grid-cols-2">
          {/* Left: ROI narrative */}
          <div className="p-10 md:p-14">
            <span className="text-sm font-medium tracking-widest text-gold uppercase">
              The Math Speaks for Itself
            </span>
            <h2 className="font-display text-3xl md:text-4xl text-cream mt-4 leading-tight">
              A $49 Report That Pays for Itself{' '}
              <span className="text-gold-gradient">20x Over</span>
            </h2>
            <div className="mt-8 space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-cream font-medium">Average annual savings: $1,100</p>
                  <p className="text-sm text-cream/40 mt-0.5">
                    Successful appeals typically reduce assessments by 10&ndash;25%
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-cream font-medium">Savings compound every year</p>
                  <p className="text-sm text-cream/40 mt-0.5">
                    A lower assessment stays until the next reassessment &mdash; that&rsquo;s $5,500+ over 5 years
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-cream font-medium">No risk to file</p>
                  <p className="text-sm text-cream/40 mt-0.5">
                    Your taxes can&rsquo;t go up from filing an appeal. The worst outcome is no change.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-10">
              <Link
                href="/start"
                className="inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
              >
                Get My Report
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Right: Visual savings breakdown */}
          <div className="relative bg-navy-deep/50 p-10 md:p-14 flex flex-col justify-center border-t md:border-t-0 md:border-l border-gold/10">
            <div className="space-y-6">
              {/* Year 1 */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm text-cream/40">Year 1</span>
                  <span className="font-display text-xl text-emerald-400">+$1,051</span>
                </div>
                <div className="h-3 rounded-full bg-navy-light overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: '20%' }} />
                </div>
                <p className="text-xs text-cream/30 mt-1">$1,100 saved &minus; $49 report</p>
              </div>

              {/* Year 3 */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm text-cream/40">Year 3</span>
                  <span className="font-display text-xl text-emerald-400">+$3,251</span>
                </div>
                <div className="h-3 rounded-full bg-navy-light overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: '60%' }} />
                </div>
                <p className="text-xs text-cream/30 mt-1">Savings compound each year</p>
              </div>

              {/* Year 5 */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm text-cream/40">Year 5</span>
                  <span className="font-display text-2xl text-emerald-400">+$5,451</span>
                </div>
                <div className="h-3 rounded-full bg-navy-light overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: '100%' }} />
                </div>
                <p className="text-xs text-cream/30 mt-1">110x return on a $49 investment</p>
              </div>
            </div>

            {/* Subtle annotation */}
            <p className="mt-8 text-xs text-cream/20 leading-relaxed">
              Based on average successful appeal reducing assessment by 15% on a property
              with $7,300 annual tax bill. Actual savings vary by property and jurisdiction.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
