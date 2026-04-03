'use client';

interface ReportDownloadProps {
  pdfUrl: string | null;
  reportType: string;
  propertyAddress: string;
  countyName?: string;
}

export default function ReportDownload({
  pdfUrl,
  reportType,
  propertyAddress,
  countyName,
}: ReportDownloadProps) {
  return (
    <div className="space-y-6">
      {/* Download section */}
      <div className="card-premium rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-grow">
            <h3 className="font-display text-xl text-cream">Your Report is Ready</h3>
            <p className="text-sm text-cream/50 mt-1">{propertyAddress}</p>

            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-6 py-3 text-sm font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF Report
              </a>
            ) : (
              <p className="mt-4 text-sm text-cream/40">
                Download link is being prepared...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pro Se Filing Guide */}
      {reportType === 'tax_appeal' && (
        <div className="card-premium rounded-xl overflow-hidden">
          <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
            <h3 className="font-display text-lg text-cream">
              Pro Se Filing Guide &mdash; {countyName} County
            </h3>
            <p className="text-xs text-cream/40 mt-1">
              Step-by-step instructions for filing your appeal without an attorney
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-gold">1</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-cream">
                    Gather Your Materials
                  </h4>
                  <p className="text-sm text-cream/50 mt-1 leading-relaxed">
                    Print your REsourceful report (the PDF you downloaded above). You will also
                    need your Property Index Number (PIN) and current tax bill. These are
                    included in Section 1 of your report.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-gold">2</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-cream">
                    File Your Appeal Online
                  </h4>
                  <p className="text-sm text-cream/50 mt-1 leading-relaxed">
                    Visit your county assessor&apos;s website and locate the appeal filing portal.
                    Most counties allow online filing. Upload your REsourceful report as supporting
                    evidence. Select &quot;Comparable Sales&quot; as your evidence type.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-gold">3</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-cream">
                    Attend Your Hearing
                  </h4>
                  <p className="text-sm text-cream/50 mt-1 leading-relaxed">
                    You will receive a hearing date (often 2-4 weeks after filing). Many
                    counties now offer virtual hearings. Present your comparable sales and
                    reference the analysis in your report. Speak to the numbers, not emotions.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-gold">4</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-cream">
                    Receive Your Decision
                  </h4>
                  <p className="text-sm text-cream/50 mt-1 leading-relaxed">
                    The Board will mail their decision. If your assessed value is reduced,
                    the savings will be reflected in your next tax bill. If not fully granted,
                    you may still receive a partial reduction, and you can appeal to the
                    Property Tax Appeal Board (PTAB) at no additional cost.
                  </p>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-lg bg-gold/5 border border-gold/15 p-4">
              <h4 className="text-sm font-semibold text-gold mb-2">Tips for Your Hearing</h4>
              <ul className="space-y-1.5 text-xs text-cream/50 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-gold">&bull;</span>
                  Be concise. Focus on your comparable sales and the math.
                </li>
                <li className="flex gap-2">
                  <span className="text-gold">&bull;</span>
                  Bring 3 printed copies of your report (one for each board member and one for you).
                </li>
                <li className="flex gap-2">
                  <span className="text-gold">&bull;</span>
                  Mention specific adjustments (e.g., &quot;Comparable #2 sold for $245,000 after adjusting for an additional bathroom&quot;).
                </li>
                <li className="flex gap-2">
                  <span className="text-gold">&bull;</span>
                  If the assessor counter-argues, ask what comparables they used.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
