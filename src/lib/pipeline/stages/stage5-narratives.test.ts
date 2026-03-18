// ─── Stage 5: Narrative Generation Tests ────────────────────────────────────

import { vi } from 'vitest';
import {
  makeReport,
  makePropertyData,
  makeComparableSale,
  makeCountyRule,
  makePhoto,
} from '@/lib/__tests__/fixtures';

// ─── Mock external services ─────────────────────────────────────────────────

const mockGenerateNarratives = vi.fn();
const mockGetCalibrationParams = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/services/anthropic', () => ({
  generateNarratives: (...args: unknown[]) => mockGenerateNarratives(...args),
}));

vi.mock('@/config/ai', () => ({
  AI_MODELS: { PRIMARY: 'claude-sonnet-4-20250514', FAST: 'claude-haiku-4-5-20251001' },
}));

vi.mock('@/lib/calibration/recalculate', () => ({
  getCalibrationParams: (...args: unknown[]) => mockGetCalibrationParams(...args),
}));

import { runNarratives } from '@/lib/pipeline/stages/stage5-narratives';

// ─── Supabase mock builder ──────────────────────────────────────────────────

function buildSupabaseMock(overrides?: {
  report?: ReturnType<typeof makeReport> | null;
  propertyData?: ReturnType<typeof makePropertyData> | null;
  comps?: ReturnType<typeof makeComparableSale>[];
  photos?: ReturnType<typeof makePhoto>[];
  countyRule?: ReturnType<typeof makeCountyRule> | null;
  deleteError?: string | null;
  insertError?: string | null;
}) {
  const report = overrides?.report !== undefined ? overrides.report : makeReport({ county_fips: '17167', latitude: 39.7817, longitude: -89.6501 });
  const propertyData = overrides?.propertyData !== undefined ? overrides.propertyData : makePropertyData();
  const comps = overrides?.comps ?? [makeComparableSale()];
  const photos = overrides?.photos ?? [];
  const countyRule = overrides?.countyRule !== undefined ? overrides.countyRule : makeCountyRule();

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      const chain: Record<string, any> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.is = vi.fn().mockReturnValue(chain);
      chain.ilike = vi.fn().mockReturnValue(chain);
      chain.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: overrides?.deleteError ? { message: overrides.deleteError } : null,
        }),
      });
      chain.insert = vi.fn().mockResolvedValue({
        error: overrides?.insertError ? { message: overrides.insertError } : null,
      });
      chain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      chain.single = vi.fn().mockImplementation(() => {
        if (table === 'reports') return Promise.resolve({ data: report, error: null });
        if (table === 'property_data') return Promise.resolve({ data: propertyData, error: null });
        if (table === 'county_rules') return Promise.resolve({ data: countyRule, error: null });
        if (table === 'income_analysis') return Promise.resolve({ data: null, error: null });
        if (table === 'calibration_params') return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      });

      // For non-single queries (select without .single())
      // Promise.all calls will resolve on the chain itself for tables that return arrays
      if (table === 'comparable_sales') {
        chain.then = (resolve: (v: any) => void) => resolve({ data: comps, error: null });
        // Make it thenable for Promise.all
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: comps, error: null }),
          }),
        };
      }
      if (table === 'comparable_rentals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'photos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: photos, error: null }),
          }),
        };
      }

      return chain;
    }),
  };

  return supabase as any;
}

// ─── Default narrative result ───────────────────────────────────────────────

const narrativeSections = [
  { section_name: 'executive_summary', content: 'The subject property is over-assessed.' },
  { section_name: 'property_description', content: 'A 1,800 sqft single-family residence.' },
  { section_name: 'sales_comparison_narrative', content: 'Three comparable sales support a lower value.' },
];

const narrativeResult = {
  data: {
    sections: narrativeSections,
    prompt_tokens: 2000,
    completion_tokens: 500,
    generation_duration_ms: 3200,
  },
  error: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateNarratives.mockResolvedValue(narrativeResult);
});

describe('runNarratives', () => {
  it('generates sections and inserts narratives', async () => {
    const supabase = buildSupabaseMock();
    const result = await runNarratives('rpt_test_001', supabase);

    expect(result.success).toBe(true);
    expect(mockGenerateNarratives).toHaveBeenCalledOnce();

    // Verify the payload passed to generateNarratives
    const payload = mockGenerateNarratives.mock.calls[0][0];
    expect(payload.reportId).toBe('rpt_test_001');
    expect(payload.propertyType).toBe('residential');
    expect(payload.comparableSales.length).toBeGreaterThan(0);
  });

  it('fails when report is not found', async () => {
    const supabase = buildSupabaseMock({ report: null });
    const result = await runNarratives('rpt_nonexistent', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch report');
  });

  it('fails when property_data is not found', async () => {
    const supabase = buildSupabaseMock({ propertyData: null });
    const result = await runNarratives('rpt_test_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No property_data found');
  });

  it('fails when narrative generation returns error', async () => {
    mockGenerateNarratives.mockResolvedValue({
      data: null,
      error: 'Anthropic API rate limited',
    });

    const supabase = buildSupabaseMock();
    const result = await runNarratives('rpt_test_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Narrative generation failed');
  });

  it('fails when inserting narratives returns error', async () => {
    const supabase = buildSupabaseMock({ insertError: 'DB constraint violation' });
    const result = await runNarratives('rpt_test_001', supabase);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to insert report_narratives');
  });

  it('handles commercial service type with income data in payload', async () => {
    const report = makeReport({
      service_type: 'tax_appeal',
      property_type: 'commercial',
      county_fips: '17167',
      latitude: 39.7817,
      longitude: -89.6501,
    });

    const supabase = buildSupabaseMock({ report });
    const result = await runNarratives('rpt_test_001', supabase);

    expect(result.success).toBe(true);
    const payload = mockGenerateNarratives.mock.calls[0][0];
    expect(payload.propertyType).toBe('commercial');
  });

  it('includes photo analyses when photos exist', async () => {
    const photos = [
      makePhoto({
        id: 'photo_1',
        photo_type: 'exterior_front',
        ai_analysis: {
          condition_rating: 'fair',
          defects: [{ type: 'roof_damage', severity: 'moderate', value_impact: 'medium', description: 'Missing shingles' }],
          inferred_direction: 'front',
          professional_caption: 'Front view showing roof damage.',
          comparable_adjustment_note: 'Condition below average.',
        },
      }),
    ];

    const supabase = buildSupabaseMock({ photos });
    const result = await runNarratives('rpt_test_001', supabase);

    expect(result.success).toBe(true);
    const payload = mockGenerateNarratives.mock.calls[0][0];
    expect(payload.photoAnalyses).toBeDefined();
    expect(payload.photoAnalyses).toHaveLength(1);
    expect(payload.photoAnalyses[0].condition_rating).toBe('fair');
  });
});
