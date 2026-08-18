import type { ReportTemplateData } from '@/lib/templates/report-template';
import { isRetrospectiveAssignment } from './workfile-provenance';

export type NationwideReportIntegrityCode =
  | 'MUNICIPALITY_TEMPLATE_LEAK'
  | 'COUNTY_TEMPLATE_LEAK'
  | 'LOCALITY_REFERENCE_MISSING'
  | 'MARKET_GEOGRAPHY_REVIEW_REQUIRED'
  | 'MARKET_PROPERTY_TYPE_MISMATCH'
  | 'MARKET_VINTAGE_MISSING'
  | 'MARKET_VINTAGE_STALE'
  | 'MARKET_VINTAGE_POST_EFFECTIVE_DATE'
  | 'INSPECTION_DATE_MISSING'
  | 'INSPECTION_DATE_CONTRADICTION'
  | 'RETROSPECTIVE_CONDITION_RECONCILIATION_REQUIRED'
  | 'STABILIZATION_BRIDGE_MISSING'
  | 'ZONING_HBU_CONTRADICTION'
  | 'ASSIGNMENT_CONDITION_MISCLASSIFIED'
  | 'FLOOD_ASSERTION_UNSOURCED'
  | 'FLOOD_EVIDENCE_MISSING'
  | 'DOCUMENT_IDENTITY_CONTRADICTION'
  | 'APPRAISAL_IDENTITY_UNAUTHORIZED'
  | 'APPRAISER_CREDENTIAL_REVIEW_REQUIRED'
  | 'ESTATE_ASSIGNMENT_INCOMPLETE'
  | 'ESTATE_PACKAGE_RETENTION_REQUIRED'
  | 'TECHNOLOGY_REVIEW_REQUIRED';

export interface NationwideReportIntegrityFinding {
  code: NationwideReportIntegrityCode;
  message: string;
}

export interface NationwideReportIntegrityAssessment {
  warnings: string[];
  hardFailures: string[];
  warningCodes: NationwideReportIntegrityCode[];
  hardFailureCodes: NationwideReportIntegrityCode[];
}

const CITY_SECTION = 'area_analysis_city';
const COUNTY_SECTIONS = new Set(['area_analysis_county', 'assessment_data']);
const SUBJECT_LOCALITY_SECTIONS = [
  'property_description',
  'site_description_narrative',
  'improvement_description_narrative',
  'condition_assessment',
  'hbu_as_vacant',
  'hbu_as_improved',
] as const;
const MARKET_SECTION = 'market_analysis';
const ASSIGNMENT_SECTION = 'assignment_and_scope';
const CERTIFICATION_SECTION = 'certification_and_limiting_conditions';
const HBU_SECTIONS = ['hbu_as_vacant', 'hbu_as_improved'] as const;
const ESTATE_PATTERN = /\b(form\s*706|estate planning|estate tax|date of death|generation-skipping|generation skipping)\b/i;
const APPRAISAL_IDENTITY_PATTERN = /\b(appraisal report|certified appraisal|state[- ]licensed appraiser|state[- ]certified(?: general)? appraiser|licensed real estate appraiser)\b/i;
const APPRAISAL_REPORT_PATTERN = /\bappraisal report\b/i;
const VALUATION_CONSULTING_REPORT_PATTERN = /\b(?:real property )?valuation consulting report\b/i;
const FLOOD_ASSERTION_PATTERN = /\b(no flood risk|not (?:located )?in (?:a )?(?:special )?flood hazard area|outside (?:of )?(?:the )?floodplain|outside (?:of )?(?:a )?flood zone|minimal flood hazard)\b/i;
const ZONING_TRANSITION_PATTERN = /\b(legal(?:ly)? non[- ]?conforming|lawful non[- ]?conforming|grandfathered|variance|special use|conditional use|planned development|rezon(?:e|ed|ing)|probability of (?:a )?zoning change|existing lawful use)\b/i;
const SINGLE_UNIT_ZONING_PATTERN = /\b(single[- ](?:unit|family)|detached house|one[- ]family|rs[- ]?\d+)\b/i;
const MULTIFAMILY_USE_PATTERN = /\b(multi[- ]?family|duplex|triplex|fourplex|apartment|multiple dwelling)\b/i;
const RETROSPECTIVE_CONDITION_SUPPORT_PATTERN = /\b(as of (?:the )?(?:valuation|effective) date|condition at (?:the )?(?:valuation|effective) date|retrospective condition|subsequent inspection|historical photographs?|dated photographs?|repair records?|owner interview|known or knowable)\b/i;
const AS_IS_PATTERN = /\bas[- ]is\b/i;
const STABILIZED_PATTERN = /\bstabili[sz](?:ed|ation)\b/i;
const STABILIZATION_MECHANIC_PATTERN = /\b(lease[- ]up|absorption|downtime|tenant improvements?|\bTI\b|leasing commissions?|\bLC\b|cost[- ]to[- ]cure|deferred maintenance|present value|discounted cash flow|carrying costs?|lost rent)\b/i;
const REGULATED_APPRAISER_REVIEW_TIERS = new Set(['expert_reviewed', 'full_representation']);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const MONTH_NAME_PATTERN = MONTHS.join('|');
const INSPECTION_DATE_TOKEN = `(?:${MONTH_NAME_PATTERN})\\s+\\d{1,2},\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2}\\/\\d{4}`;

