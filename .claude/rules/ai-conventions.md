# AI Conventions

## Dual-Provider Architecture
This project uses two AI providers with distinct, non-overlapping roles:

| Role | Provider | Use Case |
|------|----------|----------|
| `AI_MODELS.PRIMARY` | Anthropic (Sonnet) | Report narratives, logical reasoning, filing guides, photo condition analysis |
| `AI_MODELS.FAST` | Anthropic (Haiku) or Groq | Quick classification, structured data extraction from web scrapes |
| `AI_MODELS.VISION` | Google Gemini | Appraiser-grade photo defect extraction (deferred maintenance analysis) |
| `AI_MODELS.DOCUMENT` | Google Gemini | Dense tax bill OCR (extracts assessed value, taxable value, rates) |

## Rules
- **NEVER** hardcode model names anywhere — always import from `src/config/ai.ts` as `AI_MODELS.PRIMARY`, `.FAST`, `.VISION`, `.DOCUMENT`
- **NEVER** combine Gemini `responseMimeType: 'application/json'` with the `googleSearch` tool — they are incompatible
- **NEVER** pass `undefined` to an SDK constructor — validate env vars early and throw with a clear message
- Gemini uses `@google/genai` SDK with JSON response mode
- Anthropic uses the standard `@anthropic-ai/sdk`
- Token limits live in `AI_TOKEN_LIMITS` in `src/config/ai.ts` — never hardcode token counts inline

## Adding a New AI Call
1. Decide which role applies (PRIMARY / FAST / VISION / DOCUMENT)
2. Use the matching `AI_MODELS.*` constant
3. Add a token limit to `AI_TOKEN_LIMITS` if this is a new call type
4. For Gemini vision: use `AI_MODELS.VISION` and pass `responseMimeType: 'application/json'`
5. For Gemini document OCR: use `AI_MODELS.DOCUMENT`
6. All AI service calls go in `src/lib/services/` — not inline in route handlers
