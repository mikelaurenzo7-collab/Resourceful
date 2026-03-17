export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-pattern">
      <header className="border-b border-gold/10 bg-navy-deep/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
              <span className="text-navy-deep font-bold text-sm">R</span>
            </div>
            <span className="font-display text-lg text-cream">Resourceful</span>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gold/10 rounded w-48" />
          <div className="card-premium rounded-xl p-8 space-y-4">
            <div className="h-6 bg-gold/10 rounded w-64" />
            <div className="h-4 bg-gold/5 rounded w-96" />
            <div className="h-16 bg-gold/5 rounded" />
          </div>
        </div>
      </main>
    </div>
  );
}
