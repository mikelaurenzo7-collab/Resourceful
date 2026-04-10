export const NARRATIVE_DISPLAY_NAMES = {
  assignment_and_scope: 'Assignment & Scope',
  summary_of_salient_facts: 'Summary of Salient Facts',
  property_history: 'Property History',
  assessment_data: 'Assessment Data',
  executive_summary: 'Executive Summary',
  condition_assessment: 'Condition Assessment',
  appeal_argument_summary: 'Appeal Argument Summary',
  hearing_script: 'Hearing Presentation Script',
  sales_comparison_narrative: 'Sales Comparison Analysis',
  adjustment_grid_narrative: 'Adjustment Grid Analysis',
  income_approach_narrative: 'Income Approach',
  cost_approach_narrative: 'Cost Approach',
  reconciliation_narrative: 'Value Reconciliation',
  certification_and_limiting_conditions: 'Certification & Limiting Conditions',
  market_analysis: 'Market Analysis',
  assessment_equity: 'Assessment Equity Analysis',
  area_analysis_county: 'County Area Analysis',
  area_analysis_city: 'City Area Analysis',
  area_analysis_neighborhood: 'Neighborhood Analysis',
  hbu_as_vacant: 'Highest & Best Use (Vacant)',
  hbu_as_improved: 'Highest & Best Use (Improved)',
  pricing_strategy_guide: 'Pricing Strategy Guide',
  negotiation_guide: 'Negotiation Guide',
  property_description: 'Property Description',
  site_description_narrative: 'Site Description',
  improvement_description_narrative: 'Improvement Description',
} as const;

const NARRATIVE_ALIASES = {
  income_approach_narrative: ['income_approach'],
  cost_approach_narrative: ['cost_approach'],
  reconciliation_narrative: ['reconciliation'],
} as const;

type NarrativeAliasKey = keyof typeof NARRATIVE_ALIASES;

export interface NarrativeRecordLike {
  section_name: string;
  content: string;
}

export function findNarrativeContent(
  narratives: NarrativeRecordLike[],
  sectionName: string
): string | null {
  const candidateKeys = [sectionName, ...getNarrativeAliases(sectionName)];

  for (const candidateKey of candidateKeys) {
    const match = narratives.find(
      (narrative) => narrative.section_name === candidateKey && narrative.content.trim().length > 0
    );
    if (match) {
      return match.content;
    }
  }

  return null;
}

export function getNarrativeDisplayName(sectionName: string): string {
  return (
    NARRATIVE_DISPLAY_NAMES[sectionName as keyof typeof NARRATIVE_DISPLAY_NAMES] ??
    humanizeNarrativeSectionName(sectionName)
  );
}

function getNarrativeAliases(sectionName: string): readonly string[] {
  if (sectionName in NARRATIVE_ALIASES) {
    return NARRATIVE_ALIASES[sectionName as NarrativeAliasKey];
  }

  return [];
}

function humanizeNarrativeSectionName(sectionName: string): string {
  return sectionName
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}