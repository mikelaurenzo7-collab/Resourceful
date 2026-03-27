export default function AppealLoading() {
  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center mx-auto mb-4 animate-premium-pulse">
          <span className="text-navy-deep font-bold text-xl">R</span>
        </div>
        <p className="text-cream/40 text-sm">Loading county data...</p>
      </div>
    </div>
  );
}