type MarketCategory = 'residential' | 'multifamily' | 'office' | 'retail' | 'industrial' | 'land' | 'agricultural';

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function narrativeText(data: ReportTemplateData, sectionName: string): string {
  const narrative = data.narratives.find((item) => item.section_name === sectionName);
  if (!narrative) return '';

  const edited = narrative.admin_edited_content;
  return hasText(edited) ? edited.trim() : narrative.content?.trim() ?? '';
}

function allNarrativeText(data: ReportTemplateData): string {
  return data.narratives
    .map((narrative) => {
      const edited = narrative.admin_edited_content;
      return hasText(edited) ? edited : narrative.content;
    })
    .filter(hasText)
    .join('\n');
}

function normalizePlace(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/^the\s+/i, '')
    .replace(/\s+(county|parish|borough|census area|municipality|city|village|township)$/i, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function namedMunicipalities(text: string): string[] {
  const names: string[] = [];
  const explicit = /\b(?:city|village|town|borough|municipality)\s+of\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})\b/g;
  Array.from(text.matchAll(explicit)).forEach((match) => names.push(match[1]));

  const zoningAfterComma = /\bZoning,\s*([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}),\s*[A-Z]{2}\b/g;
  Array.from(text.matchAll(zoningAfterComma)).forEach((match) => names.push(match[1]));

  const zoningBeforeLabel = /\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}),\s*[A-Z]{2}\s+Zoning\b/g;
  Array.from(text.matchAll(zoningBeforeLabel)).forEach((match) => names.push(match[1]));

  for (const line of text.split(/\r?\n/)) {
    const headingText = line.trim();
    const headingSuffix = [' Area Analysis', ' Analysis', ' Zoning']
      .find((suffix) => headingText.endsWith(suffix));
    if (headingSuffix) {
      const place = headingText.slice(0, -headingSuffix.length).trim();
      if (place) names.push(place);
    }
  }

  return unique(names);
}

function marketNamedMunicipalities(text: string): string[] {
  const names = namedMunicipalities(text);
  const areaSummary = /\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,2})\s+(?:Area|Sub[- ]?Market)\s+(?:Summary|Analysis)\b/g;
  Array.from(text.matchAll(areaSummary)).forEach((match) => names.push(match[1]));

  const typedMarket = /\b(?:Q[1-4]\s+20\d{2}\s+)?([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,2})\s+(?:Retail|Office|Industrial|Multifamily|Apartment|Flex)\s+Market\s+Summary\b/g;
  Array.from(text.matchAll(typedMarket)).forEach((match) => names.push(match[1]));

  return unique(names);
}

function namedCounties(text: string): string[] {
  const names: string[] = [];
  const pattern = /\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})\s+(County|Parish|Borough|Census Area|Municipality)\b/g;
  Array.from(text.matchAll(pattern)).forEach((match) => names.push(match[1]));
  return unique(names);
}

