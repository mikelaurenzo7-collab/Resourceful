// ─── Address Autocomplete API Route ──────────────────────────────────────────
// Server-side proxy for Azure Maps Fuzzy Search. The subscription key stays
// server-only; the client sends the user's query string and receives
// structured address suggestions.

import { NextResponse } from 'next/server';
import { searchAddresses } from '@/lib/services/azure-maps';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.trim().length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await searchAddresses(query.trim(), 5);
  return NextResponse.json({ suggestions });
}
