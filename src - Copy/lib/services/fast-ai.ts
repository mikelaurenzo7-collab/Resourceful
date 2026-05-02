import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AI_MODELS, AI_PROVIDERS } from '@/config/ai';
import { apiLogger } from '@/lib/logger';
import { withRetry, isRetryableError } from '@/lib/utils/retry';

export type FastAiProvider = 'anthropic' | 'groq';

interface FastTextParams {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

let anthropicClient: Anthropic | null = null;
let groqClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set. Fast AI features will not work.');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 90_000,
    });
  }
  return anthropicClient;
}

function getGroqClient(): OpenAI {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set. Fast AI features will not work.');
    }
    groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 90_000,
    });
  }
  return groqClient;
}

export function getFastAiProvider(): FastAiProvider {
  return AI_PROVIDERS.FAST;
}

export function isFastAiConfigured(): boolean {
  return getFastAiProvider() === 'groq'
    ? Boolean(process.env.GROQ_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getFastAiConfigSummary(): { provider: FastAiProvider; model: string; configured: boolean } {
  return {
    provider: getFastAiProvider(),
    model: process.env.AI_MODEL_FAST || '(unset)',
    configured: isFastAiConfigured() && Boolean(process.env.AI_MODEL_FAST),
  };
}

export async function generateFastText({
  prompt,
  system,
  maxTokens = 2000,
  temperature = 0.1,
}: FastTextParams): Promise<string> {
  const provider = getFastAiProvider();

  if (provider === 'groq') {
    const response = await withRetry(
      () => getGroqClient().chat.completions.create({
        model: AI_MODELS.FAST,
        temperature,
        max_tokens: maxTokens,
        messages: [
          ...(system ? [{ role: 'system' as const, content: system }] : []),
          { role: 'user' as const, content: prompt },
        ],
      }),
      { maxAttempts: 3, baseDelayMs: 1500, retryOn: isRetryableError }
    );

    return response.choices[0]?.message?.content?.trim() ?? '';
  }

  const response = await withRetry(
    () => getAnthropicClient().messages.create({
      model: AI_MODELS.FAST,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
    { maxAttempts: 3, baseDelayMs: 1500, retryOn: isRetryableError }
  );

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

export function extractJsonSnippet(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
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