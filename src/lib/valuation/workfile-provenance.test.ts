import { describe, expect, it } from 'vitest';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import {
  getClassificationSourceEvidence,
  getJurisdictionPlugin,
  getRegulatorySourceEvidence,
  getUnitCountEvidence,
  getValuationEffectiveDateEvidence,
  isCookCountyJurisdiction,
  isHttpUrl,
  isRetrospectiveAssignment,
} from './workfile-provenance';

function data(overrides: Record<string, unknown> = {}): ReportTemplateData {
  return {
    report: {
      service_type: 'pre_purchase',
      is_retrospective_assignment: false,
      valuation_effective_date: null,
      valuation_effective_date_source: null,
    },
    property: {},
    countyRule: null,
    ...overrides,
  } as unknown as ReportTemplateData;
}

describe('workfile provenance', () => {
  it('requires effective date and source as one verified pair', () => {
    const verified = data({
      report: {
        service_type: 'pre_purchase',
        valuation_effective_date: '2026-07-18',
        valuation_effective_date_source: 'intake_current_date',
      },
    });
    expect(getValuationEffectiveDateEvidence(verified)).toEqual({
      date: '2026-07-18',
      source: 'intake_current_date',
      isVerified: true,
    });

    const missingSource = data({
      report: {
        service_type: 'pre_purchase',
        valuation_effective_date: '2026-07-18',
        valuation_effective_date_source: null,
      },
    });
    expect(getValuationEffectiveDateEvidence(missingSource).isVerified).toBe(false);
  });

  it('requires structured unit count, attributed source type, and reference', () => {
    const verified = data({
      property: {
        unit_count: 12,
        unit_count_source_type: 'public_record',
        unit_count_source_reference: 'County assessor property record',
      },
    });
    expect(getUnitCountEvidence(verified)).toMatchObject({
      count: 12,
      sourceType: 'public_record',
      isVerified: true,
    });

    const proseOnly = data({
      property: {
        property_class_description: '12-unit apartment building',
        data_collection_notes: 'The subject contains 12 units.',
      },
    });
    expect(getUnitCountEvidence(proseOnly).isVerified).toBe(false);
  });

  it('requires official authority and HTTP(S) URL for regulatory and classification sources', () => {
    const verified = data({
      property: {
        regulatory_source_authority: 'City Department of Buildings',
        regulatory_source_url: 'https://city.example.gov/case/123',
        property_class_source_authority: 'County Assessor',
        property_class_source_url: 'https://assessor.example.gov/parcel/123',
      },
    });
    expect(getRegulatorySourceEvidence(verified).isVerified).toBe(true);
    expect(getClassificationSourceEvidence(verified).isVerified).toBe(true);

    const unsafe = data({
      property: {
        regulatory_source_authority: 'Unknown source',
        regulatory_source_url: 'javascript:alert(1)',
      },
    });
    expect(getRegulatorySourceEvidence(unsafe).isVerified).toBe(false);
    expect(isHttpUrl('ftp://example.com/file')).toBe(false);
  });

  it('uses explicit retrospective assignment metadata instead of elapsed time', () => {
    expect(isRetrospectiveAssignment(data())).toBe(false);
    expect(
      isRetrospectiveAssignment(
        data({ report: { service_type: 'pre_purchase', is_retrospective_assignment: true } })
      )
    ).toBe(true);
  });

  it('derives Cook County behavior from the versioned county-rule plugin', () => {
    const rule = {
      jurisdiction_plugin_key: 'cook_county_classification',
      jurisdiction_plugin_version: 1,
    } as never;
    expect(getJurisdictionPlugin(rule)).toEqual({
      key: 'cook_county_classification',
      version: 1,
    });
    expect(isCookCountyJurisdiction(rule)).toBe(true);
    expect(isCookCountyJurisdiction({ county_fips: '17031' } as never)).toBe(false);
  });
});
