import type { ReportTemplateData } from '@/lib/templates/report-template';
import type {
  CountyRule,
  EvidenceSourceType,
  ValuationEffectiveDateSource,
} from '@/types/database';
import { dateOnly } from './valuation-date-policy';

export const EVIDENCE_SOURCE_TYPES = [
  'owner_statement',
  'photograph',
  'public_record',
  'licensed_data',
  'calculation',
  'assumption',
  'professional_judgment',
] as const satisfies readonly EvidenceSourceType[];

const VALUATION_EFFECTIVE_DATE_SOURCES = [
  'intake_current_date',
  'jurisdiction_convention',
  'user_supplied',
  'admin_override',
] as const satisfies readonly ValuationEffectiveDateSource[];

type JurisdictionPluginRule = Pick<
  CountyRule,
  'jurisdiction_plugin_key' | 'jurisdiction_plugin_version'
>;

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
  return data.report.is_retrospective_assignment === true;
}

export function getValuationEffectiveDateEvidence(
  data: ReportTemplateData
): ValuationEffectiveDateEvidence {
  const date = dateOnly(data.report.valuation_effective_date);
  const storedSource = data.report.valuation_effective_date_source;
  const source = storedSource != null && VALUATION_EFFECTIVE_DATE_SOURCES.includes(storedSource)
    ? storedSource
    : null;

  return {
    date,
    source,
    isVerified: date != null && source != null,
  };
}

export function getUnitCountEvidence(data: ReportTemplateData): UnitCountEvidence {
  const storedCount = data.property.unit_count;
  const count =
    typeof storedCount === 'number' && Number.isInteger(storedCount) && storedCount > 0
      ? storedCount
      : null;
  const storedSourceType = data.property.unit_count_source_type;
  const sourceType = storedSourceType != null && EVIDENCE_SOURCE_TYPES.includes(storedSourceType)
    ? storedSourceType
    : null;
  const sourceReference = hasText(data.property.unit_count_source_reference)
    ? data.property.unit_count_source_reference.trim()
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
  return officialSource(
    data.property.regulatory_source_authority,
    data.property.regulatory_source_url
  );
}

export function getClassificationSourceEvidence(data: ReportTemplateData): OfficialSourceEvidence {
  return officialSource(
    data.property.property_class_source_authority,
    data.property.property_class_source_url
  );
}

export function getJurisdictionPlugin(
  countyRule: JurisdictionPluginRule | null | undefined
): JurisdictionPlugin | null {
  if (!countyRule) return null;
  const key = hasText(countyRule.jurisdiction_plugin_key)
    ? countyRule.jurisdiction_plugin_key.trim()
    : null;
  const version =
    typeof countyRule.jurisdiction_plugin_version === 'number' &&
    Number.isInteger(countyRule.jurisdiction_plugin_version) &&
    countyRule.jurisdiction_plugin_version > 0
      ? countyRule.jurisdiction_plugin_version
      : null;

  return key != null && version != null ? { key, version } : null;
}

export function isCookCountyJurisdiction(
  countyRule: JurisdictionPluginRule | null | undefined
): boolean {
  const plugin = getJurisdictionPlugin(countyRule);
  return plugin?.key === 'cook_county_classification' && plugin.version >= 1;
}
