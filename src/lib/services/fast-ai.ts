import OpenAI from 'openai';
import { AI_MODELS, AI_PROVIDERS, AI_REASONING, type ReasoningEffort } from '@/config/ai';
import { apiLogger } from '@/lib/logger';
import { withRetry, isRetryableError } from '@/lib/utils/retry';

export type FastAiProvider = 'openai';

interface FastTextParams {
  prompt: string;
  system?: string;
  maxTokens?: number;
  /** Retained for API compatibility. GPT-5.6 quality is controlled by reasoning effort. */
  temperature?: number;
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set. AI features will not work.');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 120_000,
    });
  }
  return openaiClient;
}

function reasoning(effort: ReasoningEffort) {
  return { effort } as unknown as { effort: 'none' | 'low' | 'medium' | 'high' };
}

export function getFastAiProvider(): FastAiProvider {
  return AI_PROVIDERS.FAST;
}

export function isFastAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getFastAiConfigSummary(): { provider: FastAiProvider; model: string; configured: boolean } {
  return {
    provider: getFastAiProvider(),
    model: AI_MODELS.FAST,
    configured: isFastAiConfigured(),
  };
}

export async function generateFastText({
  prompt,
  system,
  maxTokens = 2000,
}: FastTextParams): Promise<string> {
  const response = await withRetry(
    () => getOpenAIClient().responses.create({
      model: AI_MODELS.FAST,
      store: false,
      max_output_tokens: maxTokens,
      reasoning: reasoning(AI_REASONING.FAST),
      input: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        { role: 'user' as const, content: prompt },
      ],
    }),
    { maxAttempts: 3, baseDelayMs: 1500, retryOn: isRetryableError }
  );

  return response.output_text.trim();
}

export function extractJsonSnippet(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  const arrayMatch = text.match(/\[[\s\S]*\]/);

  if (!objectMatch && !arrayMatch) return null;
  if (!objectMatch) return arrayMatch?.[0] ?? null;
  if (!arrayMatch) return objectMatch[0];

  return objectMatch.index! < arrayMatch.index! ? objectMatch[0] : arrayMatch[0];
}

export function parseJsonSnippet<T>(text: string): T | null {
  const snippet = extractJsonSnippet(text);
  if (!snippet) return null;

  try {
    return JSON.parse(snippet) as T;
  } catch (error) {
    apiLogger.warn(
      { error: error instanceof Error ? error.message : String(error), preview: snippet.slice(0, 300) },
      '[fast-ai] Failed to parse JSON snippet'
    );
    return null;
  }
}
