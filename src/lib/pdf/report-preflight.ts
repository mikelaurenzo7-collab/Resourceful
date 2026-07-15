import type { ReportTemplateData } from '@/lib/templates/report-template';

export type ReportPreflightSeverity = 'error' | 'warning';

export interface ReportPreflightIssue {
  code: string;
  severity: ReportPreflightSeverity;
  message: string;
}

export interface ReportPreflightResult {
  ok: boolean;
  issues: ReportPreflightIssue[];
}

const RAW_LAYOUT_MARKERS = [/```/, /<\/?(?:html|body|table|div|style|script)\b/i];
const MAX_JURISDICTION_RULE_AGE_DAYS = 180;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Deterministic release gate for the customer-facing report artifact.
 *
 * This validates facts and content contracts, not valuation judgment.
 * A report that fails this gate must not be rendered or delivered.
 */
export function preflightReport(
  data: ReportTemplateData,
  now: Date = new Date()
): ReportPreflightResult {
  const issues: ReportPreflightIssue[] = [];
  const error = (code: string, message: string) =>
    issues.push({ code, severity: 'error' as const, message });
  const warning = (code: string, message: string) =>
    issues.push({ code, severity: 'warning' as const, message });

  if (!hasText(data.report.property_address)) error('identity.address', 'Property address is required.');
  if (!hasText(data.report.city)) error('identity.city', 'Property city is required.');
  if (!hasText(data.report.state)) error('identity.state', 'Property state is required.');
  if (!hasText(data.valuationDate)) error('assignment.valuation_date', 'Valuation date is required.');
  if (!hasText(data.reportDate)) error('assignment.report_date', 'Report date is required.');
  if (!positiveFinite(data.concludedValue)) error('valuation.conclusion', 'Concluded value must be a positive finite number.');

  const property = data.property;
  const hasArea =
    positiveFinite(property.building_sqft_gross) ||
    positiveFinite(property.building_sqft_living_area);
  if (!hasArea) warning('property.area', 'No verified gross or living building area is available; area-based metrics must be omitted.');

  const hasSales = data.comparableSales.length > 0;
  const hasIncome = data.incomeAnalysis != null;
  const hasCost = positiveFinite(property.cost_approach_value);
  if (!hasSales && !hasIncome && !hasCost) {
    error('valuation.evidence', 'At least one evidence-backed valuation approach is required.');
  }

  if (data.report.service_type === 'tax_appeal') {
    if (!hasText(data.report.county_fips)) {
      error('jurisdiction.fips', 'Tax-appeal delivery requires a resolved county FIPS code.');
    }

    const rule = data.countyRule;
    if (!rule) {
      error('jurisdiction.rules', 'Tax-appeal delivery requires a structured jurisdiction rule record.');
    } else {
      if (!rule.is_active) {
        error('jurisdiction.inactive', 'The attached jurisdiction rule record is inactive.');
      }

      if (hasText(data.report.county_fips) && rule.county_fips !== data.report.county_fips) {
        error(
          'jurisdiction.fips_mismatch',
          `Report county FIPS ${data.report.county_fips} does not match rule FIPS ${rule.county_fips}.`
        );
      }

      if (
        hasText(data.report.state_abbreviation) &&
        rule.state_abbreviation.toUpperCase() !== data.report.state_abbreviation.toUpperCase()
      ) {
        error(
          'jurisdiction.state_mismatch',
          `Report state ${data.report.state_abbreviation} does not match rule state ${rule.state_abbreviation}.`
        );
      }

      if (!hasText(rule.last_verified_date)) {
        error('jurisdiction.unverified', 'The jurisdiction rule record has no verification date.');
      } else {
        const verifiedAt = new Date(rule.last_verified_date);
        if (Number.isNaN(verifiedAt.getTime())) {
          error('jurisdiction.invalid_verification_date', 'The jurisdiction verification date is invalid.');
        } else {
          const ageMs = now.getTime() - verifiedAt.getTime();
          if (ageMs < -ONE_DAY_MS) {
            error('jurisdiction.future_verification', 'The jurisdiction verification date is in the future.');
          } else if (Math.floor(ageMs / ONE_DAY_MS) > MAX_JURISDICTION_RULE_AGE_DAYS) {
            error(
              'jurisdiction.stale',
              `The jurisdiction rule record is older than ${MAX_JURISDICTION_RULE_AGE_DAYS} days and must be reverified.`
            );
          }
        }
      }
    }

    const guide = data.filingGuide;
    if (!guide) {
      error('appeal.filing_guide', 'Tax-appeal reports require a usable filing guide before delivery.');
    } else {
      if (!hasText(guide.appeal_board_name)) {
        error('appeal.board_name', 'The filing guide must identify the appeal board or filing authority.');
      }
      if (!hasText(guide.filing_deadline)) {
        error('appeal.deadline', 'The filing guide must state the applicable filing deadline or deadline rule.');
      }
      if (guide.steps.length === 0) {
        error('appeal.filing_steps', 'The filing guide must include filing steps.');
      }
      if (guide.required_documents.length === 0) {
        error('appeal.required_documents', 'The filing guide must identify required documents.');
      }
    }
  }

  const sectionNames = new Set<string>();
  for (const narrative of data.narratives) {
    if (!hasText(narrative.section_name) || !hasText(narrative.content)) continue;
    if (sectionNames.has(narrative.section_name)) {
      error('narrative.duplicate_section', `Duplicate narrative section: ${narrative.section_name}.`);
    }
    sectionNames.add(narrative.section_name);

    if (RAW_LAYOUT_MARKERS.some((pattern) => pattern.test(narrative.content))) {
      error(
        'narrative.raw_layout_markup',
        `Narrative section ${narrative.section_name} contains raw layout markup or a fenced code block.`
      );
    }
  }

  const usablePhotos = data.photos.filter((photo) => hasText(photo.storage_path)).length;
  if (usablePhotos === 0) {
    warning('evidence.photos', 'No usable subject photographs are available for the visual evidence exhibit.');
  }

  for (const [index, comparable] of data.comparableSales.entries()) {
    if (!hasText(comparable.address)) {
      error('sales.address', `Comparable sale ${index + 1} is missing an address.`);
    }
    if (!positiveFinite(comparable.sale_price)) {
      error('sales.price', `Comparable sale ${index + 1} is missing a positive sale price.`);
    }
    if (!hasText(comparable.sale_date)) {
      warning('sales.date', `Comparable sale ${index + 1} is missing a sale date.`);
    }
  }

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}

export function assertReportPreflight(
  data: ReportTemplateData,
  now?: Date
): ReportPreflightResult {
  const result = preflightReport(data, now);
  if (!result.ok) {
    const details = result.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join('; ');
    throw new Error(`Final report preflight failed: ${details}`);
  }
  return result;
}
