'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ParsedAddress {
  line1: string;
  city: string;
  state: string;
  zip: string;
  county: string;
}

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

interface RecordCheckResult {
  recordFound: boolean;
  assessedValue?: number | null;
  taxAmount?: number | null;
  assessmentYear?: string | number | null;
  countyName?: string | null;
  appealDeadlineRule?: string | null;
  message: string;
}

function formatDollar(value: number | null | undefined): string {
  if (!value || value <= 0) return 'Not available';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordAbortRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [address, setAddress] = useState<ParsedAddress | null>(null);
  const [record, setRecord] = useState<RecordCheckResult | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/address-search?q=${encodeURIComponent(value.trim())}`);
      if (!response.ok) throw new Error('Address search unavailable');
      const data = await response.json();
      const nextSuggestions = (data.suggestions ?? []) as AddressSuggestion[];
      setSuggestions(nextSuggestions);
      setShowSuggestions(nextSuggestions.length > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const checkRecord = useCallback(async (selectedAddress: ParsedAddress) => {
    recordAbortRef.current?.abort();
    const controller = new AbortController();
    recordAbortRef.current = controller;

    setRecordLoading(true);
    setRecord(null);
    try {
      const response = await fetch('/api/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: selectedAddress.line1,
          city: selectedAddress.city,
          state: selectedAddress.state,
          county: selectedAddress.county || undefined,
        }),
        signal: controller.signal,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Property record check unavailable');
      }
      setRecord(data as RecordCheckResult);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setRecord({
        recordFound: false,
        message: 'The public-record check is temporarily unavailable. You can still start a case with your tax bill or parcel number.',
      });
    } finally {
      if (!controller.signal.aborted) setRecordLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // A selected canonical address should remain stable. Without this guard,
    // setting the input to the selected formatted address immediately schedules
    // another autocomplete request and can reopen the suggestion list over the
    // public-record result card.
    if (address) {
      setIsSearching(false);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [address, fetchSuggestions, query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => () => recordAbortRef.current?.abort(), []);

  const selectAddress = (suggestion: AddressSuggestion) => {
    const line1 = [suggestion.streetNumber, suggestion.route].filter(Boolean).join(' ');
    const parsed: ParsedAddress = {
      line1: line1 || suggestion.formattedAddress,
      city: suggestion.city ?? '',
      state: suggestion.state ?? '',
      zip: suggestion.zip ?? '',
      county: suggestion.county ?? '',
    };

    setQuery(suggestion.formattedAddress);
    setAddress(parsed);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    void checkRecord(parsed);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectAddress(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const ctaHref = address
    ? `/start?address=${encodeURIComponent(JSON.stringify(address))}`
    : '/start';

  return (
    <section className="relative overflow-hidden bg-aurora">
      <div className="absolute inset-0 z-[1] bg-pattern opacity-40 pointer-events-none" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-navy-deep/60 via-navy-deep/80 to-navy-deep pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32 sm:pb-28 sm:pt-36">
        <div className="text-center">
          <div className="mb-6 flex items-center justify-center gap-3 animate-fade-in sm:mb-8">
            <span className="h-px w-8 bg-gradient-to-r from-transparent via-gold/60 to-transparent sm:w-12" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/70 sm:text-xs">
              AI-assisted property tax appeals
            </span>
            <span className="h-px w-8 bg-gradient-to-r from-transparent via-gold/60 to-transparent sm:w-12" />
          </div>

          <h1
            className="mx-auto max-w-5xl animate-fade-in font-display text-4xl leading-[1.08] tracking-tight text-cream sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ animationDelay: '0.15s' }}
          >
            Build a stronger case for a
            <br className="hidden sm:block" />
            <span className="font-mixed-italic text-gold"> fair property assessment.</span>
          </h1>

          <p
            className="mx-auto mt-6 max-w-3xl animate-fade-in text-base leading-relaxed text-cream/65 sm:mt-8 sm:text-lg md:text-xl"
            style={{ animationDelay: '0.35s' }}
          >
            Resourceful assembles property records, relevant comparable sales, condition evidence,
            and county-specific filing guidance into one reviewable appeal package. Every case stays
            human-reviewed before delivery.
          </p>

          <div
            className="mx-auto mt-9 max-w-2xl animate-fade-in sm:mt-11"
            style={{ animationDelay: '0.5s' }}
          >
            <div ref={containerRef} className="relative group">
              <label htmlFor="hero-property-address" className="sr-only">
                Property address
              </label>
              <svg
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gold/45 transition-colors group-focus-within:text-gold/80"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657 13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <input
                id="hero-property-address"
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setAddress(null);
                  setRecord(null);
                  setActiveIndex(-1);
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                placeholder="Enter the property address"
                className="w-full rounded-xl border border-cream/[0.12] bg-navy-light/65 py-4 pl-12 pr-28 text-base text-cream placeholder:text-cream/40 transition-all focus:border-gold/55 focus:bg-navy-light/85 focus:outline-none focus:ring-2 focus:ring-gold/25"
                autoComplete="off"
                role="combobox"
                aria-controls={showSuggestions ? 'hero-address-listbox' : undefined}
                aria-expanded={showSuggestions}
                aria-autocomplete="list"
                aria-activedescendant={activeIndex >= 0 ? `hero-suggestion-${activeIndex}` : undefined}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-cream/40">
                {isSearching ? 'Searching…' : 'Public record check'}
              </span>

              {showSuggestions && suggestions.length > 0 && (
                <ul
                  id="hero-address-listbox"
                  className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-gold/20 bg-navy-deep/95 text-left shadow-xl backdrop-blur-sm"
                  role="listbox"
                >
                  {suggestions.map((suggestion, index) => (
                    <li key={`${suggestion.formattedAddress}-${index}`}>
                      <button
                        id={`hero-suggestion-${index}`}
                        type="button"
                        className={`w-full border-b border-gold/5 px-4 py-3 text-left text-sm text-cream transition-colors last:border-0 ${
                          index === activeIndex ? 'bg-gold/15' : 'hover:bg-gold/10'
                        }`}
                        onMouseDown={() => selectAddress(suggestion)}
                        onMouseEnter={() => setActiveIndex(index)}
                        role="option"
                        aria-selected={index === activeIndex}
                      >
                        {suggestion.formattedAddress}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(recordLoading || record) && (
              <div className="mt-4 rounded-xl border border-cream/[0.1] bg-navy-light/55 p-5 text-left shadow-lg">
                {recordLoading ? (
                  <div className="flex items-center gap-3 text-sm text-cream/60" role="status">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
                    Checking available assessment records…
                  </div>
                ) : record?.recordFound ? (
                  <>
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
                          Public record found
                        </p>
                        <p className="mt-1 text-sm text-cream/55">
                          {record.countyName ?? address?.county ?? 'County record'}
                          {record.assessmentYear ? ` · ${record.assessmentYear} assessment` : ''}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                        Screening only
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-cream/[0.07] bg-navy-deep/35 p-4">
                        <p className="text-[11px] uppercase tracking-wider text-cream/35">Recorded assessment</p>
                        <p className="mt-1 font-display text-2xl text-cream">{formatDollar(record.assessedValue)}</p>
                      </div>
                      <div className="rounded-lg border border-cream/[0.07] bg-navy-deep/35 p-4">
                        <p className="text-[11px] uppercase tracking-wider text-cream/35">Recorded annual tax</p>
                        <p className="mt-1 font-display text-2xl text-cream">{formatDollar(record.taxAmount)}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-cream/45">{record.message}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-cream">A complete public record was not confirmed.</p>
                    <p className="mt-1 text-xs leading-relaxed text-cream/50">{record?.message}</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 animate-fade-in sm:mt-10" style={{ animationDelay: '0.65s' }}>
            <Link
              href={ctaHref}
              className="btn-glow inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-gold-light via-gold to-gold-dark px-9 py-4 text-base font-semibold text-navy-deep shadow-gold transition-all duration-300 hover:scale-[1.03] hover:brightness-110 hover:shadow-gold-lg"
            >
              Start my appeal review
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m17 8 4 4m0 0-4 4m4-4H3" />
              </svg>
            </Link>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-cream/45">
              <span>Independent comparable analysis</span>
              <span className="hidden text-cream/15 sm:inline">•</span>
              <span>Condition evidence included</span>
              <span className="hidden text-cream/15 sm:inline">•</span>
              <span>Human review before delivery</span>
            </div>
            <p className="mx-auto mt-3 max-w-2xl text-[11px] leading-relaxed text-cream/30">
              Screening does not guarantee appeal eligibility, a reduced assessment, or tax savings.
              Filing rules and deadlines vary by jurisdiction.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