function pushFinding(
  findings: NationwideReportIntegrityFinding[],
  code: NationwideReportIntegrityCode,
  message: string
): void {
  if (!findings.some((finding) => finding.code === code && finding.message === message)) {
    findings.push({ code, message });
  }
}

function evaluateLocationConsistency(
  data: ReportTemplateData,
  warnings: NationwideReportIntegrityFinding[],
  hardFailures: NationwideReportIntegrityFinding[]
): void {
  const expectedCity = normalizePlace(data.report.city);
  const expectedCounty = normalizePlace(data.report.county);
  const cityText = narrativeText(data, CITY_SECTION);

  if (hasText(cityText) && expectedCity) {
    const foreignCities = namedMunicipalities(cityText)
      .filter((name) => normalizePlace(name) !== expectedCity);

    for (const city of foreignCities) {
      pushFinding(
        hardFailures,
        'MUNICIPALITY_TEMPLATE_LEAK',
        `Municipal analysis references ${city}, but the subject municipality is ${data.report.city}`
      );
    }

    const cityMentioned = normalizePlace(cityText).includes(expectedCity);
    const genericMunicipalReference = /\b(subject municipality|subject city|local municipality)\b/i.test(cityText);
    if (!cityMentioned && foreignCities.length === 0 && !genericMunicipalReference) {
      pushFinding(
        warnings,
        'LOCALITY_REFERENCE_MISSING',
        `Municipal analysis does not explicitly identify the subject municipality ${data.report.city}`
      );
    }
  }

  if (expectedCity) {
    for (const sectionName of SUBJECT_LOCALITY_SECTIONS) {
      const text = narrativeText(data, sectionName);
      if (!hasText(text)) continue;

      const foreignCities = namedMunicipalities(text)
        .filter((name) => normalizePlace(name) !== expectedCity);
      for (const city of foreignCities) {
        pushFinding(
          hardFailures,
          'MUNICIPALITY_TEMPLATE_LEAK',
          `${sectionName} references ${city}, but the subject municipality is ${data.report.city}`
        );
      }
    }
  }

  if (!expectedCounty) return;
  for (const sectionName of Array.from(COUNTY_SECTIONS)) {
    const text = narrativeText(data, sectionName);
    if (!hasText(text)) continue;

    const foreignCounties = namedCounties(text)
      .filter((name) => normalizePlace(name) !== expectedCounty);
    for (const county of foreignCounties) {
      pushFinding(
        hardFailures,
        'COUNTY_TEMPLATE_LEAK',
        `${sectionName} references ${county}, but the subject county is ${data.report.county}`
      );
    }
  }
}

function expectedMarketCategories(data: ReportTemplateData): Set<MarketCategory> {
  const descriptor = [
    data.report.property_type,
    data.property.property_subtype,
    data.property.property_class_description,
  ].filter(hasText).join(' ').toLowerCase();

  if (/\b(multi[- ]?family|duplex|triplex|fourplex|apartment)\b/.test(descriptor)) {
    return new Set(['multifamily']);
  }
  if (/\b(flex|warehouse|industrial|manufacturing|distribution|studio)\b/.test(descriptor)) {
    return new Set(['industrial']);
  }
  if (/\boffice\b/.test(descriptor)) return new Set(['office']);
  if (/\b(retail|shopping|storefront)\b/.test(descriptor)) return new Set(['retail']);
  if (data.report.property_type === 'residential') return new Set(['residential']);
  if (data.report.property_type === 'industrial') return new Set(['industrial']);
  if (data.report.property_type === 'land') return new Set(['land']);
  if (data.report.property_type === 'agricultural') return new Set(['agricultural']);
  return new Set();
}

