import { describe, expect, it } from 'vitest';

import type { ReportTemplateData } from '@/lib/templates/report-template';
import {
  evaluatePdfReleasePolicy,
  type PdfReleasePolicyResult,
} from '@/lib/valuation/pdf-release-policy';
import type { TaxAppealReleaseResult } from '@/lib/valuation/tax-appeal-release-policy';
import {
  buildReportArtifactPaths,
  createReportArtifactManifest,
  hashPdfBuffer,
  serializeReportArtifactManifest,
} from './report-artifact-manifest';

const valuationRelease: PdfReleasePolicyResult = {
  hasComparableSales: true,
  hasConcludedValue: true,
  incomeAssessment: null,
  costAssessment: null,
  evidenceBackedAlternatives: [],
  conclusionReconcilesToAlternative: false,
  warnings: ['Only 2 comparable sales (minimum 3 recommended)'],
  hardFailures: [],
};

const jurisdictionRelease: TaxAppealReleaseResult = {
  allowed: true,
  code: 'JURISDICTION_RELEASE_READY',
  message: 'The tax-appeal filing package matches the current verified jurisdiction record.',
  jurisdictionEvaluation: null,
};

const jurisdictionNotRequired: TaxAppealReleaseResult = {
  allowed: true,
  code: 'JURISDICTION_RELEASE_NOT_REQUIRED',
  message: 'A filing-jurisdiction release check is not required for this assignment.',
  jurisdictionEvaluation: null,
};

function narrative(section_name: string, content = `${section_name} content`) {
  return {
    id: section_name,
    report_id: 'report-123',
    section_name,
    content,
    generated_at: '2026-07-18T00:00:00.000Z',
    model_used: 'test',
    prompt_tokens: 1,
    completion_tokens: 1,
    generation_duration_ms: 1,
    admin_edited: false,
    admin_edited_content: null,
  };
}

function createData(): ReportTemplateData {
  return {
    report: {
      id: 'report-123',
      client_email: 'private@example.com',
      client_name: 'Private Customer',
      property_address: '123 Private Street',
      city: 'Chicago',
      service_type: 'tax_appeal',
      desired_outcome: null,
      is_retrospective_assignment: false,
      valuation_effective_date: '2026-01-01',
      valuation_effective_date_source: 'jurisdiction_convention',
      created_at: '2026-01-15T00:00:00.000Z',
      property_type: 'residential',
      review_tier: 'expert_reviewed',
      county_fips: '17031',
      county: 'Cook County',
      state: 'Illinois',
      state_abbreviation: 'IL',
      property_issues: [],
      additional_notes: null,
    },
    property: {
      property_subtype: 'Single Family Residence',
      property_class_description: 'Residential',
      property_class_source_authority: 'Cook County Assessor',
      property_class_source_url: 'https://assessor.example.gov/parcel/123',
      overall_condition: 'average',
      condition_notes: null,
      zoning_conformance: 'Legal conforming',
      deed_history: null,
      data_collection_notes: null,
      building_sqft_gross: 1800,
      building_sqft_living_area: 1800,
      assessment_ratio: 0.1,
      assessment_methodology: 'Cook County residential classification',
      tax_year_in_appeal: 2026,
      flood_zone_designation: 'Zone X',
      flood_map_panel_number: '17031C0001J',
      flood_map_panel_date: '2024-01-01',
      fema_raw_response: { source: 'FEMA NFHL' },
      cost_approach_rcn: null,
      cost_approach_value: null,
      physical_depreciation_pct: null,
      functional_obsolescence_pct: null,
      land_value: null,
      cost_replacement_source_authority: null,
      cost_depreciation_source_authority: null,
      cost_land_source_authority: null,
      cost_source_references: null,
      cost_methodology: null,
      cost_effective_date: null,
      cost_verification_state: null,
      cost_verified_by: null,
      cost_verified_at: null,
    },
    comparableSales: [
      {
        id: 'sale-1',
        county_recorder_url: 'https://recorder.example/sale-1',
        deed_document_number: 'DOC-1',
        is_distressed_sale: false,
      },
      {
        id: 'sale-2',
        county_recorder_url: null,
        deed_document_number: null,
        is_distressed_sale: true,
      },
    ],
    comparableRentals: [],
    photos: [{ id: 'photo-1', storage_path: 'reports/photo-1.jpg', ai_analysis: null }],
    narratives: [
      narrative('assignment_and_scope'),
      narrative('summary_of_salient_facts'),
      narrative('executive_summary'),
      narrative('property_history'),
      narrative('assessment_data'),
      narrative('property_description'),
      narrative('area_analysis_city', 'Chicago Area Analysis'),
      narrative('area_analysis_county', 'Cook County regional context'),
      narrative('market_analysis', 'Q1 2026 residential market summary'),
      narrative('hbu_as_vacant'),
      narrative('hbu_as_improved'),
      narrative('appeal_argument_summary', 'Market value and assessment equity argument'),
      narrative('sales_comparison_narrative'),
      narrative('adjustment_grid_narrative'),
      narrative('assessment_equity'),
      narrative('reconciliation_narrative'),
    ],
    countyRule: {
      county_fips: '17031',
      state_abbreviation: 'IL',
      last_verified_date: '2026-07-01',
      assessment_ratio_residential: 0.1,
      assessment_ratio_commercial: 0.25,
      assessment_ratio_industrial: 0.25,
      assessment_ratio_agricultural: null,
      level_of_assessment_residential: 0.1,
      level_of_assessment_commercial: 0.25,
      valuation_date_convention: 'January 1 of the assessment year',
      fair_cash_value_synonym: true,
      jurisdiction_plugin_key: 'cook_county_classification',
      jurisdiction_plugin_version: 1,
    },
    filingGuide: {
      appeal_board_name: 'Cook County Board of Review',
      filing_deadline: 'See current township schedule',
      steps: ['Prepare evidence'],
      required_documents: ['Assessment notice'],
      tips: [],
    },
    maps: {},
    incomeAnalysis: null,
    concludedValue: 425_000,
    valuationDate: '2026-01-01',
    reportDate: '2026-01-15',
  } as unknown as ReportTemplateData;
}

