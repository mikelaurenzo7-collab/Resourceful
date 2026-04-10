// ─── AI Configuration ────────────────────────────────────────────────────────
// This is the ONLY file where model names appear.
// Everything else imports from here.
// To upgrade models, change the environment variables — not this file.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set. AI features will not work.`);
  }
  return value;
}

export const AI_MODELS = {
  get PRIMARY() { return requireEnv('AI_MODEL_PRIMARY'); }, // report narratives, logical reasoning
  get FAST() { return requireEnv('AI_MODEL_FAST'); }, // quick classification tasks
  get VISION() { return process.env.GEMINI_MODEL_VISION || 'gemini-3.1-pro'; }, // appraiser-grade defect extraction
  get DOCUMENT() { return process.env.GEMINI_MODEL_DOCUMENT || 'gemini-3.1-pro'; }, // dense tax bill OCR
} as const;

// Token limits cap API costs and prevent runaway bills.
export const AI_TOKEN_LIMITS = {
  REPORT_NARRATIVES: 16000,
  VISION_ANALYSIS: 1000,
  FILING_GUIDE: 3000,
  CLASSIFICATION: 300,
} as const;

// Backward-compatible alias used by existing service code
export const AI_CONFIG = {
  maxTokens: {
    narrative: AI_TOKEN_LIMITS.REPORT_NARRATIVES,
    filingGuide: AI_TOKEN_LIMITS.FILING_GUIDE,
    photoAnalysis: AI_TOKEN_LIMITS.VISION_ANALYSIS,
  },
} as const;