function detectedMarketCategories(text: string): Set<MarketCategory> {
  const detected = new Set<MarketCategory>();
  if (/\b(single[- ]family|residential housing|housing market)\b/i.test(text)) detected.add('residential');
  if (/\b(multi[- ]?family|apartment|rental housing)\b/i.test(text)) detected.add('multifamily');
  if (/\boffice\b/i.test(text)) detected.add('office');
  if (/\b(retail|shopping center|storefront)\b/i.test(text)) detected.add('retail');
  if (/\b(industrial|warehouse|logistics|manufacturing|distribution|flex)\b/i.test(text)) detected.add('industrial');
  if (/\b(land market|development site|vacant land)\b/i.test(text)) detected.add('land');
  if (/\b(agricultural|farmland|cropland)\b/i.test(text)) detected.add('agricultural');
  return detected;
}

function evaluateMarketFit(
  data: ReportTemplateData,
  warnings: NationwideReportIntegrityFinding[],
  hardFailures: NationwideReportIntegrityFinding[]
): void {
  const marketText = narrativeText(data, MARKET_SECTION);
  if (!hasText(marketText)) return;

  const header = marketText.split(/\r?\n/).filter(Boolean).slice(0, 5).join(' ').slice(0, 900);
  const expectedCity = normalizePlace(data.report.city);
  if (expectedCity) {
    const foreignMarkets = marketNamedMunicipalities(header)
      .filter((name) => normalizePlace(name) !== expectedCity);
    const subjectCityMentioned = normalizePlace(header).includes(expectedCity);
    if (foreignMarkets.length > 0 && !subjectCityMentioned) {
      pushFinding(
        warnings,
        'MARKET_GEOGRAPHY_REVIEW_REQUIRED',
        `Market analysis is labeled for ${foreignMarkets.join(', ')} while the subject is in ${data.report.city}; verify and explain the selected market geography before release`
      );
    }
  }

  const expected = expectedMarketCategories(data);
  const detected = detectedMarketCategories(header);
  if (expected.size === 0 || detected.size === 0) return;

  const compatible = Array.from(expected).some((category) => detected.has(category));
  if (!compatible) {
    pushFinding(
      hardFailures,
      'MARKET_PROPERTY_TYPE_MISMATCH',
      `Market analysis is labeled for ${Array.from(detected).join(', ')} property data, but the subject requires ${Array.from(expected).join(', ')} market evidence`
    );
  }
}

function marketVintageYears(text: string): number[] {
  const years: number[] = [];
  const quarterPattern = /\b(?:Q[1-4]|[1-4](?:st|nd|rd|th)\s+quarter)\s*(20\d{2})\b/gi;
  const marketPattern = /\b(?:market|survey|report|summary|data|statistics|vacancy|rent|capitalization rate|cap rate)[^.\n]{0,60}\b(20\d{2})\b/gi;

  Array.from(text.matchAll(quarterPattern)).forEach((match) => years.push(Number(match[1])));
  Array.from(text.matchAll(marketPattern)).forEach((match) => years.push(Number(match[1])));
  return Array.from(new Set(years.filter((year) => Number.isInteger(year))));
}

function marketQuarterEndDates(text: string): string[] {
  const dates: string[] = [];
  const pattern = /\bQ([1-4])\s*(20\d{2})\b/gi;
  for (const match of text.matchAll(pattern)) {
    const quarter = Number(match[1]);
    const year = Number(match[2]);
    const month = quarter * 3;
    const end = new Date(Date.UTC(year, month, 0));
    dates.push(end.toISOString().slice(0, 10));
  }
  return unique(dates);
}

