// ─── AI Service Contract ──────────────────────────────────────────────────────
// Historical filename retained to avoid a broad import migration. Runtime work is
// delegated to GPT-5.6 Sol in openai-appraiser.ts. This file now owns only the
// stable payload/response contract consumed by pipeline stages.

import type { PhotoAiAnalysis, PhotoDefect } from '@/types/database';

export interface NarrativePayload {
  reportId: string;
  serviceType: string;
  propertyType: string;
  propertyAddress: string;
  desiredOutcome?: string | null;
  propertyData: {
    year_built: number | null;
    building_sqft_gross: number | null;
    building_sqft_living_area: number | null;
    lot_size_sqft: number | null;
    assessed_value: number | null;
    market_value_estimate_low: number | null;
    market_value_estimate_high: number | null;
    property_class: string | null;
    property_subtype?: string | null;
    zoning_designation: string | null;
    flood_zone_designation: string | null;
    effective_age?: number | null;
    effective_age_source?: string | null;
    physical_depreciation_pct?: number | null;
    remaining_economic_life?: number | null;
    economic_life_years?: number | null;
    data_source_notes?: string | null;
    assessed_value_source?: string | null;
    lot_frontage_ft?: number | null;
    lot_depth_ft?: number | null;
    lot_shape_description?: string | null;
    legal_description?: string | null;
    zoning_description?: string | null;
    owner_name?: string | null;
    apn?: string | null;
  };
  comparableSales: Array<{
    address: string;
    sale_price: number;
    sale_date: string;
    building_sqft: number | null;
    price_per_sqft: number | null;
    distance_miles: number | null;
    adjusted_price_per_sqft: number | null;
  }>;
  comparableRentals?: Array<{
    address: string;
    rent_per_sqft_yr: number | null;
    building_sqft_leased: number | null;
    lease_type: string | null;
    effective_net_rent_per_sqft: number | null;
  }>;
  incomeAnalysis?: {
    net_operating_income: number | null;
    concluded_cap_rate: number | null;
    concluded_value_income_approach: number | null;
  };
  countyRules: {
    countyName: string;
    state: string;
    stateAbbreviation?: string | null;
    assessmentMethodology: string;
    assessmentRatioResidential?: number | null;
    assessmentRatioCommercial?: number | null;
    assessmentRatio?: number | null;
    appealBoardName?: string | null;
    assessmentCycle?: string | null;
    appealDeadlineRule?: string | null;
    hearingFormat?: string | null;
    informalReviewAvailable?: boolean | null;
    proSeTips?: string | null;
    boardPersonalityNotes?: string | null;
    winningArgumentPatterns?: string | null;
    commonAssessorErrors?: string | null;
    successRatePct?: number | null;
    costApproachDisfavored?: boolean | null;
    fairCashValueSynonym?: boolean | null;
  };
  concludedValue: number;
  photoAnalyses?: Array<{
    photo_type: string;
    condition_rating: string;
    defects: PhotoDefect[];
    professional_caption: string;
    comparable_adjustment_note: string;
  }>;
  photoAttribution?: {
    concludedValueWithPhotos: number;
    concludedValueWithoutPhotos: number;
    photoImpactDollars: number;
    photoImpactPct: number;
    photoConditionAdjustmentPct: number;
    totalDefects: number;
    significantDefects: number;
  } | null;
  floodZone?: string | null;
  reviewTier?: 'auto' | 'expert_reviewed' | 'guided_filing' | 'full_representation';
  overvaluationAnalysis?: {
    assessedValuePerSqft: number | null;
    medianCompPricePerSqft: number | null;
    overvaluationPct: number | null;
    assessmentRatioImplied: number | null;
    assessmentRatioExpected: number | null;
    assessmentRatioMismatch: boolean;
    attomMarketRangeLow: number | null;
    attomMarketRangeHigh: number | null;
    assessedExceedsAttomRange: boolean;
    marketTrendPct: number | null;
    effectiveAge: number | null;
    physicalDepreciationPct?: number | null;
    remainingEconomicLife?: number | null;
    buildingSqftFromAssessor: number | null;
    dataAnomalies: string[];
    isUnderassessed?: boolean;
    underassessmentPct?: number | null;
    caseStrengthScore?: number;
    caseValueAtStake?: number;
    costApproachRcn?: number | null;
    costApproachValue?: number | null;
    landValue?: number | null;
    functionalObsolescencePct?: number | null;
    functionalObsolescenceNotes?: string | null;
    distressedCompCount?: number;
  };
  assessmentEquity?: {
    neighborCount: number;
    subjectAssessedPerSqft: number | null;
    medianNeighborAssessedPerSqft: number | null;
    equityRatioPct: number | null;
    isOverAssessed: boolean;
    neighborSample: Array<{
      address: string;
      assessedPerSqft: number;
      buildingSquareFeet: number;
      yearBuilt: number | null;
      distanceMiles: number | null;
    }>;
  } | null;
  researchIntelligence?: {
    strategyInsights: string;
    deadlineInfo: string | null;
    boardIntelligence: string | null;
    recentChanges: string | null;
    sources: string[];
  } | null;
  valueDetractors?: {
    detractors: Array<{
      type: string;
      name: string;
      distance_meters: number;
      estimated_impact_pct: number;
      details: string;
    }>;
    totalEstimatedImpactPct: number;
    summary: string;
  } | null;
  priorSaleAnalysis?: {
    lastSalePrice: number;
    lastSaleDate: string;
    yearsElapsed: number;
    annualAppreciationPct: number;
    extrapolatedValue: number;
  } | null;
  deferredMaintenanceAnalysis?: {
    severity: string;
    appraiserDescription: string;
    estimatedCostToCure: number | null;
    primaryDefectType: string | null;
    justification: string;
  } | null;
}

