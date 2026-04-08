'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [placesLoaded, setPlacesLoaded] = useState(false);

  // Check if Google Maps Places API is available
  useEffect(() => {
    const checkGoogle = () => {
      if (typeof google !== 'undefined' && google.maps?.places) {
        setPlacesLoaded(true);
        return true;
      }
      return false;
    };

    if (checkGoogle()) return;

    // Poll for Google Maps to load (loaded via Script in layout)
    const interval = setInterval(() => {
      if (checkGoogle()) clearInterval(interval);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!initialAddress || query.trim()) return;
    setQuery(formatAddress(initialAddress));
  }, [initialAddress, query]);

  const handlePlaceSelect = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.address_components) return;

    let line1 = '';
    let city = '';
    let state = '';
    let zip = '';
    let county = '';
    let streetNumber = '';
    let route = '';

    for (const component of place.address_components) {
      const types = component.types;
      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (types.includes('route')) {
        route = component.long_name;
      } else if (types.includes('locality') || types.includes('sublocality_level_1')) {
        city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        state = component.short_name;
      } else if (types.includes('postal_code')) {
        zip = component.long_name;
      } else if (types.includes('administrative_area_level_2')) {
        // County — strip " County", " Parish", " Borough" suffix
        county = component.long_name
          .replace(/\s*(County|Parish|Borough)$/i, '')
          .trim();
      }
    }

    line1 = streetNumber ? `${streetNumber} ${route}` : route;

    if (line1 && city && state) {
      setQuery(place.formatted_address ?? line1);
      onAddressSelect({ line1, city, state, zip, county });
    }
  }, [onAddressSelect]);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!placesLoaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'us' },
      types: ['address'],
      fields: ['address_components', 'formatted_address'],
    });

    autocomplete.addListener('place_changed', handlePlaceSelect);
    autocompleteRef.current = autocomplete;
  }, [placesLoaded, handlePlaceSelect]);

  // Fallback for manual entry when Google Places isn't available
  const handleManualSubmit = () => {
    if (!query.trim()) return;
    // If Places API parsed it already, this won't be called.
    // For manual entry, provide the raw query as line1.
    onAddressSelect({
      line1: query.trim(),
      city: '',
      state: '',
      zip: '',
      county: '',
    });
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
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleManualSubmit();
            }
          }}
          placeholder="Start typing your property address..."
          className="flex-1 bg-transparent px-4 py-4 text-cream placeholder:text-cream/30 focus:outline-none"
        />
        <button
          onClick={handleManualSubmit}
          className="mr-2 rounded-md bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
        >
          Look Up
        </button>
      </div>
      <p className="mt-2 text-xs text-cream/30">
        {placesLoaded ? 'Powered by Google Places Autocomplete' : 'Enter your full property address'}
      </p>
    </div>
  );
}
