// ─── AI Configuration ────────────────────────────────────────────────────────
// This is the ONLY file where model names appear.
// Everything else imports from here.
// To upgrade models, change the environment variables — not this file.
//
// Claude is the sole AI provider for this pipeline. Gemini has been removed.
// All vision, document OCR, and reasoning tasks use Claude with extended thinking.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set. AI features will not work.`);
  }
  return value;
}

function getFastProvider(): 'anthropic' | 'groq' {
  const explicit = process.env.AI_PROVIDER_FAST?.trim().toLowerCase();
  if (explicit === 'anthropic' || explicit === 'groq') {
    return explicit;
  }
  return 'anthropic';
}

const DEFAULT_RESEARCH_MODEL = 'claude-haiku-4-5-20251001';

export const AI_PROVIDERS = {
  get FAST() { return getFastProvider(); },
} as const;

export const AI_MODELS = {
  get PRIMARY() { return requireEnv('AI_MODEL_PRIMARY'); }, // report narratives, logical reasoning, vision
  get FAST() { return requireEnv('AI_MODEL_FAST'); },       // quick classification, structured extraction
  get RESEARCH() {
    if (process.env.AI_MODEL_RESEARCH) return process.env.AI_MODEL_RESEARCH;
    return AI_PROVIDERS.FAST === 'anthropic' ? requireEnv('AI_MODEL_FAST') : DEFAULT_RESEARCH_MODEL;
  }, // tool-using research loop (fast model); synthesis step uses PRIMARY with thinking
  // VISION and DOCUMENT now route to Claude PRIMARY — aliases kept for forward compatibility
  get VISION() { return requireEnv('AI_MODEL_PRIMARY'); },   // multi-image deferred maintenance (Claude vision + thinking)
  get DOCUMENT() { return requireEnv('AI_MODEL_PRIMARY'); }, // tax bill OCR (Claude vision + thinking)
} as const;

// Token limits cap API costs and prevent runaway bills.
export const AI_TOKEN_LIMITS = {
  REPORT_NARRATIVES: 16000,
  VISION_ANALYSIS: 1000,
  FILING_GUIDE: 3000,
  CLASSIFICATION: 300,
} as const;

// Extended thinking budgets for computationally demanding analysis tasks.
// Claude uses these token budgets for internal reasoning before committing to
// a structured answer. Budget must be < (max_tokens - expected_response_tokens).
//
// "Adaptive thinking": Claude naturally allocates reasoning depth proportional
// to problem complexity within the budget — ambiguous photos trigger deeper
// inspection, clear-cut documents resolve quickly.
export const AI_THINKING_BUDGETS = {
  PHOTO_AGGREGATE:    6000,  // Multi-image deferred maintenance aggregate synthesis
  TAX_BILL_OCR:       3000,  // Dense document OCR with ambiguous / overlapping fields
  RESEARCH_SYNTHESIS: 10000, // Final research synthesis over all gathered search evidence
} as const;

// Backward-compatible alias used by existing service code
export const AI_CONFIG = {
  maxTokens: {
    narrative: AI_TOKEN_LIMITS.REPORT_NARRATIVES,
    filingGuide: AI_TOKEN_LIMITS.FILING_GUIDE,
    photoAnalysis: AI_TOKEN_LIMITS.VISION_ANALYSIS,
  },
} as const;
