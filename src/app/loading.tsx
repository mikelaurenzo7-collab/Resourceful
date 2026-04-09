export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-cream/40">Loading...</p>
      </div>
    </div>
  );
}
