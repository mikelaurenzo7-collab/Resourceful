'use client';

import { track } from '@vercel/analytics';

import type {
  FunnelEventName,
  SafeFunnelProperties,
} from '@/lib/analytics/funnel-contract';

const TRACKED_SESSION_PREFIX = 'resourceful:funnel:';

export function trackFunnelEventOnce(
  eventName: FunnelEventName,
  milestoneIdentity: string,
  properties: SafeFunnelProperties,
): void {
  const fingerprint = `${eventName}:${milestoneIdentity}`;
  const storageKey = `${TRACKED_SESSION_PREFIX}${fingerprint}`;

  try {
    if (sessionStorage.getItem(storageKey)) return;

    track(eventName, properties);
    sessionStorage.setItem(storageKey, '1');
  } catch {
    // Analytics is deliberately fail-open and must never interrupt product flow.
  }
}