describe('report artifact manifest', () => {
  it('uses the PDF bytes to produce immutable release paths', () => {
    const pdf = Buffer.from('%PDF-1.7 deterministic bytes');
    const hash = hashPdfBuffer(pdf);
    const paths = buildReportArtifactPaths('report-123', '2026-07-18T15:04:05.678Z', hash);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(paths).toEqual({
      pdfPath: `report-123/releases/20260718T150405678Z_${hash.slice(0, 16)}.pdf`,
      manifestPath: `report-123/releases/20260718T150405678Z_${hash.slice(0, 16)}.manifest.json`,
    });
  });

  it('records structural provenance without customer PII or report prose', () => {
    const pdf = Buffer.from('%PDF-1.7 deterministic bytes');
    const manifest = createReportArtifactManifest({
      data: createData(),
      pdfBuffer: pdf,
      generatedAt: '2026-07-18T15:04:05.678Z',
      valuationRelease,
      jurisdictionRelease,
    });
    const serialized = serializeReportArtifactManifest(manifest).toString('utf8');

    expect(manifest.schemaVersion).toBe('1.5.0');
    expect(manifest.rendererVersion).toBe('react-pdf-2');
    expect(manifest.artifact.bytes).toBe(pdf.byteLength);
    expect(manifest.artifact.sha256).toBe(hashPdfBuffer(pdf));
    expect(manifest.report).toMatchObject({
      profileId: 'resourceful-v2:tax_appeal:complex:sales',
      documentTitle: 'Property Tax Appeal Valuation Analysis',
    });
    expect(manifest.report.narrativeSections).toContain('assessment_equity');
    expect(manifest.evidence).toMatchObject({
      comparableSales: 2,
      comparableRentals: 0,
      photos: 1,
      narratives: 16,
      sourceBackedComparableSales: 1,
      distressedComparableSales: 1,
      filingGuideIncluded: true,
      costApproachReleaseReady: false,
    });
    expect(manifest.jurisdiction).toMatchObject({
      reportCountyFips: '17031',
      ruleCountyFips: '17031',
      reportState: 'IL',
      ruleState: 'IL',
      pluginKey: 'cook_county_classification',
      pluginVersion: 1,
      releaseReady: true,
      releaseCode: 'JURISDICTION_RELEASE_READY',
      assessmentYear: 2026,
      valuationDate: '2026-01-01',
      valuationDateSource: 'jurisdiction_convention',
      appliedAssessmentRatio: 0.1,
      expectedAssessmentRatio: 0.1,
      classificationSourceVerified: true,
      requiresYearSpecificEqualizationSource: true,
    });
    expect(manifest.strategy).toMatchObject({
      flags: expect.arrayContaining(['tax_appeal']),
      isRetrospectiveAssignment: false,
    });
    expect(manifest.integrity).toMatchObject({
      releaseReady: true,
      hardFailureCodes: [],
      warningCodes: expect.arrayContaining(['TECHNOLOGY_REVIEW_REQUIRED']),
    });
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('Private Customer');
    expect(serialized).not.toContain('123 Private Street');
    expect(serialized).not.toContain('Prepare evidence');
    expect(serialized).not.toContain('Market value and assessment equity argument');
    expect(serialized).not.toContain('https://assessor.example.gov/parcel/123');
  });

  it('records cost readiness only when the authoritative release policy approves it', () => {
    const data = createData();
    Object.assign(data.property, {
      cost_approach_rcn: 500_000,
      cost_approach_value: 470_000,
      physical_depreciation_pct: 10,
      functional_obsolescence_pct: 0,
      land_value: 20_000,
      cost_replacement_source_authority: 'Marshall & Swift/Boeckh, 2025 local cost service',
      cost_depreciation_source_authority: 'Documented age-life analysis reviewed by Test Reviewer',
      cost_land_source_authority: 'Verified land-sale workfile and assessor record',
      cost_source_references: {
        replacementCost: 'MSB-2025-Q1-local-index',
        depreciation: 'workfile/depreciation-analysis-1',
        landValue: 'workfile/land-sales-1',
      },
      cost_methodology: 'RCN less physical and functional depreciation, plus land value.',
      cost_effective_date: '2026-01-01',
      cost_verification_state: 'verified',
      cost_verified_by: 'Test Reviewer, controlled fixture',
      cost_verified_at: '2026-07-18T12:00:00.000Z',
    });
    data.narratives.push(narrative('cost_approach_narrative'));

    const costValuationRelease = evaluatePdfReleasePolicy({
      comparableSaleCount: data.comparableSales.length,
      concludedValue: data.concludedValue,
      costApproach: {
        replacementCostNew: data.property.cost_approach_rcn,
        concludedValue: data.property.cost_approach_value,
        physicalDepreciationPct: data.property.physical_depreciation_pct,
        functionalObsolescencePct: data.property.functional_obsolescence_pct,
        landValue: data.property.land_value,
        replacementCostSourceAuthority: data.property.cost_replacement_source_authority,
        depreciationSourceAuthority: data.property.cost_depreciation_source_authority,
        landValueSourceAuthority: data.property.cost_land_source_authority,
        sourceReferences: data.property.cost_source_references,
        methodology: data.property.cost_methodology,
        costEffectiveDate: data.property.cost_effective_date,
        expectedEffectiveDate: data.valuationDate,
        verificationState: data.property.cost_verification_state,
        verifiedBy: data.property.cost_verified_by,
        verifiedAt: data.property.cost_verified_at,
      },
    });

    const manifest = createReportArtifactManifest({
      data,
      pdfBuffer: Buffer.from('%PDF-1.7 cost evidence bytes'),
      generatedAt: '2026-07-18T15:04:05.678Z',
      valuationRelease: costValuationRelease,
      jurisdictionRelease,
    });

    expect(costValuationRelease.costAssessment?.isReleaseReady).toBe(true);
    expect(manifest.report.profileId).toBe('resourceful-v2:tax_appeal:complex:sales-cost');
    expect(manifest.evidence.costApproachReleaseReady).toBe(true);
  });

  it('does not record tax-appeal assessment context for an independent valuation override', () => {
    const data = createData();
    data.report.desired_outcome = '[INDEPENDENT_VALUATION] Estate planning decision support';
    data.report.valuation_effective_date_source = 'intake_current_date';
    data.filingGuide = null;

    const manifest = createReportArtifactManifest({
      data,
      pdfBuffer: Buffer.from('%PDF-1.7 independent valuation bytes'),
      generatedAt: '2026-07-18T15:04:05.678Z',
      valuationRelease,
      jurisdictionRelease: jurisdictionNotRequired,
    });

    expect(manifest.report.profileId).toBe('resourceful-v2:independent_valuation:complex:sales');
    expect(manifest.strategy.flags).not.toContain('tax_appeal');
    expect(manifest.jurisdiction).toMatchObject({
      releaseCode: 'JURISDICTION_RELEASE_NOT_REQUIRED',
      valuationDateSource: 'intake_current_date',
      appliedAssessmentRatio: null,
      expectedAssessmentRatio: null,
      requiresYearSpecificEqualizationSource: false,
    });
  });

  it('rejects malformed artifact identity inputs', () => {
    expect(() => buildReportArtifactPaths('', '2026-07-18T15:04:05.678Z', 'a'.repeat(64))).toThrow(
      'Report ID is required'
    );
    expect(() => buildReportArtifactPaths('report-123', 'not-a-date', 'a'.repeat(64))).toThrow(
      'valid date'
    );
    expect(() => buildReportArtifactPaths('report-123', '2026-07-18T15:04:05.678Z', 'not-a-hash')).toThrow(
      '64-character hexadecimal'
    );
  });
});