function evaluateMarketVintage(
  data: ReportTemplateData,
  warnings: NationwideReportIntegrityFinding[],
  hardFailures: NationwideReportIntegrityFinding[]
): void {
  const marketText = narrativeText(data, MARKET_SECTION);
  if (!hasText(marketText)) return;

  const valuationYear = Number(data.valuationDate.slice(0, 4));
  if (!Number.isInteger(valuationYear)) return;

  const years = marketVintageYears(marketText);
  if (years.length === 0) {
    pushFinding(
      warnings,
      'MARKET_VINTAGE_MISSING',
      'Market analysis does not expose a machine-checkable data vintage or reporting period'
    );
    return;
  }

  const nearestDistance = Math.min(...years.map((year) => Math.abs(year - valuationYear)));
  if (nearestDistance > 1) {
    pushFinding(
      hardFailures,
      'MARKET_VINTAGE_STALE',
      `Market analysis cites ${years.sort().join(', ')}, which is not sufficiently proximate to the ${valuationYear} valuation date`
    );
  } else if (nearestDistance === 1) {
    pushFinding(
      warnings,
      'MARKET_VINTAGE_STALE',
      `Market analysis uses a one-year-offset data vintage; the report must explain its relevance to the ${valuationYear} effective date`
    );
  }

  const hindsightDisclosed = /\b(hindsight|post[- ]effective[- ]date|after the valuation date|subsequent|later evidence|context only|not relied upon)\b/i
    .test(marketText);

  if (years.every((year) => year > valuationYear)) {
    const message =
      'All machine-detected market periods post-date the valuation year; hindsight evidence must be identified and separated from effective-date evidence';
    if (!hindsightDisclosed || isRetrospectiveAssignment(data)) {
      pushFinding(
        hardFailures,
        'MARKET_VINTAGE_POST_EFFECTIVE_DATE',
        message
      );
      return;
    }

    pushFinding(
      warnings,
      'MARKET_VINTAGE_POST_EFFECTIVE_DATE',
      message
    );
    return;
  }

  if (isRetrospectiveAssignment(data)) {
    const valuationTime = Date.parse(`${data.valuationDate}T00:00:00Z`);
    const laterQuarterEnds = marketQuarterEndDates(marketText)
      .filter((date) => Date.parse(`${date}T00:00:00Z`) > valuationTime);
    if (laterQuarterEnds.length > 0) {
      const message = `Market analysis includes reporting period(s) ending after the ${data.valuationDate} effective date (${laterQuarterEnds.join(', ')}); separate effective-date evidence from later context`;
      pushFinding(
        hindsightDisclosed ? warnings : hardFailures,
        'MARKET_VINTAGE_POST_EFFECTIVE_DATE',
        message
      );
    }
  }
}

function parseInspectionDate(value: string): string | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function extractInspectionDates(text: string): string[] {
  const patterns = [
    new RegExp(`\\b(?:date of inspection|inspection date)\\s*(?:was|is|:|-)?\\s*(${INSPECTION_DATE_TOKEN})`, 'gi'),
    new RegExp(`\\b(?:the subject(?: property)? was |the property was )?inspected\\s+(?:on\\s+)?(${INSPECTION_DATE_TOKEN})`, 'gi'),
    new RegExp(`\\binspection\\s+(?:was\\s+)?conducted\\s+(?:on\\s+)?(${INSPECTION_DATE_TOKEN})`, 'gi'),
  ];
  const dates: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const normalized = parseInspectionDate(match[1]);
      if (normalized) dates.push(normalized);
    }
  }
  return unique(dates);
}

function evaluateInspectionConsistency(
  data: ReportTemplateData,
  warnings: NationwideReportIntegrityFinding[],
  hardFailures: NationwideReportIntegrityFinding[]
): void {
  const inspectionDates = extractInspectionDates(allNarrativeText(data));
  if (inspectionDates.length > 1) {
    pushFinding(
      hardFailures,
      'INSPECTION_DATE_CONTRADICTION',
      `Report narratives contain conflicting inspection dates: ${inspectionDates.join(', ')}`
    );
    return;
  }

  if (!isRetrospectiveAssignment(data)) return;
  if (inspectionDates.length === 0) {
    pushFinding(
      warnings,
      'INSPECTION_DATE_MISSING',
      'Retrospective assignment does not expose a machine-checkable inspection date'
    );
    return;
  }

  const inspectionTime = Date.parse(`${inspectionDates[0]}T00:00:00Z`);
  const valuationTime = Date.parse(`${data.valuationDate}T00:00:00Z`);
  if (!Number.isFinite(inspectionTime) || !Number.isFinite(valuationTime) || inspectionTime <= valuationTime) return;

  const conditionCorpus = [
    narrativeText(data, ASSIGNMENT_SECTION),
    narrativeText(data, 'property_history'),
    narrativeText(data, 'condition_assessment'),
    narrativeText(data, 'property_description'),
  ].join(' ');
  if (RETROSPECTIVE_CONDITION_SUPPORT_PATTERN.test(conditionCorpus)) return;

  const message = `Inspection occurred on ${inspectionDates[0]}, after the ${data.valuationDate} effective date, without a documented bridge to the subject's effective-date condition`;
  pushFinding(
    REGULATED_APPRAISER_REVIEW_TIERS.has(data.report.review_tier) ? hardFailures : warnings,
    'RETROSPECTIVE_CONDITION_RECONCILIATION_REQUIRED',
    message
  );
}

