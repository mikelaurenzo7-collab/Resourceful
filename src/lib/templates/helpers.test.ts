import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyWords,
  formatDate,
  formatDateShort,
  formatPercent,
  formatSqFt,
  formatLotSize,
  formatNumber,
  getConditionColor,
  escapeHtml,
  imageOrPlaceholder,
  formatPropertyType,
  formatHearingFormat,
  safeVal,
  fullAddress,
  adjustmentLabel,
} from './helpers';

// ─── formatCurrency ─────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats whole numbers', () => {
    expect(formatCurrency(1234567)).toBe('$1,234,567');
  });

  it('rounds to nearest dollar', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
    expect(formatCurrency(1234.49)).toBe('$1,234');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('handles negative values', () => {
    // toLocaleString places minus after $: "$-5,000"
    expect(formatCurrency(-5000)).toBe('$-5,000');
  });

  it('handles very large values', () => {
    expect(formatCurrency(999999999)).toBe('$999,999,999');
  });

  it('handles NaN and Infinity', () => {
    expect(formatCurrency(NaN)).toBe('$0');
    expect(formatCurrency(Infinity)).toBe('$0');
    expect(formatCurrency(-Infinity)).toBe('$0');
  });
});

// ─── formatCurrencyWords ────────────────────────────────────────────────────

describe('formatCurrencyWords', () => {
  it('converts zero', () => {
    expect(formatCurrencyWords(0)).toBe('Zero Dollars');
  });

  it('converts one dollar', () => {
    expect(formatCurrencyWords(1)).toBe('One Dollar');
  });

  it('converts small numbers', () => {
    expect(formatCurrencyWords(15)).toBe('Fifteen Dollars');
  });

  it('converts tens', () => {
    expect(formatCurrencyWords(42)).toBe('Forty-Two Dollars');
  });

  it('converts hundreds', () => {
    expect(formatCurrencyWords(100)).toBe('One Hundred Dollars');
    expect(formatCurrencyWords(315)).toBe('Three Hundred Fifteen Dollars');
  });

  it('converts thousands', () => {
    expect(formatCurrencyWords(1000)).toBe('One Thousand Dollars');
    expect(formatCurrencyWords(52400)).toBe('Fifty-Two Thousand Four Hundred Dollars');
  });

  it('converts millions', () => {
    expect(formatCurrencyWords(1000000)).toBe('One Million Dollars');
    expect(formatCurrencyWords(1234567)).toBe(
      'One Million Two Hundred Thirty-Four Thousand Five Hundred Sixty-Seven Dollars'
    );
  });

  it('handles negative values', () => {
    expect(formatCurrencyWords(-5000)).toBe('Negative Five Thousand Dollars');
  });

  it('rounds decimals', () => {
    expect(formatCurrencyWords(99.7)).toBe('One Hundred Dollars');
  });

  it('handles NaN and Infinity', () => {
    expect(formatCurrencyWords(NaN)).toBe('Zero Dollars');
    expect(formatCurrencyWords(Infinity)).toBe('Zero Dollars');
  });

  it('handles amounts with zero middle groups', () => {
    // 1,000,001 — middle group is zero
    expect(formatCurrencyWords(1000001)).toBe('One Million One Dollars');
  });

  it('handles exact group boundaries', () => {
    expect(formatCurrencyWords(1000)).toBe('One Thousand Dollars');
    expect(formatCurrencyWords(1000000)).toBe('One Million Dollars');
  });
});

// ─── formatPercent ──────────────────────────────────────────────────────────

describe('formatPercent', () => {
  it('converts decimal to percent', () => {
    expect(formatPercent(0.0534)).toBe('5.34%');
  });

  it('passes through values > 1 as-is', () => {
    expect(formatPercent(12.5)).toBe('12.50%');
  });

  it('respects decimal places', () => {
    expect(formatPercent(0.08, 0)).toBe('8%');
    expect(formatPercent(0.08, 1)).toBe('8.0%');
  });

  it('handles zero', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('handles NaN', () => {
    expect(formatPercent(NaN)).toBe('0%');
  });
});

// ─── formatSqFt ─────────────────────────────────────────────────────────────

describe('formatSqFt', () => {
  it('formats with commas and SF suffix', () => {
    expect(formatSqFt(1500)).toBe('1,500 SF');
  });

  it('rounds to whole number', () => {
    expect(formatSqFt(1500.7)).toBe('1,501 SF');
  });

  it('handles NaN', () => {
    expect(formatSqFt(NaN)).toBe('0 SF');
  });
});

// ─── formatLotSize ──────────────────────────────────────────────────────────

describe('formatLotSize', () => {
  it('shows acres for large lots', () => {
    expect(formatLotSize(87120)).toBe('2.00 acres');
  });

  it('shows SF for small lots', () => {
    expect(formatLotSize(5000)).toBe('5,000 SF');
  });

  it('switches at exactly 1 acre', () => {
    expect(formatLotSize(43560)).toBe('1.00 acres');
  });

  it('returns N/A for zero or negative', () => {
    expect(formatLotSize(0)).toBe('N/A');
    expect(formatLotSize(-100)).toBe('N/A');
  });

  it('handles NaN', () => {
    expect(formatLotSize(NaN)).toBe('N/A');
  });
});

// ─── formatNumber ───────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('formats with commas', () => {
    expect(formatNumber(123456)).toBe('123,456');
  });

  it('supports decimal places', () => {
    expect(formatNumber(3.14159, 2)).toBe('3.14');
  });

  it('handles NaN', () => {
    expect(formatNumber(NaN)).toBe('0');
  });
});

