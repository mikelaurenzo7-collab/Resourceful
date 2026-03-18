// ─── AI Config Tests ─────────────────────────────────────────────────────────

describe('AI_MODELS', () => {
  it('PRIMARY returns string from env var', async () => {
    // Dynamic import to ensure env vars from setup.ts are loaded
    const { AI_MODELS } = await import('@/config/ai');

    expect(typeof AI_MODELS.PRIMARY).toBe('string');
    expect(AI_MODELS.PRIMARY).toBe(process.env.AI_MODEL_PRIMARY);
    expect(AI_MODELS.PRIMARY.length).toBeGreaterThan(0);
  });

  it('FAST returns string from env var', async () => {
    const { AI_MODELS } = await import('@/config/ai');

    expect(typeof AI_MODELS.FAST).toBe('string');
    expect(AI_MODELS.FAST).toBe(process.env.AI_MODEL_FAST);
    expect(AI_MODELS.FAST.length).toBeGreaterThan(0);
  });

  it('throws when PRIMARY env var is missing', async () => {
    const original = process.env.AI_MODEL_PRIMARY;
    delete process.env.AI_MODEL_PRIMARY;

    try {
      const { AI_MODELS } = await import('@/config/ai');
      expect(() => AI_MODELS.PRIMARY).toThrow('Missing required environment variable');
    } finally {
      process.env.AI_MODEL_PRIMARY = original;
    }
  });

  it('throws when FAST env var is missing', async () => {
    const original = process.env.AI_MODEL_FAST;
    delete process.env.AI_MODEL_FAST;

    try {
      const { AI_MODELS } = await import('@/config/ai');
      expect(() => AI_MODELS.FAST).toThrow('Missing required environment variable');
    } finally {
      process.env.AI_MODEL_FAST = original;
    }
  });
});

describe('AI_TOKEN_LIMITS', () => {
  it('all values are positive integers', async () => {
    const { AI_TOKEN_LIMITS } = await import('@/config/ai');

    for (const [key, value] of Object.entries(AI_TOKEN_LIMITS)) {
      expect(value, `${key} should be a positive integer`).toBeGreaterThan(0);
      expect(Number.isInteger(value), `${key} should be an integer`).toBe(true);
    }
  });

  it('has expected limit keys', async () => {
    const { AI_TOKEN_LIMITS } = await import('@/config/ai');

    expect(AI_TOKEN_LIMITS).toHaveProperty('REPORT_NARRATIVES');
    expect(AI_TOKEN_LIMITS).toHaveProperty('VISION_ANALYSIS');
    expect(AI_TOKEN_LIMITS).toHaveProperty('FILING_GUIDE');
    expect(AI_TOKEN_LIMITS).toHaveProperty('CLASSIFICATION');
  });
});

describe('AI_CONFIG', () => {
  it('maxTokens.narrative matches REPORT_NARRATIVES', async () => {
    const { AI_CONFIG, AI_TOKEN_LIMITS } = await import('@/config/ai');

    expect(AI_CONFIG.maxTokens.narrative).toBe(AI_TOKEN_LIMITS.REPORT_NARRATIVES);
  });

  it('maxTokens.filingGuide matches FILING_GUIDE', async () => {
    const { AI_CONFIG, AI_TOKEN_LIMITS } = await import('@/config/ai');

    expect(AI_CONFIG.maxTokens.filingGuide).toBe(AI_TOKEN_LIMITS.FILING_GUIDE);
  });

  it('maxTokens.photoAnalysis matches VISION_ANALYSIS', async () => {
    const { AI_CONFIG, AI_TOKEN_LIMITS } = await import('@/config/ai');

    expect(AI_CONFIG.maxTokens.photoAnalysis).toBe(AI_TOKEN_LIMITS.VISION_ANALYSIS);
  });
});
