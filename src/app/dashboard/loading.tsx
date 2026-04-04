export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-pattern">
      {/* Header skeleton */}
      <header className="bg-navy-deep/80 backdrop-blur-xl nav-shadow sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/20 animate-pulse" />
            <div className="w-24 h-5 rounded bg-cream/10 animate-pulse" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-24 h-8 rounded-lg bg-gold/10 animate-pulse hidden sm:block" />
            <div className="w-8 h-8 rounded-full bg-gold/10 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-10">
          <div className="w-48 h-8 rounded bg-cream/10 animate-pulse mb-3" />
          <div className="w-72 h-4 rounded bg-cream/5 animate-pulse" />
        </div>

        {/* Active report card */}
        <div className="card-premium rounded-xl p-6 md:p-8 mb-16">
          <div className="flex items-start gap-5 mb-8">
            <div className="w-12 h-12 rounded-full bg-gold/10 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="w-40 h-5 rounded bg-cream/10 animate-pulse" />
              <div className="w-64 h-4 rounded bg-cream/5 animate-pulse" />
              <div className="w-48 h-3 rounded bg-cream/5 animate-pulse" />
            </div>
          </div>
          {/* Pipeline bar */}
          <div className="h-2 w-full rounded-full bg-navy-light animate-pulse" />
          <div className="flex justify-between mt-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="w-6 h-6 rounded-full bg-navy-light animate-pulse" />
            ))}
          </div>
        </div>

        {/* History */}
        <div className="w-32 h-5 rounded bg-cream/10 animate-pulse mb-6" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card-premium rounded-xl p-5 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-cream/5 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-52 h-4 rounded bg-cream/[0.08] animate-pulse" />
                <div className="w-36 h-3 rounded bg-cream/5 animate-pulse" />
              </div>
              <div className="w-20 h-6 rounded-full bg-cream/5 animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
