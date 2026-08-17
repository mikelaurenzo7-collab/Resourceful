import type { PropertyType, ServiceType } from '@/types/database';

/**
 * Income analysis is potentially relevant to income-producing residential,
 * commercial, industrial, and agricultural assignments. Stage 3 performs the
 * finer-grained evidence and subtype checks before admitting the approach.
 */
export function shouldSkipIncomeStage(
  propertyType: PropertyType,
  _serviceType: ServiceType
): boolean {
  return (
    propertyType !== 'commercial' &&
    propertyType !== 'industrial' &&
    propertyType !== 'residential' &&
    propertyType !== 'agricultural'
  );
}

/**
 * Stage 6 is not tax-appeal-only. It generates county filing guidance for tax
 * appeals and assignment-specific next-step guidance for purchase/listing work.
 */
export function shouldSkipGuidanceStage(
  _propertyType: PropertyType,
  _serviceType: ServiceType
): boolean {
  return false;
}
