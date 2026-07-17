// ─── Environment Variable Validation ─────────────────────────────────────────
// Imported by src/instrumentation.ts so production fails fast on a broken
// configuration instead of discovering missing core services during a paid case.

import { logger } from '@/lib/logger';

const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'RESEND_API_KEY',
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
  'REPORT_ACCESS_TOKEN_SECRET',
] as const;

const RECOMMENDED_VARS = [
  'AI_MODEL_PRIMARY',
  'AI_MODEL_FAST',
  'AI_MODEL_RESEARCH',
  'AI_MODEL_VISION',
  'AI_MODEL_DOCUMENT',
  'GOOGLE_MAPS_API_KEY',
  'ATTOM_API_KEY',
  'SERPER_API_KEY',
  'AZURE_MAPS_SUBSCRIPTION_KEY',
  'NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN',
  'RESEND_FROM_ADDRESS',
  'ADMIN_NOTIFICATION_EMAIL',
  'FOUNDER_EMAILS',
] as const;

const MIN_SECRET_LENGTHS: Record<string, number> = {
  CRON_SECRET: 32,
  REPORT_ACCESS_TOKEN_SECRET: 32,
};

/**
 * Validate the production contract.
 *
 * Core identity, payment, delivery, and OpenAI services fail fast because the
 * application cannot safely fulfill an order without them. Enrichment vendors
 * such as Google Maps, ATTOM, Serper, Azure Maps, and Mapillary remain
 * recommended: their service functions return bounded errors and the site must
 * continue to boot so customers and operators see an honest degraded state
 * rather than a process-wide outage.
 *
 * Model variables are recommended rather than required because src/config/ai.ts
 * has explicit GPT-5.6 Sol/Terra/Luna defaults. Anthropic, Gemini, and Groq keys
 * are intentionally not part of Resourceful's production contract.
 */
export function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const missingRecommended: string[] = [];
  const weakSecrets: string[] = [];

  for (const name of REQUIRED_VARS) {
    if (!process.env[name]?.trim()) {
      missing.push(name);
    }
  }

  for (const name of RECOMMENDED_VARS) {
    if (!process.env[name]?.trim()) {
      missingRecommended.push(name);
    }
  }

  // Either server-only or public DSN enables Sentry. Do not warn that both are
  // missing independently when only one is needed.
  if (!process.env.SENTRY_DSN?.trim() && !process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) {
    missingRecommended.push('SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN');
  }

  for (const [name, minLength] of Object.entries(MIN_SECRET_LENGTHS)) {
    const value = process.env[name];
    if (value && value.length < minLength) {
      weakSecrets.push(`${name} (<${minLength} chars)`);
    }
  }

  if (missingRecommended.length > 0) {
    logger.warn(
      { vars: missingRecommended },
      'Recommended env vars not set — defaults or degraded features will be used'
    );
  }

  if (weakSecrets.length > 0) {
    const message = `Weak production secrets: ${weakSecrets.join(', ')}`;
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn({ vars: weakSecrets }, `${message}. This would fail in production.`);
  }

  if (missing.length > 0) {
    const message = `Required env vars not set: ${missing.join(', ')}`;
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn({ vars: missing }, `${message}. This would fail in production.`);
  }
}