function wordNumber(value: string): number | null {
  const normalized = value.toLowerCase();
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  if (normalized in words) return words[normalized];
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function observedVacancyPct(data: ReportTemplateData): number | null {
  const subjectText = [
    data.report.additional_notes,
    narrativeText(data, 'summary_of_salient_facts'),
    narrativeText(data, 'executive_summary'),
    narrativeText(data, ASSIGNMENT_SECTION),
    narrativeText(data, 'property_description'),
    narrativeText(data, 'condition_assessment'),
  ].filter(hasText).join(' ');
  const candidates: number[] = [];

  for (const match of subjectText.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*%\s*(?:currently\s+)?vacant\b/gi)) {
    candidates.push(Number(match[1]));
  }
  for (const match of subjectText.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*%\s*(?:currently\s+)?occupied\b/gi)) {
    candidates.push(100 - Number(match[1]));
  }
  if (/\b(?:fully|completely|100\s*%)\s+vacant\b/i.test(subjectText)) candidates.push(100);
  if (/\b(?:fully|completely|100\s*%)\s+(?:leased|occupied)\b/i.test(subjectText)) candidates.push(0);

  const unitCount = data.property.unit_count;
  if (typeof unitCount === 'number' && unitCount > 0) {
    for (const match of subjectText.matchAll(/\b(one|two|three|four|five|six|\d+)\s+vacant\s+units?\b/gi)) {
      const vacantUnits = wordNumber(match[1]);
      if (vacantUnits != null && vacantUnits <= unitCount) {
        candidates.push((vacantUnits / unitCount) * 100);
      }
    }
  }

  const valid = candidates.filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
  return valid.length > 0 ? Math.max(...valid) : null;
}

function normalizeStoredPct(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value <= 1 ? value * 100 : value;
}

function evaluateStabilizationBridge(
  data: ReportTemplateData,
  hardFailures: NationwideReportIntegrityFinding[]
): void {
  if (!data.incomeAnalysis) return;
  const actualVacancy = observedVacancyPct(data);
  const modeledVacancy = normalizeStoredPct(data.incomeAnalysis.vacancy_rate_pct);
  if (actualVacancy == null || modeledVacancy == null) return;
  if (actualVacancy < 25 || actualVacancy - modeledVacancy < 10) return;

  const bridgeText = [
    narrativeText(data, 'condition_assessment'),
    narrativeText(data, 'income_approach_narrative'),
    narrativeText(data, 'reconciliation_narrative'),
  ].join(' ');
  const hasPremiseBridge = AS_IS_PATTERN.test(bridgeText) && STABILIZED_PATTERN.test(bridgeText);
  const hasMechanics = STABILIZATION_MECHANIC_PATTERN.test(bridgeText);
  if (hasPremiseBridge && hasMechanics) return;

  pushFinding(
    hardFailures,
    'STABILIZATION_BRIDGE_MISSING',
    `Subject evidence indicates approximately ${actualVacancy.toFixed(0)}% vacancy, but the income approach models ${modeledVacancy.toFixed(1)}% vacancy without a reproducible as-is-to-stabilized lease-up, downtime, TI/LC, carrying-cost, or cost-to-cure bridge`
  );
}

