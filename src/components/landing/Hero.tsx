'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParsedAddress {
  line1: string;
  city: string;
  state: string;
  zip: string;
  county: string;
}

interface ValuationResult {
  assessedValue: number;
  estimatedOverassessment: number;
  estimatedAnnualSavings: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDollar(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function parseAddressComponents(place: google.maps.places.PlaceResult): ParsedAddress | null {
  const components = place.address_components;
  if (!components) return null;

  let streetNumber = '';
  let route = '';
  let city = '';
  let state = '';
  let zip = '';
  let county = '';

  for (const c of components) {
    const t = c.types[0];
    if (t === 'street_number') streetNumber = c.long_name;
    else if (t === 'route') route = c.long_name;
    else if (t === 'locality') city = c.long_name;
    else if (t === 'administrative_area_level_1') state = c.short_name;
    else if (t === 'postal_code') zip = c.long_name;
    else if (t === 'administrative_area_level_2')
      county = c.long_name.replace(/ County$| Parish$| Borough$/i, '');
  }

  const line1 = [streetNumber, route].filter(Boolean).join(' ');
  if (!line1) return null;

  return { line1, city, state, zip, county };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Hero() {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [address, setAddress] = useState<ParsedAddress | null>(null);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  // Static fallback values
  const staticValues = { assessed: 320000, market: 265000, overpayment: 1180 };

  const displayAssessed = hasResult && valuation ? valuation.assessedValue : staticValues.assessed;
  const displayMarket = hasResult && valuation
    ? valuation.assessedValue - valuation.estimatedOverassessment
    : staticValues.market;
  const displayOverpayment = hasResult && valuation
    ? (valuation.estimatedAnnualSavings ?? staticValues.overpayment)
    : staticValues.overpayment;

  const ctaHref = address
    ? `/start?address=${encodeURIComponent(JSON.stringify(address))}`
    : '/start';

  const fetchValuation = useCallback(async (addr: ParsedAddress) => {
    setLoading(true);
    try {
      const res = await fetch('/api/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: addr.line1,
          city: addr.city,
          state: addr.state,
          county: addr.county || undefined,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      setValuation({
        assessedValue: data.assessedValue,
        estimatedOverassessment: data.estimatedOverassessment,
        estimatedAnnualSavings: data.estimatedAnnualSavings,
      });
      setHasResult(true);
    } catch {
      // Silently fall back to static display
      setHasResult(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!inputRef.current || autocompleteRef.current) return;
    if (typeof google === 'undefined' || !google.maps?.places) return;

    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'us' },
      types: ['address'],
      fields: ['address_components', 'formatted_address'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const parsed = parseAddressComponents(place);
      if (parsed) {
        setAddress(parsed);
        fetchValuation(parsed);
      }
    });

    autocompleteRef.current = ac;
  }, [fetchValuation]);

  // Retry init when Google Maps loads after mount
  useEffect(() => {
    if (autocompleteRef.current) return;
    const timer = setInterval(() => {
      if (typeof google !== 'undefined' && google.maps?.places && inputRef.current) {
        clearInterval(timer);
        // Re-trigger the effect
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'us' },
          types: ['address'],
          fields: ['address_components', 'formatted_address'],
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          const parsed = parseAddressComponents(place);
          if (parsed) {
            setAddress(parsed);
            fetchValuation(parsed);
          }
        });
        autocompleteRef.current = ac;
      }
    }, 500);
    return () => clearInterval(timer);
  }, [fetchValuation]);

