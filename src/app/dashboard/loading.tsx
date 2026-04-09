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
            <div className="w-28 h-8 rounded-lg bg-gold/10 animate-pulse hidden sm:block" />
            <div className="w-8 h-8 rounded-full bg-gold/10 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Page heading */}
        <div className="mb-10">
          <div className="w-16 h-3 rounded bg-gold/10 animate-pulse mb-3" />
          <div className="w-36 h-8 rounded bg-cream/10 animate-pulse mb-2" />
          <div className="w-72 h-4 rounded bg-cream/5 animate-pulse" />
        </div>

        {/* Active report card */}
        <div className="space-y-4 mb-14">
          <div className="card-premium rounded-xl p-6 md:p-8">
            <div className="flex items-start gap-5 mb-8">
              <div className="w-12 h-12 rounded-full bg-gold/10 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="w-44 h-5 rounded bg-cream/10 animate-pulse" />
                <div className="w-72 h-4 rounded bg-cream/5 animate-pulse" />
                <div className="flex gap-3">
                  <div className="w-28 h-3 rounded bg-cream/5 animate-pulse" />
                  <div className="w-40 h-3 rounded bg-cream/5 animate-pulse" />
                </div>
              </div>
            </div>
            {/* Pipeline bar */}
            <div className="hidden md:flex items-center justify-between relative">
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-navy-light" />
              {[...Array(7)].map((_, i) => (
                <div key={i} className="relative flex flex-col items-center z-10">
                  <div className="w-10 h-10 rounded-full bg-navy-light animate-pulse" />
                  <div className="mt-3 w-16 h-3 rounded bg-navy-light animate-pulse" />
                </div>
              ))}
            </div>
            {/* Mobile pipeline */}
            <div className="md:hidden space-y-0">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-navy-light animate-pulse flex-shrink-0" />
                    {i < 3 && <div className="w-0.5 h-8 bg-navy-light" />}
                  </div>
                  <div className="pb-6 pt-1">
                    <div className="w-32 h-4 rounded bg-cream/5 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* History heading */}
        <div className="flex items-center justify-between mb-6">
          <div className="w-32 h-5 rounded bg-cream/10 animate-pulse" />
          <div className="w-16 h-3 rounded bg-cream/5 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card-premium rounded-xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-cream/5 animate-pulse flex-shrink-0" />
                <div className="space-y-2">
                  <div className="w-52 h-4 rounded bg-cream/[0.08] animate-pulse" />
                  <div className="w-36 h-3 rounded bg-cream/5 animate-pulse" />
                </div>
              </div>
              <div className="w-20 h-6 rounded-full bg-cream/5 animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
