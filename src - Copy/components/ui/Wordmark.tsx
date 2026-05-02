// ─── Brand Wordmark ──────────────────────────────────────────────────────────
// Renders "REsourceful" with the "RE" emphasized in gold.
// Use this component anywhere the brand name appears as a visual wordmark.

export default function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`tracking-tight ${className}`}>
      <span className="text-gold-gradient font-bold drop-shadow-[0_0_12px_rgba(212,168,71,0.4)]">RE</span>
      <span className="font-semibold text-gradient-platinum">sourceful</span>
    </span>
  );
}

/**
 * For contexts where JSX isn't available (metadata, alt text, etc.),
 * use the plain-text brand name.
 */
export const BRAND_NAME = 'REsourceful';
