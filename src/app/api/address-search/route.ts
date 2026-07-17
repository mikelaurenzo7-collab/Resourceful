// ─── Address Search API Route ─────────────────────────────────────────────────
// Server-side proxy for Resourceful's location provider stack. Google Maps is
// primary, with bounded fallbacks; provider credentials never reach the client.

import { NextRequest, NextResponse } from 'next/server';
import { searchAddresses } from '@/lib/services/azure-maps';
import { applyRateLimit } from '@/lib/rate-limit';
import { apiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Limit provider usage and automated enumeration while keeping typeahead useful.
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

  try {
    const suggestions = await searchAddresses(query.trim(), 5);
    return NextResponse.json({ suggestions });
  } catch (err) {
    apiLogger.error(
      { err: err instanceof Error ? err.message : err },
      '[address-search] Location lookup failed'
    );
    return NextResponse.json({ suggestions: [] });
  }
}
