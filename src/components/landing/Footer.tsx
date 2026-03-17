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
            <p className="mt-4 text-sm text-cream/40 leading-relaxed max-w-sm">
              Professional property tax appeal reports for homeowners
              who refuse to overpay. Built on real data, powered by AI,
              reviewed by experts.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-cream/60 mb-4">
              Services
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/start" className="text-sm text-cream/40 hover:text-gold transition-colors">
                  Tax Appeal Report
                </Link>
              </li>
              <li>
                <Link href="/start" className="text-sm text-cream/40 hover:text-gold transition-colors">
                  Pre-Purchase Analysis
                </Link>
              </li>
              <li>
                <Link href="/start" className="text-sm text-cream/40 hover:text-gold transition-colors">
                  Pre-Listing Report
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-cream/60 mb-4">
              Account
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/login" className="text-sm text-cream/40 hover:text-gold transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-sm text-cream/40 hover:text-gold transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-cream/40 hover:text-gold transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gold/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream/30">
            &copy; {new Date().getFullYear()} Resourceful. All rights reserved.
          </p>
          <p className="text-xs text-cream/20">
            Not legal advice. Reports are informational tools for property tax appeal proceedings.
          </p>
        </div>
      </div>
    </footer>
  );
}
