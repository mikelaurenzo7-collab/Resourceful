import type { ReportTemplateData } from '@/lib/templates/report-template';

export type NationwideReportIntegrityCode =
  | 'MUNICIPALITY_TEMPLATE_LEAK'
  | 'COUNTY_TEMPLATE_LEAK'
  | 'LOCALITY_REFERENCE_MISSING'
  | 'MARKET_VINTAGE_MISSING'
  | 'MARKET_VINTAGE_STALE'
  | 'MARKET_VINTAGE_POST_EFFECTIVE_DATE'
  | 'ZONING_HBU_CONTRADICTION'
  | 'ASSIGNMENT_CONDITION_MISCLASSIFIED'
  | 'FLOOD_ASSERTION_UNSOURCED'
  | 'FLOOD_EVIDENCE_MISSING'
  | 'APPRAISAL_IDENTITY_UNAUTHORIZED'
  | 'APPRAISER_CREDENTIAL_REVIEW_REQUIRED'
  | 'ESTATE_ASSIGNMENT_INCOMPLETE'
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
const MARKET_SECTION = 'market_analysis';
const ASSIGNMENT_SECTION = 'assignment_and_scope';
const CERTIFICATION_SECTION = 'certification_and_limiting_conditions';
const HBU_SECTIONS = ['hbu_as_vacant', 'hbu_as_improved'] as const;
const ESTATE_PATTERN = /\b(form\s*706|estate planning|estate tax|date of death|generation-skipping|generation skipping)\b/i;
const APPRAISAL_IDENTITY_PATTERN = /\b(appraisal report|certified appraisal|state[- ]licensed appraiser|state[- ]certified(?: general)? appraiser|licensed real estate appraiser)\b/i;
const FLOOD_ASSERTION_PATTERN = /\b(no flood risk|not (?:located )?in (?:a )?(?:special )?flood hazard area|outside (?:of )?(?:the )?floodplain|outside (?:of )?(?:a )?flood zone|minimal flood hazard)\b/i;
const ZONING_TRANSITION_PATTERN = /\b(legal(?:ly)? non[- ]?conforming|lawful non[- ]?conforming|grandfathered|variance|special use|conditional use|planned development|rezon(?:e|ed|ing)|probability of (?:a )?zoning change|existing lawful use)\b/i;
const SINGLE_UNIT_ZONING_PATTERN = /\b(single[- ](?:unit|family)|detached house|one[- ]family|rs[- ]?\d+)\b/i;
const MULTIFAMILY_USE_PATTERN = /\b(multi[- ]?family|duplex|triplex|fourplex|apartment|multiple dwelling)\b/i;
const REGULATED_APPRAISER_REVIEW_TIERS = new Set(['expert_reviewed', 'full_representation']);

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
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function namedMunicipalities(text: string): string[] {
  const names: string[] = [];
  const explicit = /\b(?:city|village|town|borough|municipality)\s+of\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})\b/g;
  for (const match of text.matchAll(explicit)) names.push(match[1]);

  for (const line of text.split(/\r?\n/)) {
    const heading = line.trim().match(/^([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})\s+(?:Area Analysis|Analysis|Zoning)$/);
    if (heading) names.push(heading[1]);
  }

  return unique(names);
}

function namedCounties(text: string): string[] {
  const names: string[] = [];
  const pattern = /\b([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})\s+(County|Parish|Borough|Census Area|Municipality)\b/g;
  for (const match of text.matchAll(pattern)) names.push(match[1]);
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

  if (!expectedCounty) return;
  for (const sectionName of COUNTY_SECTIONS) {
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

function marketVintageYears(text: string): number[] {
  const years: number[] = [];
  const quarterPattern = /\b(?:Q[1-4]|[1-4](?:st|nd|rd|th)\s+quarter)\s*(20\d{2})\b/gi;
  const marketPattern = /\b(?:market|survey|report|summary|data|statistics|vacancy|rent|capitalization rate|cap rate)[^.\n]{0,60}\b(20\d{2})\b/gi;

  for (const match of text.matchAll(quarterPattern)) years.push(Number(match[1]));
  for (const match of text.matchAll(marketPattern)) years.push(Number(match[1]));
  return [...new Set(years.filter((year) => Number.isInteger(year)))];
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

  if (years.every((year) => year > valuationYear)) {
    pushFinding(
      warnings,
      'MARKET_VINTAGE_POST_EFFECTIVE_DATE',
      'All machine-detected market periods post-date the valuation year; hindsight evidence must be identified and separated from effective-date evidence'
    );
  }
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

function objectText(value: unknown): string {
  try {
    return value == null ? '' : JSON.stringify(value);
  } catch {
    return '';
  }
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
  const rawFloodText = objectText(data.property.fema_raw_response);
  const hasOfficialEvidence =
    hasText(data.property.flood_map_panel_number) ||
    hasText(rawFloodText);
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
      'ESTATE_ASSIGNMENT_INCOMPLETE',
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
  evaluateMarketVintage(data, warnings, hardFailures);
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
