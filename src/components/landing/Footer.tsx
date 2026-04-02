import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gold/10 bg-navy-deep">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="font-display text-2xl text-gold">
              Resourceful
            </Link>
            <p className="mt-4 text-sm text-cream/50 leading-relaxed max-w-sm">
              Professional property tax appeal reports built on real comparable sales data
              and IAAO appraisal standards. Serving homeowners in all 50 states.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-cream/60 mb-4">
              Services
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/start" className="text-sm text-cream/60 hover:text-gold transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 rounded">
                  Tax Appeal Report
                </Link>
              </li>
              <li>
                <Link href="/start" className="text-sm text-cream/60 hover:text-gold transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 rounded">
                  Pre-Purchase Analysis
                </Link>
              </li>
              <li>
                <Link href="/start" className="text-sm text-cream/60 hover:text-gold transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 rounded">
                  Pre-Listing Report
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-cream/60 mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/terms" className="text-sm text-cream/60 hover:text-gold transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 rounded">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-cream/60 hover:text-gold transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 rounded">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="text-sm text-cream/60 hover:text-gold transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 rounded">
                  Disclaimer
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer bar */}
        <div className="mt-16 pt-8 border-t border-gold/5 space-y-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-cream/30">
              &copy; {new Date().getFullYear()} Resourceful. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-cream/20">
              <Link href="/terms" className="hover:text-cream/40 transition-colors">Terms</Link>
              <span>&middot;</span>
              <Link href="/privacy" className="hover:text-cream/40 transition-colors">Privacy</Link>
              <span>&middot;</span>
              <Link href="/disclaimer" className="hover:text-cream/40 transition-colors">Disclaimer</Link>
              <span>&middot;</span>
              <Link href="/login?redirect=/admin" className="hover:text-cream/40 transition-colors">Admin</Link>
            </div>
          </div>
          <p className="text-xs text-cream/20 text-center md:text-left leading-relaxed max-w-3xl">
            Resourceful is not a law firm and does not provide legal advice. Reports are data-driven
            informational tools based on public property data, not formal appraisals. You are responsible for
            verifying all data, meeting filing deadlines, and making your own decisions regarding property tax
            appeals. See our{' '}
            <Link href="/disclaimer" className="underline hover:text-cream/40 transition-colors">
              full disclaimer
            </Link>{' '}
            for details.
          </p>
        </div>
      </div>
    </footer>
  );
}
