// ─── Brand Wordmark ──────────────────────────────────────────────────────────
// Renders "REsourceful" with the "RE" emphasized in gold.
// Use this component anywhere the brand name appears as a visual wordmark.

export default function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-gold">RE</span>
      <span>sourceful</span>
    </span>
  );
}

/**
 * For contexts where JSX isn't available (metadata, alt text, etc.),
 * use the plain-text brand name.
 */
export const BRAND_NAME = 'REsourceful';