export interface FilingGuidePayload {
  propertyAddress: string;
  countyName: string;
  state: string;
  assessedValue: number;
  concludedValue: number;
  potentialSavings: number;
  appealDeadline: string | null;
  appealBoardName: string | null;
  appealBoardAddress: string | null;
  appealBoardPhone: string | null;
  portalUrl: string | null;
  filingEmail: string | null;
  acceptsOnlineFiling: boolean;
  acceptsEmailFiling: boolean;
  requiresMailFiling: boolean;
  appealFormName: string | null;
  formDownloadUrl: string | null;
  evidenceRequirements: string[] | null;
  hearingFormat: string | null;
  filingFeeCents: number | null;
  proSeTips: string | null;
  appealArgumentSummary: string | null;
  filingFeeNotes: string | null;
  hearingTypicallyRequired: boolean;
  typicalResolutionWeeksMin: number | null;
  typicalResolutionWeeksMax: number | null;
  stateAppealBoardName: string | null;
  stateAppealBoardUrl: string | null;
  filingInstructions?: string | null;
  requiredForms?: string[] | null;
  onlineFilingUrl?: string | null;
  assessorPhone?: string | null;
  appealFeeCents?: number | null;
  reviewTier?: 'auto' | 'expert_reviewed' | 'guided_filing' | 'full_representation';
  serviceType?: 'tax_appeal' | 'pre_purchase' | 'pre_listing';
  assessmentCycle?: string | null;
  assessmentNoticesMailed?: string | null;
  appealWindowDays?: number | null;
  nextAppealDeadline?: string | null;
  currentTaxYear?: number | null;
  filingSteps?: { step_number: number; title: string; description: string; url?: string; form_name?: string }[] | null;
  requiredDocuments?: string[] | null;
  informalReviewAvailable?: boolean;
  informalReviewNotes?: string | null;
  hearingDurationMinutes?: number | null;
  hearingSchedulingNotes?: string | null;
  virtualHearingAvailable?: boolean;
  virtualHearingPlatform?: string | null;
  authorizedRepAllowed?: boolean | null;
  authorizedRepTypes?: string[] | null;
  authorizedRepFormUrl?: string | null;
  repRestrictionsNotes?: string | null;
  furtherAppealBody?: string | null;
  furtherAppealDeadlineRule?: string | null;
  furtherAppealUrl?: string | null;
  boardPersonalityNotes?: string | null;
  winningArgumentPatterns?: string | null;
  successRatePct?: number | null;
}

const NARRATIVE_SECTION_NAMES = [
  'assignment_and_scope',
  'summary_of_salient_facts',
  'property_history',
  'assessment_data',
  'executive_summary',
  'property_description',
  'site_description_narrative',
  'improvement_description_narrative',
  'condition_assessment',
  'area_analysis_county',
  'area_analysis_city',
  'area_analysis_neighborhood',
  'market_analysis',
  'hbu_as_vacant',
  'hbu_as_improved',
  'sales_comparison_narrative',
  'adjustment_grid_narrative',
  'income_approach_narrative',
  'cost_approach_narrative',
  'assessment_equity',
  'reconciliation_narrative',
  'certification_and_limiting_conditions',
  'appeal_argument_summary',
  'hearing_script',
] as const;

export type NarrativeSectionName = typeof NARRATIVE_SECTION_NAMES[number];

export interface NarrativeSection {
  section_name: NarrativeSectionName;
  content: string;
}

export interface NarrativeResponse {
  sections: NarrativeSection[];
  prompt_tokens: number;
  completion_tokens: number;
  generation_duration_ms: number;
}

export interface FilingGuideResponse {
  guide: string;
  prompt_tokens: number;
  completion_tokens: number;
  generation_duration_ms: number;
}

export interface PhotoAnalysisResponse {
  analysis: PhotoAiAnalysis;
  prompt_tokens: number;
  completion_tokens: number;
  generation_duration_ms: number;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

export {
  analyzePhoto,
  generateFilingGuide,
  generateNarratives,
} from '@/lib/services/openai-appraiser';
