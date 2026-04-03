// ─── Brand Logo Component ────────────────────────────────────────────────────
// Renders "REsourceful" with the "RE" visually emphasized.
// Use this everywhere the brand name appears in the UI.

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
};

export default function BrandLogo({ className = '', size = 'md' }: BrandLogoProps) {
  return (
    <span className={`font-display tracking-tight ${sizeClasses[size]} ${className}`}>
      <span className="text-gold font-bold">RE</span>
      <span>sourceful</span>
    </span>
  );
}
