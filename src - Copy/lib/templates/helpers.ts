// ─── Template Helper Functions ────────────────────────────────────────────────
// Pure utility functions for formatting values in the PDF report template.
// Every function is deterministic and side-effect-free.

// ─── Currency ─────────────────────────────────────────────────────────────────

/**
 * Format a number as US currency: $1,234,567
 * Rounds to the nearest dollar (no cents for real-estate values).
 */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  const rounded = Math.round(amount);
  return '$' + rounded.toLocaleString('en-US');
}

/**
 * Convert a dollar amount to words suitable for a legal document.
 * Example: 1_234_567 → "One Million Two Hundred Thirty-Four Thousand Five Hundred Sixty-Seven Dollars"
 */
export function formatCurrencyWords(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return 'Zero Dollars';

  const rounded = Math.round(Math.abs(amount));

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

  function convertGroup(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) {
      const remainder = n % 10;
      return tens[Math.floor(n / 10)] + (remainder ? '-' + ones[remainder] : '');
    }
    const remainder = n % 100;
    return ones[Math.floor(n / 100)] + ' Hundred' + (remainder ? ' ' + convertGroup(remainder) : '');
  }

  if (rounded === 0) return 'Zero Dollars';

  const groups: string[] = [];
  let remaining = rounded;
  let scaleIndex = 0;

  while (remaining > 0) {
    const group = remaining % 1000;
    if (group !== 0) {
      const groupWords = convertGroup(group);
      const scale = scales[scaleIndex];
      groups.unshift(scale ? `${groupWords} ${scale}` : groupWords);
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex++;
  }

  const prefix = amount < 0 ? 'Negative ' : '';
  const words = groups.join(' ');
  const suffix = rounded === 1 ? 'Dollar' : 'Dollars';
  return `${prefix}${words} ${suffix}`;
}

// ─── Dates ────────────────────────────────────────────────────────────────────

/**
 * Format an ISO date string (or Date-parseable string) into a human-readable
 * format: "March 16, 2026".
 */
export function formatDate(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Short date: "03/16/2026"
 */
export function formatDateShort(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  });
}

// ─── Numbers ──────────────────────────────────────────────────────────────────

/**
 * Format a decimal as a percentage: 0.0534 → "5.34%"
 * If the value is already in percent form (> 1), it is used directly.
 */
export function formatPercent(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '0%';
  const pct = Math.abs(value) < 1 ? value * 100 : value;
  return pct.toFixed(decimals) + '%';
}

/**
 * Format square footage: 1500 → "1,500 SF"
 */
export function formatSqFt(value: number): string {
  if (!Number.isFinite(value)) return '0 SF';
  return Math.round(value).toLocaleString('en-US') + ' SF';
}

/**
 * Format a lot size with appropriate unit.
 * Values >= 43560 (1 acre) display in acres; otherwise in SF.
 */
export function formatLotSize(sqft: number): string {
  if (!Number.isFinite(sqft) || sqft <= 0) return 'N/A';
  if (sqft >= 43560) {
    const acres = sqft / 43560;
    return acres.toFixed(2) + ' acres';
  }
  return formatSqFt(sqft);
}

/**
 * Format a generic number with commas: 123456 → "123,456"
 */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── Visual / Condition ───────────────────────────────────────────────────────

/**
 * Map a condition rating to a semantic color for badges / indicators.
 */
export function getConditionColor(rating: string): string {
  const normalized = (rating || '').toLowerCase().trim();
  const map: Record<string, string> = {
    excellent: '#2e7d32',
    good: '#388e3c',
    'above average': '#558b2f',
    average: '#f9a825',
    fair: '#ef6c00',
    'below average': '#e65100',
    poor: '#c62828',
  };
  return map[normalized] ?? '#757575';
}

/**
 * Sanitize a string for safe inclusion in HTML (prevent XSS in rendered PDF).
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Return a CSS-safe inline background-image url or a placeholder gradient
 * when no image URL is available.
 */
export function imageOrPlaceholder(url: string | undefined | null): string {
  if (url && url.trim()) {
    return `url('${escapeHtml(url.trim())}')`;
  }
  return 'linear-gradient(135deg, #e0e0e0 25%, #f5f5f5 50%, #e0e0e0 75%)';
}

/**
 * Format a property type for display: 'residential' → 'Residential'
 */
export function formatPropertyType(type: string): string {
  if (!type) return '';
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

/**
 * Format hearing format for display: 'in_person' → 'In Person'
 */
export function formatHearingFormat(format: string | null): string {
  if (!format) return 'N/A';
  const map: Record<string, string> = {
    in_person: 'In Person',
    virtual: 'Virtual',
    both: 'In Person or Virtual',
    written_only: 'Written Submission Only',
  };
  return map[format] ?? format;
}

/**
 * Safely access nested values, returning a fallback if not present.
 */
export function safeVal<T>(value: T | null | undefined, fallback: T): T {
  return value != null ? value : fallback;
}

/**
 * Build a full address string from components.
 */
export function fullAddress(
  line1: string,
  line2: string | null,
  city: string,
  state: string,
  zip: string
): string {
  const parts = [line1];
  if (line2) parts.push(line2);
  parts.push(`${city}, ${state} ${zip}`);
  return parts.join(', ');
}

/**
 * Return the label for an adjustment key: 'lot_size' → 'Lot Size'
 */
export function adjustmentLabel(key: string): string {
  const labels: Record<string, string> = {
    sale_price: 'Sale Price',
    financing: 'Financing',
    conditions_of_sale: 'Conditions of Sale',
    market_conditions: 'Market Conditions (Time)',
    location: 'Location',
    lot_size: 'Lot Size',
    building_sq_ft: 'Building Size (GBA)',
    age: 'Age / Year Built',
    condition: 'Condition',
    quality: 'Quality',
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    basement: 'Basement',
    garage: 'Garage / Parking',
    pool: 'Pool',
    fireplace: 'Fireplace',
    heating_cooling: 'Heating / Cooling',
    stories: 'Stories',
    view: 'View',
    other: 'Rooms & Amenities',
  };
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
