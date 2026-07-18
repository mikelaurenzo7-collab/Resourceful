import type { ReportTemplateData } from '@/lib/templates/report-template';
import type { CountyRule, PropertyData, Report } from '@/types/database';
import {
  dateOnly,
  type ValuationEffectiveDateSource,
} from './valuation-date-policy';

export const EVIDENCE_SOURCE_TYPES = [
  'owner_statement',
  'photograph',
  'public_record',
  'licensed_data',
  'calculation',
  'assumption',
  'professional_judgment',
] as const;

export type EvidenceSourceType = typeof EVIDENCE_SOURCE_TYPES[number];

const VALUATION_EFFECTIVE_DATE_SOURCES = [
  'intake_current_date',
  'jurisdiction_convention',
  'user_supplied',
  'admin_override',
] as const satisfies readonly ValuationEffectiveDateSource[];

interface ReportWorkfileFields {
  is_retrospective_assignment?: boolean | null;
  valuation_effective_date?: string | null;
  valuation_effective_date_source?: string | null;
}

interface PropertyWorkfileFields {
  unit_count?: number | null;
  unit_count_source_type?: string | null;
  unit_count_source_reference?: string | null;
  regulatory_source_authority?: string | null;
  regulatory_source_url?: string | null;
  property_class_source_authority?: string | null;
  property_class_source_url?: string | null;
}

interface CountyRulePluginFields {
  jurisdiction_plugin_key?: string | null;
  jurisdiction_plugin_version?: number | null;
}

export interface ValuationEffectiveDateEvidence {
  date: string | null;
  source: ValuationEffectiveDateSource | null;
  isVerified: boolean;
}

export interface UnitCountEvidence {
  count: number | null;
  sourceType: EvidenceSourceType | null;
  sourceReference: string | null;
  isVerified: boolean;
}

export interface OfficialSourceEvidence {
  authority: string | null;
  url: string | null;
  isVerified: boolean;
}

export interface JurisdictionPlugin {
  key: string;
  version: number;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asReportWorkfile(data: ReportTemplateData): Report & ReportWorkfileFields {
  return data.report as Report & ReportWorkfileFields;
}

function asPropertyWorkfile(data: ReportTemplateData): PropertyData & PropertyWorkfileFields {
  return data.property as PropertyData & PropertyWorkfileFields;
}

export function isHttpUrl(value: string | null | undefined): boolean {
  if (!hasText(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isRetrospectiveAssignment(data: ReportTemplateData): boolean {
  return asReportWorkfile(data).is_retrospective_assignment === true;
}

export function getValuationEffectiveDateEvidence(
  data: ReportTemplateData
): ValuationEffectiveDateEvidence {
  const report = asReportWorkfile(data);
  const date = dateOnly(report.valuation_effective_date);
  const source = VALUATION_EFFECTIVE_DATE_SOURCES.includes(
    report.valuation_effective_date_source as ValuationEffectiveDateSource
  )
    ? report.valuation_effective_date_source as ValuationEffectiveDateSource
    : null;

  return {
    date,
    source,
    isVerified: date != null && source != null,
  };
}

export function getUnitCountEvidence(data: ReportTemplateData): UnitCountEvidence {
  const property = asPropertyWorkfile(data);
  const count =
    typeof property.unit_count === 'number' && Number.isInteger(property.unit_count) && property.unit_count > 0
      ? property.unit_count
      : null;
  const sourceType = EVIDENCE_SOURCE_TYPES.includes(
    property.unit_count_source_type as EvidenceSourceType
  )
    ? property.unit_count_source_type as EvidenceSourceType
    : null;
  const sourceReference = hasText(property.unit_count_source_reference)
    ? property.unit_count_source_reference.trim()
    : null;

  return {
    count,
    sourceType,
    sourceReference,
    isVerified: count != null && sourceType != null && sourceReference != null,
  };
}

function officialSource(
  authority: string | null | undefined,
  url: string | null | undefined
): OfficialSourceEvidence {
  const normalizedAuthority = hasText(authority) ? authority.trim() : null;
  const normalizedUrl = hasText(url) ? url.trim() : null;
  return {
    authority: normalizedAuthority,
    url: normalizedUrl,
    isVerified: normalizedAuthority != null && isHttpUrl(normalizedUrl),
  };
}

export function getRegulatorySourceEvidence(data: ReportTemplateData): OfficialSourceEvidence {
  const property = asPropertyWorkfile(data);
  return officialSource(property.regulatory_source_authority, property.regulatory_source_url);
}

export function getClassificationSourceEvidence(data: ReportTemplateData): OfficialSourceEvidence {
  const property = asPropertyWorkfile(data);
  return officialSource(
    property.property_class_source_authority,
    property.property_class_source_url
  );
}

export function getJurisdictionPlugin(
  countyRule: CountyRule | null | undefined
): JurisdictionPlugin | null {
  if (!countyRule) return null;
  const rule = countyRule as CountyRule & CountyRulePluginFields;
  const key = hasText(rule.jurisdiction_plugin_key)
    ? rule.jurisdiction_plugin_key.trim()
    : null;
  const version =
    typeof rule.jurisdiction_plugin_version === 'number' &&
    Number.isInteger(rule.jurisdiction_plugin_version) &&
    rule.jurisdiction_plugin_version > 0
      ? rule.jurisdiction_plugin_version
      : null;

  return key != null && version != null ? { key, version } : null;
}

export function isCookCountyJurisdiction(
  countyRule: CountyRule | null | undefined
): boolean {
  const plugin = getJurisdictionPlugin(countyRule);
  return plugin?.key === 'cook_county_classification' && plugin.version >= 1;
}
