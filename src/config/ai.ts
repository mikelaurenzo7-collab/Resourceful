// ─── AI Configuration ────────────────────────────────────────────────────────
// Resourceful is OpenAI-first. GPT-5.6 Sol performs the high-judgment valuation,
// appraisal-analysis, vision, and filing work. Terra handles research and Luna
// handles low-latency extraction/classification. Every model remains overridable
// through environment variables so production can pin snapshots after evals.

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

function modelFromEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function reasoningFromEnv(
  name: string,
  fallback: ReasoningEffort
): ReasoningEffort {
  const value = process.env[name]?.trim().toLowerCase();
  const allowed = new Set<ReasoningEffort>(['none', 'low', 'medium', 'high', 'xhigh', 'max']);
  return value && allowed.has(value as ReasoningEffort)
    ? (value as ReasoningEffort)
    : fallback;
}

export const AI_PROVIDERS = {
  PRIMARY: 'openai',
  FAST: 'openai',
  RESEARCH: 'openai',
  VISION: 'openai',
  DOCUMENT: 'openai',
} as const;

export const AI_MODELS = {
  get PRIMARY() { return modelFromEnv('AI_MODEL_PRIMARY', 'gpt-5.6-sol'); },
  get FAST() { return modelFromEnv('AI_MODEL_FAST', 'gpt-5.6-luna'); },
  get RESEARCH() { return modelFromEnv('AI_MODEL_RESEARCH', 'gpt-5.6-terra'); },
  get VISION() { return modelFromEnv('AI_MODEL_VISION', 'gpt-5.6-sol'); },
  get DOCUMENT() { return modelFromEnv('AI_MODEL_DOCUMENT', 'gpt-5.6-sol'); },
} as const;

export const AI_REASONING = {
  get APPRAISER() { return reasoningFromEnv('AI_REASONING_APPRAISER', 'high'); },
  get RESEARCH() { return reasoningFromEnv('AI_REASONING_RESEARCH', 'medium'); },
  get VISION() { return reasoningFromEnv('AI_REASONING_VISION', 'high'); },
  get DOCUMENT() { return reasoningFromEnv('AI_REASONING_DOCUMENT', 'high'); },
  get FAST() { return reasoningFromEnv('AI_REASONING_FAST', 'low'); },
} as const;

// Output limits cap API cost while leaving room for a complete professional workfile.
export const AI_TOKEN_LIMITS = {
  REPORT_NARRATIVES: 24000,
  VISION_ANALYSIS: 2500,
  FILING_GUIDE: 5000,
  CLASSIFICATION: 600,
  DOCUMENT_EXTRACTION: 2500,
  DEFERRED_MAINTENANCE: 3500,
} as const;

// Backward-compatible alias used by existing service code.
export const AI_CONFIG = {
  maxTokens: {
    narrative: AI_TOKEN_LIMITS.REPORT_NARRATIVES,
    filingGuide: AI_TOKEN_LIMITS.FILING_GUIDE,
    photoAnalysis: AI_TOKEN_LIMITS.VISION_ANALYSIS,
  },
} as const;
