// The only place model names appear in the codebase
export const AI_MODELS = {
  PRIMARY: process.env.AI_MODEL_PRIMARY!, // most capable model (e.g. claude-sonnet-4-6)
  FAST: process.env.AI_MODEL_FAST!, // lightweight model (e.g. claude-haiku-4-5-20251001)
} as const;

export const AI_CONFIG = {
  maxTokens: {
    narrative: 8192,
    filingGuide: 4096,
    photoAnalysis: 2048,
  },
} as const;
