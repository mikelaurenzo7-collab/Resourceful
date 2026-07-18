import type { ReportTemplateData } from '@/lib/templates/report-template';
import {
  buildReportProfile,
  REPORT_NARRATIVE_SECTION_SPECS,
  type ReportNarrativeSectionKey,
  type ReportProfile,
} from './report-profile';

export type ReportRenderSectionKind =
  | 'letter'
  | 'summary'
  | 'property_facts'
  | 'executive_summary'
  | 'maps'
  | 'photos'
  | 'assignment_scope'
  | 'narrative'
  | 'condition_table'
  | 'comparable_grid'
  | 'comparable_profiles'
  | 'income_calculation'
  | 'cost_calculation'
  | 'assessment_context'
  | 'reconciliation'
  | 'filing_guide'
  | 'assignment_guide'
  | 'certification'
  | 'disclaimer';

export interface ReportRenderSection {
  id: string;
  kind: ReportRenderSectionKind;
  number: string;
  title: string;
  detail?: string;
  narrativeKey?: string;
}

export interface ReportRenderPlan {
  profile: ReportProfile;
  narratives: Map<string, string>;
  sections: ReportRenderSection[];
}

const NARRATIVE_SPEC_BY_KEY = new Map(
  REPORT_NARRATIVE_SECTION_SPECS.map((section) => [section.key, section])
);

function normalizedNarratives(data: ReportTemplateData): Map<string, string> {
  const result = new Map<string, string>();
  for (const narrative of data.narratives) {
    const content = narrative.content?.trim();
    if (content) result.set(narrative.section_name, content);
  }
  return result;
}

function mapCount(data: ReportTemplateData): number {
  return [data.maps.regional, data.maps.neighborhood, data.maps.parcel]
    .filter((map) => Boolean(map?.url)).length;
}

function photoCount(data: ReportTemplateData): number {
  return data.photos.filter((photo) => Boolean(photo.storage_path)).length;
}

