'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { track } from '@vercel/analytics';

import { useWizard } from '@/components/intake/WizardLayout';
import {
  buildSafeFunnelProperties,
  createFunnelFingerprint,
  type FunnelEventName,
  type SafeFunnelProperties,
} from '@/lib/analytics/funnel-contract';
import type { ServiceType } from '@/types/database';

const TRACKED_SESSION_PREFIX = 'resourceful:funnel:';
const SAFE_SERVICE_TYPES = new Set<ServiceType>(['tax_appeal', 'pre_purchase', 'pre_listing']);

function resolveServiceType(
  stateServiceType: ServiceType | null,
  queryServiceType: string | null,
): ServiceType | null {
  if (stateServiceType) return stateServiceType;
  return queryServiceType && SAFE_SERVICE_TYPES.has(queryServiceType as ServiceType)
    ? queryServiceType as ServiceType
    : null;
}

function safelyTrackOnce(
  tracked: Set<string>,
  eventName: FunnelEventName,
  properties: SafeFunnelProperties,
) {
  const fingerprint = createFunnelFingerprint(eventName, properties);
  const storageKey = `${TRACKED_SESSION_PREFIX}${fingerprint}`;

  if (tracked.has(fingerprint)) return;

  try {
    if (sessionStorage.getItem(storageKey)) {
      tracked.add(fingerprint);
      return;
    }

    track(eventName, properties);
    sessionStorage.setItem(storageKey, '1');
    tracked.add(fingerprint);
  } catch {
    // Analytics must never interrupt intake, checkout, or delivery.
  }
}

export default function FunnelAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, currentStep } = useWizard();
  const trackedRef = useRef(new Set<string>());

  const serviceType = resolveServiceType(state.serviceType, searchParams.get('serviceType'));
  const properties = useMemo(
    () => buildSafeFunnelProperties({
      pathname,
      currentStep,
      serviceType,
      propertyType: state.propertyType,
      reviewTier: state.reviewTier,
      hasTaxBill: state.hasTaxBill,
      photoCount: state.photoCount,
      photosSkipped: state.photosSkipped,
      propertyIssueCount: state.propertyIssues.length,
      priceCents: state.priceCents,
      hasContext: state.desiredOutcome.trim().length > 0,
    }),
    [
      currentStep,
      pathname,
      serviceType,
      state.desiredOutcome,
      state.hasTaxBill,
      state.photoCount,
      state.photosSkipped,
      state.priceCents,
      state.propertyIssues.length,
      state.propertyType,
      state.reviewTier,
    ],
  );

  useEffect(() => {
    safelyTrackOnce(trackedRef.current, 'Resourceful Intake Step Viewed', properties);
  }, [properties]);

  useEffect(() => {
    if (!serviceType) return;
    safelyTrackOnce(trackedRef.current, 'Resourceful Service Selected', properties);
  }, [properties, serviceType]);

  useEffect(() => {
    if (!state.address || !state.propertyType) return;
    safelyTrackOnce(trackedRef.current, 'Resourceful Property Details Completed', properties);
  }, [properties, state.address, state.propertyType]);

  useEffect(() => {
    if (currentStep < 4 || !state.propertyType) return;
    safelyTrackOnce(trackedRef.current, 'Resourceful Situation Completed', properties);
  }, [currentStep, properties, state.propertyType]);

  useEffect(() => {
    if (!state.reportId || !state.clientSecret) return;
    safelyTrackOnce(trackedRef.current, 'Resourceful Checkout Initialized', properties);
  }, [properties, state.clientSecret, state.reportId]);

  useEffect(() => {
    if (state.photoCount <= 0) return;
    safelyTrackOnce(trackedRef.current, 'Resourceful Photo Evidence Added', properties);
  }, [properties, state.photoCount]);

  useEffect(() => {
    if (!state.photosSkipped) return;
    safelyTrackOnce(trackedRef.current, 'Resourceful Photo Evidence Skipped', properties);
  }, [properties, state.photosSkipped]);

  useEffect(() => {
    if (pathname !== '/start/success') return;
    safelyTrackOnce(trackedRef.current, 'Resourceful Intake Success Viewed', properties);
  }, [pathname, properties]);

  return null;
}
