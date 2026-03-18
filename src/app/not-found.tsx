import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="font-display text-3xl text-cream mb-3">Page Not Found</h1>
        <p className="text-cream/50 text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/"
            className="text-sm text-cream/60 hover:text-cream transition-colors"
          >
            Back to Home
          </Link>
          <Link
            href="/start"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-light via-gold to-gold-dark px-6 py-3 text-sm font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
