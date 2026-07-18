'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { useWizard } from '@/components/intake/WizardLayout';
import { trackFunnelEventOnce } from '@/lib/analytics/funnel-client';
import { buildSafeFunnelProperties } from '@/lib/analytics/funnel-contract';
import type { ServiceType } from '@/types/database';

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

export default function FunnelAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, currentStep } = useWizard();

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
    trackFunnelEventOnce(
      'Resourceful Intake Step Viewed',
      pathname,
      {
        step: properties.step,
        step_number: properties.step_number,
      },
    );
  }, [pathname, properties.step, properties.step_number]);

  useEffect(() => {
    if (!serviceType) return;
    trackFunnelEventOnce('Resourceful Service Selected', serviceType, properties);
  }, [properties, serviceType]);

  useEffect(() => {
    if (currentStep < 3 || !state.address || !state.propertyType) return;
    trackFunnelEventOnce(
      'Resourceful Property Details Completed',
      `${serviceType ?? 'unknown'}:${state.propertyType}`,
      properties,
    );
  }, [currentStep, properties, serviceType, state.address, state.propertyType]);

  useEffect(() => {
    if (currentStep < 4 || !state.propertyType) return;
    trackFunnelEventOnce(
      'Resourceful Situation Completed',
      `${serviceType ?? 'unknown'}:${state.propertyType}`,
      properties,
    );
  }, [currentStep, properties, serviceType, state.propertyType]);

  useEffect(() => {
    if (!state.reportId || !state.clientSecret) return;
    trackFunnelEventOnce(
      'Resourceful Checkout Initialized',
      `${serviceType ?? 'unknown'}:${state.propertyType ?? 'unknown'}:${state.reviewTier}`,
      properties,
    );
  }, [properties, serviceType, state.clientSecret, state.propertyType, state.reportId, state.reviewTier]);

  useEffect(() => {
    if (state.photoCount <= 0) return;
    trackFunnelEventOnce('Resourceful Photo Evidence Added', 'added', properties);
  }, [properties, state.photoCount]);

  useEffect(() => {
    if (!state.photosSkipped) return;
    trackFunnelEventOnce('Resourceful Photo Evidence Skipped', 'skipped', properties);
  }, [properties, state.photosSkipped]);

  useEffect(() => {
    if (pathname !== '/start/success') return;
    trackFunnelEventOnce(
      'Resourceful Intake Success Viewed',
      serviceType ?? 'unknown',
      properties,
    );
  }, [pathname, properties, serviceType]);

  return null;
}