function evaluateZoningAndHighestBestUse(
  data: ReportTemplateData,
  hardFailures: NationwideReportIntegrityFinding[]
): void {
  const zoningText = [
    data.property.zoning_designation,
    data.property.zoning_description,
    data.property.zoning_conformance,
    narrativeText(data, 'site_description_narrative'),
  ].filter(hasText).join(' ');
  const hbuText = HBU_SECTIONS.map((section) => narrativeText(data, section)).join(' ');
  if (!hasText(zoningText) || !hasText(hbuText)) return;

  if (
    SINGLE_UNIT_ZONING_PATTERN.test(zoningText) &&
    MULTIFAMILY_USE_PATTERN.test(hbuText) &&
    !ZONING_TRANSITION_PATTERN.test(`${zoningText} ${hbuText}`)
  ) {
    pushFinding(
      hardFailures,
      'ZONING_HBU_CONTRADICTION',
      'Highest-and-best-use analysis concludes to multifamily use while the stored zoning evidence indicates single-unit use without a supported legal-nonconforming, variance, special-use, or rezoning analysis'
    );
  }
}

function evaluateAssignmentConditionTaxonomy(
  data: ReportTemplateData,
  hardFailures: NationwideReportIntegrityFinding[]
): void {
  const scopeText = narrativeText(data, ASSIGNMENT_SECTION);
  if (!hasText(scopeText)) return;

  const lower = scopeText.toLowerCase();
  const start = lower.indexOf('extraordinary assumption');
  const end = lower.indexOf('hypothetical condition', Math.max(start, 0));
  if (start < 0) return;

  const segment = scopeText.slice(start, end > start ? end : Math.min(scopeText.length, start + 1800));
  if (/\b(exclud(?:e|ed|ing)|omitt(?:ed|ing))\b/i.test(segment) && /\b(personal property|tangible property|intangible property)\b/i.test(segment)) {
    pushFinding(
      hardFailures,
      'ASSIGNMENT_CONDITION_MISCLASSIFIED',
      'A personal-property exclusion is classified as an extraordinary assumption; move it to the property-rights or exclusions section unless an actual uncertain assignment-specific fact is identified'
    );
  }
}

