'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface AddressSuggestion {
  formattedAddress: string;
  streetNumber: string | null;
  route: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  latitude: number;
  longitude: number;
}

interface AddressInputProps {
  onAddressSelect: (address: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    county: string;
  }) => void;
  initialAddress?: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    county: string;
  } | null;
}

function formatAddress(address: NonNullable<AddressInputProps['initialAddress']>): string {
  const locality = [address.city, address.state].filter(Boolean).join(', ');
  const localityWithZip = [locality, address.zip].filter(Boolean).join(' ');
  return [address.line1, localityWithZip].filter(Boolean).join(', ');
}

export default function AddressInput({ onAddressSelect, initialAddress = null }: AddressInputProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);


  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions from our server-side Azure Maps proxy
  const fetchSuggestions = useCallback(async (q: string) => {
    setIsSearching(true);
    setIsSearching(true);
    if (q.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }
    try {
      const res = await fetch(`/api/address-search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setIsSearching(false);
      setIsSearching(false);
      setShowSuggestions(true);
    } catch {
      // Silent — autocomplete is non-critical
    }
  }, []);

  // Pre-fill input if initialAddress is provided
  useEffect(() => {
    if (!initialAddress || query.trim()) return;
    setQuery(formatAddress(initialAddress));
  }, [initialAddress, query]);

  // Debounced search on input change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (s: AddressSuggestion) => {
    const line1 = [s.streetNumber, s.route].filter(Boolean).join(' ');
    setQuery(s.formattedAddress);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
    onAddressSelect({
      line1: line1 || s.formattedAddress,
      city: s.city ?? '',
      state: s.state ?? '',
      zip: s.zip ?? '',
      county: s.county ?? '',
    });
  };

  const handleManualSubmit = () => {
    if (!query.trim()) return;
    if (suggestions.length > 0) {
      handleSelect(activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0]);
      return;
    }
    onAddressSelect({
      line1: query.trim(),
      city: '',
      state: '',
      zip: '',
      county: '',
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') { e.preventDefault(); handleManualSubmit(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) handleSelect(suggestions[activeIndex]);
      else handleManualSubmit();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="block text-sm font-medium text-cream/80 mb-2">
        Property Address
      </label>
      <div
        className={`
          relative flex items-center rounded-lg border bg-navy-deep/60
          transition-all duration-200
          ${isFocused ? 'border-gold ring-2 ring-gold/40' : 'border-gold/20'}
        `}
      >
        <div className="pl-4 text-gold/60">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
          onFocus={() => { setIsFocused(true); if (suggestions.length) setShowSuggestions(true); }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing your property address..."
          className="flex-1 bg-transparent px-4 py-4 text-cream placeholder:text-cream/40 focus:outline-none"
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-autocomplete="list"
          aria-controls="address-input-listbox"
          aria-activedescendant={activeIndex >= 0 ? `address-option-${activeIndex}` : undefined}
        />
        {isSearching ? (
          <div className="mr-4 scanner-container transform scale-[0.6] opacity-70">
            <div className="scanner-ring" />
            <div className="scanner-progress" />
            <div className="scanner-dot" />
          </div>
        ) : (
          <button
            onClick={handleManualSubmit}
            className="mr-2 rounded-md bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
          >
            Look Up
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <ul id="address-input-listbox" className="absolute z-50 mt-1 w-full max-w-lg rounded-lg border border-gold/20 bg-navy-deep/95 backdrop-blur-sm shadow-xl overflow-hidden" role="listbox">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                id={`address-option-${i}`}
                type="button"
                className={`w-full text-left px-4 py-3 text-sm text-cream transition-colors border-b border-gold/5 last:border-0 ${
                  i === activeIndex ? 'bg-gold/15' : 'hover:bg-gold/10'
                }`}
                onMouseDown={() => handleSelect(s)}
                onMouseEnter={() => setActiveIndex(i)}
                role="option"
                aria-selected={i === activeIndex}
              >
                {s.formattedAddress}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-cream/50">
        Enter your full property address
      </p>
    </div>
  );
}
