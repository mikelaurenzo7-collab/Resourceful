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
      {/* Download card */}
      <div className="card-premium rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-grow">
            <h3 className="font-display text-xl text-cream">Your Report is Ready</h3>
            <p className="text-sm text-cream/50 mt-1">{propertyAddress}</p>

            {pdfUrl ? (
              <a
                href={pdfUrl}
                className="mt-4 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold btn-premium-glow shadow-gold hover:shadow-gold-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF Report
              </a>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-sm text-cream/40">
                <div className="w-4 h-4 border border-cream/20 border-t-cream/50 rounded-full animate-spin" />
                Preparing your download…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pro Se Filing Guide — tax appeals only */}
      {reportType === 'tax_appeal' && (
        <div className="card-premium rounded-xl overflow-hidden">
          <div className="border-b border-gold/10 px-6 py-4 bg-gold/5">
            <h3 className="font-display text-lg text-cream">
              Pro Se Filing Guide{countyName ? ` — ${countyName} County` : ''}
            </h3>
            <p className="text-xs text-cream/40 mt-1">
              Step-by-step instructions for filing your appeal. Full county-specific details are in your PDF.
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              {[
                {
                  title: 'Gather Your Materials',
                  body: 'Print your Resourceful report. You will also need your Property Index Number (PIN) and current tax bill — both are included in Section 1 of your report.',
                },
                {
                  title: 'File Your Appeal',
                  body: 'Visit your county assessor\'s website and locate the appeal filing portal. Upload your Resourceful report as supporting evidence. Select "Comparable Sales" as your evidence type where prompted.',
                },
                {
                  title: 'Prepare for Your Hearing',
                  body: 'You will receive a hearing date after filing. Many counties now offer virtual hearings. Lead with your comparable sales data and speak to the numbers, not emotions.',
                },
                {
                  title: 'Receive Your Decision',
                  body: 'The board will mail their decision. If your assessed value is reduced, savings will appear in your next tax bill. If not fully granted, check whether your county offers a further appeal — details are in your PDF filing guide.',
                },
              ].map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-gold">{i + 1}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-cream">{step.title}</h4>
                    <p className="text-sm text-cream/50 mt-1 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Hearing tips */}
            <div className="rounded-lg bg-gold/5 border border-gold/15 p-4">
              <h4 className="text-sm font-semibold text-gold mb-2">Tips for Your Hearing</h4>
              <ul className="space-y-1.5 text-xs text-cream/50 leading-relaxed">
                {[
                  'Be concise. Focus on your comparable sales and the math.',
                  'Bring printed copies of your report — one for each board member, plus one for yourself.',
                  'Cite specific adjustments: "Comparable #2 sold for $X after adjusting for an additional bathroom."',
                  'If the assessor counter-argues, ask which comparables they used.',
                ].map((tip, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gold flex-shrink-0">&bull;</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
