export default function Loading() {
  return (
    <div className="min-h-screen bg-navy-deep overflow-hidden relative flex flex-col items-center justify-center">
      {/* Ambient background effect */}
      <div className="bg-aurora" />

      {/* High-tech intelligence scanner */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="scanner-container transform scale-125 opacity-90">
          <div className="scanner-ring" />
          <div className="scanner-progress" />
          <div className="scanner-dot" />
        </div>

        {/* Evolving status readouts */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl md:text-2xl font-display text-cream drop-shadow-lg tracking-wide uppercase">
            <span className="data-stream-text">Establishing Secure Connection</span>
          </h1>
          <p className="text-gold/60 text-sm tracking-widest uppercase font-semibold animate-pulse">
            System Initializing...
          </p>
        </div>
      </div>
    </div>
  );
}