export function buildReportRenderPlan(data: ReportTemplateData): ReportRenderPlan {
  const profile = buildReportProfile(data);
  const narratives = normalizedNarratives(data);
  const sections: ReportRenderSection[] = [];
  const requiredNarratives = new Set(profile.requiredNarratives);

  const push = (section: ReportRenderSection) => sections.push(section);
  const pushNarrative = (
    key: ReportNarrativeSectionKey,
    kind: ReportRenderSectionKind = 'narrative'
  ) => {
    if (!narratives.has(key)) return;
    const spec = NARRATIVE_SPEC_BY_KEY.get(key);
    if (!spec) return;
    push({
      id: `narrative:${key}`,
      kind,
      number: spec.number,
      title: spec.title,
      detail: requiredNarratives.has(key) ? 'Required for this profile' : undefined,
      narrativeKey: key,
    });
  };

  push({ id: 'letter', kind: 'letter', number: '', title: 'Letter of Transmittal' });
  pushNarrative('summary_of_salient_facts', 'summary');
  push({
    id: 'property-facts',
    kind: 'property_facts',
    number: 'I-A1',
    title: 'Property Identification & Valuation Facts',
  });
  push({
    id: 'executive-summary',
    kind: 'executive_summary',
    number: 'I-B',
    title: 'Executive Valuation Summary',
  });

  const maps = mapCount(data);
  if (maps > 0) {
    push({
      id: 'maps',
      kind: 'maps',
      number: 'EX-1',
      title: 'Subject Maps & Parcel Context',
      detail: `${maps} map exhibit${maps === 1 ? '' : 's'}`,
    });
  }

  const photos = photoCount(data);
  if (photos > 0) {
    push({
      id: 'photos',
      kind: 'photos',
      number: 'EX-2',
      title: 'Subject Photo Exhibit',
      detail: `${photos} image${photos === 1 ? '' : 's'}`,
    });
  }

  pushNarrative('assignment_and_scope', 'assignment_scope');
  pushNarrative('property_history');
  pushNarrative('assessment_data');
  pushNarrative('property_description');
  pushNarrative('site_description_narrative');
  pushNarrative('improvement_description_narrative');
  pushNarrative('condition_assessment');

  if (data.photos.some((photo) => (photo.ai_analysis?.defects?.length ?? 0) > 0)) {
    push({
      id: 'condition-table',
      kind: 'condition_table',
      number: 'III-G',
      title: 'Detailed Condition Evidence Table',
    });
  }

  pushNarrative('area_analysis_county');
  pushNarrative('area_analysis_city');
  pushNarrative('area_analysis_neighborhood');
  pushNarrative('market_analysis');
  pushNarrative('hbu_as_vacant');
  pushNarrative('hbu_as_improved');

  if (profile.isTaxAppeal) pushNarrative('appeal_argument_summary');
  pushNarrative('sales_comparison_narrative');

  if (data.comparableSales.length > 0) {
    push({
      id: 'comparable-grid',
      kind: 'comparable_grid',
      number: 'VII-B1',
      title: 'Comparable Sales Grid',
      detail: `${data.comparableSales.length} transaction${data.comparableSales.length === 1 ? '' : 's'}`,
    });
  }

  pushNarrative('adjustment_grid_narrative');

  if (data.comparableSales.length > 0) {
    push({
      id: 'comparable-profiles',
      kind: 'comparable_profiles',
      number: 'VII-C1',
      title: 'Comparable Sale Evidence Profiles',
      detail: `${data.comparableSales.length} profile${data.comparableSales.length === 1 ? '' : 's'}`,
    });
  }

  if (profile.hasIncomeApproach) {
    pushNarrative('income_approach_narrative');
    push({
      id: 'income-calculation',
      kind: 'income_calculation',
      number: 'VII-D1',
      title: 'Income Capitalization Calculation',
    });
  }

  if (profile.hasCostApproach) {
    pushNarrative('cost_approach_narrative');
    push({
      id: 'cost-calculation',
      kind: 'cost_calculation',
      number: 'VII-E1',
      title: 'Cost Approach Calculation',
    });
  }

  if (profile.isTaxAppeal) {
    pushNarrative('assessment_equity');
    if (data.property.assessment_ratio != null) {
      push({
        id: 'assessment-context',
        kind: 'assessment_context',
        number: 'VIII-A1',
        title: 'Assessment Level Context',
      });
    }
  }

  push({
    id: 'reconciliation',
    kind: 'reconciliation',
    number: 'VIII-B',
    title: 'Reconciliation & Final Value Conclusion',
  });

  if (profile.assignmentKind === 'tax_appeal' && data.filingGuide) {
    push({
      id: 'filing-guide',
      kind: 'filing_guide',
      number: 'ADD-A',
      title: 'Verified County Filing Instructions',
    });
  } else {
    const guide = profile.assignmentKind === 'pre_listing'
      ? { key: 'pricing_strategy_guide', title: 'Pricing Strategy Guide' }
      : profile.assignmentKind === 'pre_purchase'
        ? { key: 'negotiation_guide', title: 'Negotiation Strategy Guide' }
        : profile.assignmentKind === 'independent_valuation'
          ? { key: 'valuation_use_guide', title: 'Valuation Use & Next-Step Guide' }
          : null;
    if (guide && narratives.has(guide.key)) {
      push({
        id: `assignment-guide:${guide.key}`,
        kind: 'assignment_guide',
        number: 'ADD-A',
        title: guide.title,
        narrativeKey: guide.key,
      });
    }
  }

  pushNarrative('hearing_script');

  if (narratives.has('certification_and_limiting_conditions')) {
    push({
      id: 'certification',
      kind: 'certification',
      number: 'ADD-C',
      title: 'Certification Boundary & Limiting Conditions',
      narrativeKey: 'certification_and_limiting_conditions',
    });
  } else {
    push({
      id: 'disclaimer',
      kind: 'disclaimer',
      number: 'ADD-C',
      title: 'Certification Boundary & Limiting Conditions',
    });
  }

  return { profile, narratives, sections };
}
