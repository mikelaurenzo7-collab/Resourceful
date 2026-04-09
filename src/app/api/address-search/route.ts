// ─── Address Autocomplete API Route ──────────────────────────────────────────
// Server-side proxy for Azure Maps Fuzzy Search. The subscription key stays
// server-only; the client sends the user's query string and receives
// structured address suggestions.

import { NextRequest, NextResponse } from 'next/server';
import { searchAddresses } from '@/lib/services/azure-maps';
import { applyRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // Rate limit: 30 address lookups per minute per IP (each call costs Azure Maps credits)
  const rateLimitResponse = await applyRateLimit(request, {
    prefix: 'address-search',
    limit: 30,
    windowSeconds: 60,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.trim().length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await searchAddresses(query.trim(), 5);
  return NextResponse.json({ suggestions });
}