function hasStructuredEvidence(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function evaluateFloodEvidence(
  data: ReportTemplateData,
  warnings: NationwideReportIntegrityFinding[],
  hardFailures: NationwideReportIntegrityFinding[]
): void {
  const floodNarrative = [
    narrativeText(data, 'site_description_narrative'),
    narrativeText(data, 'property_description'),
    narrativeText(data, 'condition_assessment'),
  ].join(' ');
  const hasOfficialEvidence =
    hasText(data.property.flood_map_panel_number) ||
    hasStructuredEvidence(data.property.fema_raw_response);
  const hasAnyFloodEvidence =
    hasOfficialEvidence ||
    hasText(data.property.flood_zone_designation) ||
    hasText(data.property.flood_map_panel_date);

  if (FLOOD_ASSERTION_PATTERN.test(floodNarrative) && !hasOfficialEvidence) {
    pushFinding(
      hardFailures,
      'FLOOD_ASSERTION_UNSOURCED',
      'The report makes a definitive flood-hazard assertion without a stored FEMA response or flood-map panel reference'
    );
  } else if (!hasAnyFloodEvidence) {
    pushFinding(
      warnings,
      'FLOOD_EVIDENCE_MISSING',
      'No flood-hazard source is stored; a missing or non-digitized FEMA coverage result must route to manual review rather than being interpreted as no flood risk'
    );
  }
}

function evaluateDocumentIdentity(
  data: ReportTemplateData,
  warnings: NationwideReportIntegrityFinding[],
  hardFailures: NationwideReportIntegrityFinding[]
): void {
  const narrativeCorpus = allNarrativeText(data);
  if (APPRAISAL_REPORT_PATTERN.test(narrativeCorpus) && VALUATION_CONSULTING_REPORT_PATTERN.test(narrativeCorpus)) {
    pushFinding(
      hardFailures,
      'DOCUMENT_IDENTITY_CONTRADICTION',
      'The report identifies itself as both an appraisal report and a valuation consulting report; use one assignment-accurate document identity and matching certification'
    );
  }

  if (!APPRAISAL_IDENTITY_PATTERN.test(narrativeCorpus)) return;

  if (data.report.review_tier === 'auto') {
    pushFinding(
      hardFailures,
      'APPRAISAL_IDENTITY_UNAUTHORIZED',
      'An automated report claims appraisal or licensed-appraiser status; Resourceful must retain its AI-assisted valuation-analysis identity unless a qualified appraiser accepts and signs the assignment'
    );
    return;
  }

  pushFinding(
    warnings,
    'APPRAISER_CREDENTIAL_REVIEW_REQUIRED',
    `The report contains appraisal credential language; verify the signing appraiser's active credential in the subject state before release`
  );
}

function evaluateEstateAssignment(
  data: ReportTemplateData,
  warnings: NationwideReportIntegrityFinding[],
  hardFailures: NationwideReportIntegrityFinding[]
): void {
  const assignmentText = narrativeText(data, ASSIGNMENT_SECTION);
  const corpus = [data.report.desired_outcome, data.report.additional_notes, assignmentText].filter(hasText).join(' ');
  if (!ESTATE_PATTERN.test(corpus)) return;

  const missing: string[] = [];
  if (!ESTATE_PATTERN.test(assignmentText)) missing.push('estate/Form 706 intended-use language');
  if (!hasText(narrativeText(data, 'property_history'))) missing.push('property history');
  if (!hasText(narrativeText(data, MARKET_SECTION))) missing.push('effective-date market analysis');
  if (!hasText(narrativeText(data, CERTIFICATION_SECTION))) missing.push('certification boundary and limiting conditions');

  const valuationTime = Date.parse(`${data.valuationDate}T00:00:00Z`);
  const reportTime = Date.parse(`${data.reportDate}T00:00:00Z`);
  if (!Number.isFinite(valuationTime) || !Number.isFinite(reportTime) || valuationTime >= reportTime) {
    missing.push('valid retrospective date-of-death/effective date before the report date');
  }

  if (missing.length > 0) {
    pushFinding(
      hardFailures,
      'ESTATE_ASSIGNMENT_INCOMPLETE',
      `Estate valuation package is incomplete: ${missing.join(', ')}`
    );
  } else {
    pushFinding(
      warnings,
      'ESTATE_PACKAGE_RETENTION_REQUIRED',
      'Estate valuation detected: preserve the complete signed report, source exhibits, and supporting appraisal package required by the intended tax filing'
    );
  }
}

function evaluateTechnologyResponsibility(
  data: ReportTemplateData,
  warnings: NationwideReportIntegrityFinding[]
): void {
  const hasModelGeneratedNarrative = data.narratives.some(
    (narrative) => hasText(narrative.content) && hasText(narrative.model_used)
  );
  if (!hasModelGeneratedNarrative || !REGULATED_APPRAISER_REVIEW_TIERS.has(data.report.review_tier)) return;

  pushFinding(
    warnings,
    'TECHNOLOGY_REVIEW_REQUIRED',
    'Technology-assisted narrative is present in a reviewed assignment; the signing professional remains responsible for independently verifying inputs, analyses, conclusions, and final report language'
  );
}

export function evaluateNationwideReportIntegrity(
  data: ReportTemplateData
): NationwideReportIntegrityAssessment {
  const warnings: NationwideReportIntegrityFinding[] = [];
  const hardFailures: NationwideReportIntegrityFinding[] = [];

  evaluateLocationConsistency(data, warnings, hardFailures);
  evaluateMarketFit(data, warnings, hardFailures);
  evaluateMarketVintage(data, warnings, hardFailures);
  evaluateInspectionConsistency(data, warnings, hardFailures);
  evaluateStabilizationBridge(data, hardFailures);
  evaluateZoningAndHighestBestUse(data, hardFailures);
  evaluateAssignmentConditionTaxonomy(data, hardFailures);
  evaluateFloodEvidence(data, warnings, hardFailures);
  evaluateDocumentIdentity(data, warnings, hardFailures);
  evaluateEstateAssignment(data, warnings, hardFailures);
  evaluateTechnologyResponsibility(data, warnings);

  return {
    warnings: warnings.map((finding) => finding.message),
    hardFailures: hardFailures.map((finding) => finding.message),
    warningCodes: warnings.map((finding) => finding.code),
    hardFailureCodes: hardFailures.map((finding) => finding.code),
  };
}
