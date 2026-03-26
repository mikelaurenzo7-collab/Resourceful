// ─── AI Configuration ────────────────────────────────────────────────────────
// This is the ONLY file where model names appear.
// Everything else imports from here.
// To upgrade models, change the environment variables — not this file.

export const AI_MODELS = {
  PRIMARY: process.env.AI_MODEL_PRIMARY!, // report narratives, vision analysis
  FAST: process.env.AI_MODEL_FAST!, // quick classification tasks
} as const;

// Token limits cap API costs and prevent runaway bills.
export const AI_TOKEN_LIMITS = {
  REPORT_NARRATIVES: 8000,
  VISION_ANALYSIS: 1000,
  FILING_GUIDE: 4000,    // increased from 3000 — comprehensive filing guides regularly approach 3k
  ACTION_GUIDE: 4000,    // buyer action guides and listing strategy guides
  CLASSIFICATION: 300,
} as const;

// Backward-compatible alias used by existing service code
export const AI_CONFIG = {
  maxTokens: {
    narrative: AI_TOKEN_LIMITS.REPORT_NARRATIVES,
    filingGuide: AI_TOKEN_LIMITS.FILING_GUIDE,
    actionGuide: AI_TOKEN_LIMITS.ACTION_GUIDE,
    photoAnalysis: AI_TOKEN_LIMITS.VISION_ANALYSIS,
  },
} as const;
