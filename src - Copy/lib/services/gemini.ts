// ─── Claude Vision Service (formerly Gemini) ─────────────────────────────────
// Gemini has been removed from this pipeline. All document OCR and multi-image
// visual reasoning now uses Claude with extended thinking, multi-image vision,
// and structured tool output — making Claude the sole AI provider.
//
// Exported types and function signatures are UNCHANGED — all callers
// (stage4, tax-bill route, photo-analysis route) are backward-compatible.
//
// The core architectural win over the prior Gemini approach:
//   - Extended thinking gives Claude a private scratchpad to reason across
//     all photos before committing to a structured answer. This produces
//     holistic, cross-photo synthesis that static prompt-only calls miss.
//   - Tool use with forced schema guarantees the output is always parseable
//     without brittle JSON regex extraction.
//   - Single provider = one API key, one retry policy, one cost center.

import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS, AI_THINKING_BUDGETS } from '@/config/ai';
import { apiLogger } from '@/lib/logger';
import { withRetry, isRetryableError } from '@/lib/utils/retry';

// ─── Exported Types (unchanged from Gemini era — callers unmodified) ──────────

export interface ExtractedTaxBill {
  parcelId: string | null;
  assessedValue: number | null;
  marketValue: number | null;
  taxYear: string | null;
  jurisdiction: string | null;
  confidence: number; // 0–100
}

export interface DeferredMaintenanceAnalysis {
  severity: 'none' | 'minor' | 'moderate' | 'severe';
  appraiserDescription: string;
  estimatedCostToCure: number | null;
  primaryDefectType: string | null;
  justification: string;
}

// ─── Claude Client ────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set. Vision features will not work.');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 300_000 });
  }
  return _client;
}

// ─── Extended Thinking Helper ─────────────────────────────────────────────────
//
// Extended thinking ("adaptive thinking") gives Claude a private scratchpad to
// reason through complex visual or document evidence before committing to a
// structured answer. Claude naturally allocates reasoning depth proportional
// to problem complexity within the given budget — ambiguous photos or dense
// multi-page tax documents trigger deeper inspection; clear cases resolve quickly.
//
// Gracefully degrades: if the configured model doesn't support thinking
// (e.g., Haiku), we fall back to a standard call without interrupting the pipeline.

async function createWithThinking(
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'thinking'>,
  budgetTokens: number
): Promise<Anthropic.Message> {
  const thinkingParams: Anthropic.MessageCreateParamsNonStreaming = {
    ...params,
    // Total max_tokens must cover both the thinking budget AND the actual response.
    max_tokens: budgetTokens + (params.max_tokens ?? 3000),
    thinking: { type: 'enabled', budget_tokens: budgetTokens },
  };

  try {
    return await withRetry(
      () => getClient().messages.create(thinkingParams),
      { maxAttempts: 2, baseDelayMs: 3000, retryOn: isRetryableError }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isThinkingUnsupported =
      msg.toLowerCase().includes('thinking') ||
      msg.toLowerCase().includes('extended_thinking') ||
      msg.toLowerCase().includes('not supported');
    if (isThinkingUnsupported) {
      apiLogger.warn(
        { model: params.model },
        '[claude-vision] Extended thinking not available on this model — falling back to standard call'
      );
      return withRetry(
        () => getClient().messages.create({ ...params, max_tokens: params.max_tokens ?? 3000 }),
        { maxAttempts: 3, baseDelayMs: 2000, retryOn: isRetryableError }
      );
    }
    throw err;
  }
}

// ─── Media Block Builder ──────────────────────────────────────────────────────
// Builds the correct Anthropic content block for an image or PDF document.

function buildMediaBlock(mimeType: string, base64Data: string): Anthropic.ContentBlockParam {
  if (mimeType === 'application/pdf') {
    // Claude document block — supports multi-page PDFs natively
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
    } as unknown as Anthropic.ContentBlockParam;
  }

  // Map any unsupported image type (HEIC, TIFF) to the nearest Claude-native type.
  const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const mediaType = (SUPPORTED.has(mimeType) ? mimeType : 'image/jpeg') as
    'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: base64Data },
  };
}

// ─── Tax Bill OCR ─────────────────────────────────────────────────────────────

/**
 * Extract structured fields from a county property tax bill or assessment notice.
 *
 * Uses Claude vision + extended thinking. The thinking budget lets Claude reason
 * through ambiguous field names, multi-year tables, and partial-page overlaps
 * before committing to the structured tool output. This is especially effective
 * on Cook County multi-page bills where assessed value appears 3-4 times with
 * different labels (land, improvement, total, equalized).
 */
