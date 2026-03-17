'use client';

import { useState } from 'react';

interface AddressInputProps {
  onAddressSelect: (address: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    county: string;
  }) => void;
}

export default function AddressInput({ onAddressSelect }: AddressInputProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Simulated autocomplete - will be replaced with Google Places
  const handleSubmit = () => {
    if (query.trim()) {
      onAddressSelect({
        line1: query || '1234 W Example St',
        city: 'Chicago',
        state: 'IL',
        zip: '60614',
        county: 'Cook',
      });
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-cream/80 mb-2">
        Property Address
      </label>
      <div
        className={`
          relative flex items-center rounded-lg border bg-navy-deep/60
          transition-all duration-200
          ${isFocused ? 'border-gold ring-2 ring-gold/15' : 'border-gold/20'}
        `}
      >
        <div className="pl-4 text-gold/60">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          placeholder="Start typing your property address..."
          className="flex-1 bg-transparent px-4 py-4 text-cream placeholder:text-cream/30 focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          className="mr-2 rounded-md bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
        >
          Look Up
        </button>
      </div>
      <p className="mt-2 text-xs text-cream/30">
        Powered by Google Places Autocomplete
      </p>
    </div>
  );
}
