export default function StartLoading() {
  return (
    <div className="min-h-screen bg-pattern relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-aurora opacity-30 z-0 pointer-events-none" />
      <div className="text-center animate-fade-in relative z-10">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center mx-auto mb-4 animate-premium-pulse shadow-gold-lg">
          <span className="text-navy-deep font-bold text-xl">R</span>
        </div>
        <p className="text-gold/70 text-xs font-semibold tracking-[0.2em] uppercase data-stream-text">Initializing Secure Connection</p>
      </div>
    </div>
  );
}