// ─── formatDate / formatDateShort ───────────────────────────────────────────

describe('formatDate', () => {
  it('formats ISO string', () => {
    const result = formatDate('2026-03-17T00:00:00Z');
    expect(result).toContain('March');
    expect(result).toContain('2026');
  });

  it('returns empty for falsy', () => {
    expect(formatDate('')).toBe('');
  });

  it('returns original for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatDateShort', () => {
  it('formats as MM/DD/YYYY', () => {
    const result = formatDateShort('2026-03-17T00:00:00Z');
    expect(result).toMatch(/03\/17\/2026/);
  });

  it('returns empty for falsy', () => {
    expect(formatDateShort('')).toBe('');
  });
});

// ─── escapeHtml ─────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes all dangerous characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('AT&T')).toBe('AT&amp;T');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('returns empty for falsy', () => {
    expect(escapeHtml('')).toBe('');
  });
});

// ─── getConditionColor ──────────────────────────────────────────────────────

describe('getConditionColor', () => {
  it('returns green for excellent', () => {
    expect(getConditionColor('excellent')).toBe('#2e7d32');
  });

  it('returns red for poor', () => {
    expect(getConditionColor('poor')).toBe('#c62828');
  });

  it('is case-insensitive', () => {
    expect(getConditionColor('GOOD')).toBe('#388e3c');
    expect(getConditionColor(' Fair ')).toBe('#ef6c00');
  });

  it('returns grey for unknown', () => {
    expect(getConditionColor('unknown')).toBe('#757575');
    expect(getConditionColor('')).toBe('#757575');
  });
});

// ─── imageOrPlaceholder ─────────────────────────────────────────────────────

describe('imageOrPlaceholder', () => {
  it('returns url() for valid URLs', () => {
    expect(imageOrPlaceholder('https://example.com/img.jpg')).toContain("url('https://example.com/img.jpg')");
  });

  it('returns gradient for null/empty', () => {
    expect(imageOrPlaceholder(null)).toContain('linear-gradient');
    expect(imageOrPlaceholder(undefined)).toContain('linear-gradient');
    expect(imageOrPlaceholder('')).toContain('linear-gradient');
    expect(imageOrPlaceholder('   ')).toContain('linear-gradient');
  });
});

// ─── formatPropertyType ─────────────────────────────────────────────────────

describe('formatPropertyType', () => {
  it('capitalizes first letter', () => {
    expect(formatPropertyType('residential')).toBe('Residential');
    expect(formatPropertyType('land')).toBe('Land');
  });

  it('returns empty for falsy', () => {
    expect(formatPropertyType('')).toBe('');
  });
});

// ─── formatHearingFormat ────────────────────────────────────────────────────

describe('formatHearingFormat', () => {
  it('maps known formats', () => {
    expect(formatHearingFormat('in_person')).toBe('In Person');
    expect(formatHearingFormat('virtual')).toBe('Virtual');
    expect(formatHearingFormat('both')).toBe('In Person or Virtual');
    expect(formatHearingFormat('written_only')).toBe('Written Submission Only');
  });

  it('returns N/A for null', () => {
    expect(formatHearingFormat(null)).toBe('N/A');
  });

  it('passes through unknown values', () => {
    expect(formatHearingFormat('something_new')).toBe('something_new');
  });
});

// ─── safeVal ────────────────────────────────────────────────────────────────

describe('safeVal', () => {
  it('returns value when present', () => {
    expect(safeVal(42, 0)).toBe(42);
    expect(safeVal('hello', '')).toBe('hello');
  });

  it('returns fallback for null or undefined', () => {
    expect(safeVal(null, 'default')).toBe('default');
    expect(safeVal(undefined, 99)).toBe(99);
  });

  it('returns 0 and empty string as valid values', () => {
    expect(safeVal(0, 99)).toBe(0);
    expect(safeVal('', 'fallback')).toBe('');
  });
});

// ─── fullAddress ────────────────────────────────────────────────────────────

describe('fullAddress', () => {
  it('builds address without line2', () => {
    expect(fullAddress('123 Main St', null, 'Springfield', 'IL', '62704')).toBe(
      '123 Main St, Springfield, IL 62704'
    );
  });

  it('includes line2 when present', () => {
    expect(fullAddress('123 Main St', 'Apt 4B', 'Chicago', 'IL', '60601')).toBe(
      '123 Main St, Apt 4B, Chicago, IL 60601'
    );
  });
});

// ─── adjustmentLabel ────────────────────────────────────────────────────────

describe('adjustmentLabel', () => {
  it('returns known labels', () => {
    expect(adjustmentLabel('lot_size')).toBe('Lot Size');
    expect(adjustmentLabel('sale_price')).toBe('Sale Price');
    expect(adjustmentLabel('heating_cooling')).toBe('Heating / Cooling');
  });

  it('title-cases unknown keys', () => {
    expect(adjustmentLabel('custom_field')).toBe('Custom Field');
  });
});