export async function parseTaxBill(mimeType: string, base64Data: string): Promise<ExtractedTaxBill | null> {
  const toolName = 'extract_tax_bill_data';

  const systemPrompt = `You are an expert real estate paralegal and property tax data extractor with 20 years of experience reading county assessment notices, tax bills, and property records from every state.

Your task: Extract structured data from a property tax document. Counties use wildly different layouts and terminology. Use your expertise to identify the correct fields regardless of formatting.

COMMON FIELD ALIASES:
- Assessed value: "ASSESSED VALUE", "AV", "ASSESSED TOTAL", "TAXABLE VALUE", "ASSESSMENT", "EQV", "NET AV", "NET ASSESSED", "IMPROVEMENT VALUE + LAND VALUE", "EQUALIZED ASSESSED VALUE"
- Market value: "MARKET VALUE", "APPRAISED VALUE", "FAIR MARKET VALUE", "FULL VALUE", "TRUE VALUE", "EQUALIZED VALUE", "JUST VALUE", "FULL CASH VALUE", "FAIR CASH VALUE"
- Parcel ID: "APN", "PIN", "PARCEL NUMBER", "FOLIO", "ACCOUNT NUMBER", "TAX ID", "PARCEL ID", "PROPERTY ID", "KEY NUMBER", "LOCATOR"
- Tax year: "TAX YEAR", "ASSESSMENT YEAR", "FISCAL YEAR", "LEVY YEAR", "TAX PERIOD"

If a field appears multiple times (e.g., different tax years or land/improvement splits), use the most recent and most prominent. For land + improvement splits, SUM them to get total assessed value.

CONFIDENCE RUBRIC: 90-100 = all fields clearly readable; 70-89 = minor ambiguity; 50-69 = some fields unclear; <50 = document too blurry or incomplete.`;

  try {
    const response = await createWithThinking(
      {
        model: AI_MODELS.PRIMARY,
        max_tokens: 2048,
        system: systemPrompt,
        tools: [
          {
            name: toolName,
            description: 'Record all extracted structured data from the tax bill or assessment document.',
            input_schema: {
              type: 'object' as const,
              properties: {
                parcelId: { type: 'string', description: 'APN, PIN, or Property ID. null if not found.' },
                assessedValue: { type: 'number', description: 'Final assessed/taxable value as a plain number (no commas). null if not found.' },
                marketValue: { type: 'number', description: 'Market or appraised value as a plain number. null if not shown.' },
                taxYear: { type: 'string', description: 'Tax or assessment year, e.g. "2024". null if unclear.' },
                jurisdiction: { type: 'string', description: 'County or township name. null if not found.' },
                confidence: { type: 'number', description: 'Confidence score 0–100.' },
              },
              required: ['parcelId', 'assessedValue', 'marketValue', 'taxYear', 'jurisdiction', 'confidence'],
            },
          },
        ],
        tool_choice: { type: 'auto' },
        messages: [
          {
            role: 'user',
            content: [
              buildMediaBlock(mimeType, base64Data),
              { type: 'text', text: 'Carefully read this tax document and extract all available data. Use the extract_tax_bill_data tool to return your structured findings.' },
            ],
          },
        ],
      },
      AI_THINKING_BUDGETS.TAX_BILL_OCR
    );

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === toolName
    );
    if (toolUse) return toolUse.input as ExtractedTaxBill;

    // Fallback: attempt JSON extraction from text response
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (textBlock) {
      const m = textBlock.text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]) as ExtractedTaxBill;
    }

    return null;
  } catch (error) {
    apiLogger.error({ err: error instanceof Error ? error.message : error }, 'Claude Tax Bill OCR failed');
    return null;
  }
}

// ─── Multi-Image Deferred Maintenance Analysis ────────────────────────────────

/**
 * Aggregate deferred maintenance assessment across multiple property photos.
 *
 * Claude receives ALL photos simultaneously in a single message and synthesizes
 * them into one authoritative professional opinion using extended thinking.
 *
 * Why thinking here specifically:
 *   - Each photo shows a different angle/room — cross-photo reasoning (e.g., water
 *     stains on ceiling + exterior roof moss = active water intrusion) requires
 *     holding multiple observations in context simultaneously.
 *   - Severity thresholds and cost-to-cure are judgment calls that benefit from
 *     explicit internal deliberation before the final commitment.
 *   - The thinking budget scales the depth of reasoning to complexity: 10 photos
 *     of a severely deteriorated property will trigger more thorough reasoning
 *     than 3 photos of a well-maintained unit.
 */