  return (
    <section className="relative overflow-hidden bg-pattern bg-noise">
      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-deep via-navy-deep/95 to-navy-deep" />

      {/* Decorative gold gradient orb */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[600px] w-[600px] animate-float rounded-full opacity-25"
        style={{
          background: 'radial-gradient(circle, rgba(212,168,71,0.3) 0%, rgba(212,168,71,0.08) 40%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[700px] w-[700px] animate-float rounded-full opacity-35"
        style={{
          background: 'radial-gradient(circle, rgba(30,48,85,0.6) 0%, rgba(30,48,85,0.2) 40%, transparent 70%)',
          filter: 'blur(100px)',
          animationDelay: '3s',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-36 pb-28">
        {/* Eyebrow */}
        <div className="mb-8 flex items-center gap-3 animate-fade-in">
          <span className="h-px w-12 bg-gradient-to-r from-gold/60 to-transparent" />
          <span className="text-sm font-medium tracking-widest text-gold/80 uppercase">
            Property Tax Intelligence
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl leading-[1.08] text-cream max-w-4xl">
          <span className="inline-block animate-fade-in" style={{ animationDelay: '0.1s' }}>Stop </span>
          <span className="inline-block animate-fade-in" style={{ animationDelay: '0.25s' }}>Overpaying </span>
          <span className="inline-block text-gold-gradient animate-fade-in" style={{ animationDelay: '0.4s' }}>Property </span>
          <span className="inline-block text-gold-gradient animate-fade-in" style={{ animationDelay: '0.55s' }}>Taxes</span>
        </h1>

        <p
          className="mt-7 max-w-2xl text-lg md:text-xl text-cream/55 leading-relaxed animate-fade-in"
          style={{ animationDelay: '0.6s' }}
        >
          We compare your home to 5&ndash;10 similar recent sales and adjust for every difference &mdash;
          the same method licensed appraisers use. Your full report with filing instructions
          is delivered in hours, not weeks.
        </p>

        {/* Address input */}
        <div className="mt-10 max-w-xl animate-fade-in" style={{ animationDelay: '0.7s' }}>
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold/50 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter your property address..."
              className="w-full bg-navy-light/60 border border-gold/20 rounded-xl pl-12 pr-4 py-4 text-cream placeholder:text-cream/30 focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20 transition-all text-base"
            />
          </div>
        </div>

        {/* Value display */}
        <div className="mt-8 flex flex-wrap gap-8 items-end animate-fade-in" style={{ animationDelay: '0.75s' }}>
          <div className="card-premium border-gradient rounded-xl px-8 py-7 animate-glow">
            <div className="grid grid-cols-3 gap-8 md:gap-12 text-center">
              {loading ? (
                /* Skeleton loader */
                <>
                  {[0, 1, 2].map((i) => (
                    <div key={i}>
                      <div className="h-3 w-20 mx-auto bg-cream/10 rounded animate-pulse mb-3" />
                      <div className="h-7 w-28 mx-auto bg-cream/10 rounded animate-pulse" />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className={`transition-all duration-500 ${hasResult ? 'opacity-100 translate-y-0' : ''}`}>
                    <p className="text-[10px] md:text-xs uppercase tracking-wider text-cream/35 mb-1.5">
                      Assessed Value
                    </p>
                    <p className="font-display text-xl md:text-2xl text-cream">
                      {formatDollar(displayAssessed)}
                    </p>
                  </div>
                  <div className={`transition-all duration-500 delay-100 ${hasResult ? 'opacity-100 translate-y-0' : ''}`}>
                    <p className="text-[10px] md:text-xs uppercase tracking-wider text-cream/35 mb-1.5">
                      Estimated Market Value
                    </p>
                    <p className="font-display text-xl md:text-2xl text-gold">
                      {formatDollar(displayMarket)}
                    </p>
                  </div>
                  <div className={`transition-all duration-500 delay-200 ${hasResult ? 'opacity-100 translate-y-0' : ''}`}>
                    <p className="text-[10px] md:text-xs uppercase tracking-wider text-cream/35 mb-1.5">
                      Annual Overpayment
                    </p>
                    <p className="font-display text-xl md:text-2xl text-red-400">
                      {formatDollar(displayOverpayment)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 animate-fade-in" style={{ animationDelay: '0.9s' }}>
          <Link
            href={ctaHref}
            className="btn-glow animate-glow inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-gold-light via-gold to-gold-dark px-8 py-4 text-lg font-semibold text-navy-deep shadow-gold hover:shadow-gold-lg transition-all duration-300 hover:scale-[1.02] hover:brightness-110"
          >
            {hasResult ? 'Get My Full Report' : 'Get My Property Report'}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="mt-4 text-xs text-cream/30">
            No account needed &middot; Results in minutes
          </p>
        </div>
      </div>
    </section>
  );
}
