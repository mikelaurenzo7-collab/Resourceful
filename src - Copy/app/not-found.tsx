import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center px-6">
      <div className="max-w-md text-center animate-fade-in">
        <div className="font-display text-8xl text-gold/20 mb-4">404</div>
        <h1 className="font-display text-3xl text-cream mb-4">Page Not Found</h1>
        <p className="text-cream/50 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-light via-gold to-gold-dark px-6 py-3 text-base font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02]"
          >
            Go Home
          </Link>
          <Link
            href="/start"
            className="inline-flex items-center gap-2 rounded-xl border border-gold/30 px-6 py-3 text-base font-medium text-gold hover:bg-gold/10 transition-all duration-300"
          >
            Check My Property
          </Link>
        </div>
      </div>
    </div>
  );
}