export async function analyzeDeferredMaintenance(
  base64Images: { data: string; mimeType: string }[],
  userCaption: string,
  propertyType: string = 'residential'
): Promise<DeferredMaintenanceAnalysis | null> {
  const toolName = 'record_deferred_maintenance_analysis';

  const PERSONAS: Record<string, string> = {
    residential:  'SRA-designated residential real estate appraiser and licensed assessor with 20 years of residential practice',
    commercial:   'MAI-designated commercial property appraiser with 20 years of office, retail, and mixed-use analysis',
    industrial:   'industrial facility appraiser specializing in clear heights, dock-door ratios, and logistics infrastructure',
    land:         'vacant land appraiser and highest-and-best-use specialist',
    agricultural: 'agricultural appraiser specializing in soil productivity and farmland valuation',
  };
  const persona = PERSONAS[propertyType.toLowerCase()] ?? PERSONAS.residential;

  const systemPrompt = `You are a ${persona} serving as a Board of Review hearing officer and property condition expert.

Your task: Perform an AGGREGATE deferred maintenance assessment by synthesizing ALL provided photos of this ${propertyType} property into one authoritative professional opinion.

ANALYSIS METHODOLOGY:
1. Review every photo holistically — identify patterns, recurring issues, and compounding deficiencies
2. Cross-reference photos: corroborating evidence (water stain inside + roof moss outside) increases severity
3. Weight structural and envelope deficiencies most heavily; cosmetic items least
4. Consider accumulation: 5 moderate issues can constitute a severe overall deferred maintenance finding
5. The homeowner's written description is firsthand testimony — incorporate it even when visibility is limited

SEVERITY DEFINITIONS:
- none:     No observable deferred maintenance; property appears well-maintained throughout
- minor:    Cosmetic items only; <2% value impact; readily deferrable
- moderate: Functional but aging systems; 2-8% value impact; action needed within 2-5 years
- severe:   Active deterioration, failed systems, structural issues, or health/safety hazards; >8% value impact

DEFECT PRIORITY HIERARCHY (${propertyType}):
1. Foundation and structural integrity
2. Roof system and water envelope integrity
3. Active water intrusion or mold evidence
4. Mechanical systems (HVAC, plumbing, electrical panel) age and condition
5. Exterior envelope (siding, windows, doors, trim)
6. Interior finishes and functional obsolescence
7. Drainage, grading, and site conditions

COST-TO-CURE GUIDELINES (2025–2026 contractor pricing):
- Roof replacement: $8,000–$25,000 (size and material dependent)
- Foundation repair: $5,000–$50,000+ (severity dependent)
- HVAC replacement: $6,000–$15,000 per system
- Window replacement: $500–$1,500 per window
- When range is wide, use midpoint unless evidence suggests upper end

REPORT LANGUAGE STANDARDS:
- Active present tense: "Subject property exhibits..." not "may exhibit"
- Specific locations: "the western foundation wall" not "the foundation"
- Quantify where visible: "approximately 15 linear feet of efflorescence"
- Connect to value: "...requiring remediation prior to conventional financing approval"

Homeowner testimony (treat as firsthand evidence): "${userCaption.replace(/"/g, "'").replace(/\n/g, ' ')}"`;

  try {
    // Build content: all images first (so Claude scans evidence before reading instruction)
    const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
    const userContent: Anthropic.ContentBlockParam[] = base64Images.map((img) => {
      const mediaType = (SUPPORTED.has(img.mimeType) ? img.mimeType : 'image/jpeg') as
        'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      return { type: 'image', source: { type: 'base64', media_type: mediaType, data: img.data } };
    });

    userContent.push({
      type: 'text',
      text: `You are reviewing ${base64Images.length} photo${base64Images.length !== 1 ? 's' : ''} of this ${propertyType} property. Synthesize ALL visual evidence above into one aggregate deferred maintenance assessment. Use the ${toolName} tool to return your professional opinion.`,
    });

    const response = await createWithThinking(
      {
        model: AI_MODELS.PRIMARY,
        max_tokens: 3000,
        system: systemPrompt,
        tools: [
          {
            name: toolName,
            description: 'Record the aggregate deferred maintenance analysis synthesized from all property photos.',
            input_schema: {
              type: 'object' as const,
              properties: {
                severity: {
                  type: 'string',
                  enum: ['none', 'minor', 'moderate', 'severe'],
                  description: 'Overall severity classification across all photos.',
                },
                appraiserDescription: {
                  type: 'string',
                  description: 'Professional appraiser-grade narrative for direct inclusion in a legal valuation report. Must be specific, evidence-based, and cite observed defects by location.',
                },
                estimatedCostToCure: {
                  type: 'number',
                  description: 'Total estimated cost to cure all identified deferred maintenance in dollars. null if no deferred maintenance or cost is not estimable.',
                },
                primaryDefectType: {
                  type: 'string',
                  description: 'Single most value-impacting defect category (e.g., Roof System, Foundation, Water Intrusion, Mechanical Systems, Exterior Envelope, Cosmetic Updating). null if severity is none.',
                },
                justification: {
                  type: 'string',
                  description: 'Professional justification citing specific visual evidence from the photos and explaining the severity classification and cost-to-cure estimate.',
                },
              },
              required: ['severity', 'appraiserDescription', 'estimatedCostToCure', 'primaryDefectType', 'justification'],
            },
          },
        ],
        tool_choice: { type: 'auto' },
        messages: [{ role: 'user', content: userContent }],
      },
      AI_THINKING_BUDGETS.PHOTO_AGGREGATE
    );

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === toolName
    );
    if (toolUse) return toolUse.input as DeferredMaintenanceAnalysis;

    // Fallback: attempt JSON extraction from text
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (textBlock) {
      const m = textBlock.text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]) as DeferredMaintenanceAnalysis;
    }

    return null;
  } catch (error) {
    apiLogger.error(
      { err: error instanceof Error ? error.message : error },
      'Claude Deferred Maintenance analysis failed'
    );
    return null;
  }
}
