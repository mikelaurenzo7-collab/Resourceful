// ─── Environment Variable Validation ─────────────────────────────────────────
// Imported by src/instrumentation.ts so production fails fast on a broken
// configuration instead of discovering missing vendors during a paid case.

import { logger } from '@/lib/logger';

const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'AI_MODEL_PRIMARY',
  'AI_MODEL_FAST',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'RESEND_API_KEY',
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
  'ATTOM_API_KEY',
  'REPORT_ACCESS_TOKEN_SECRET',
] as const;

const RECOMMENDED_VARS = [
  'AZURE_MAPS_SUBSCRIPTION_KEY',
  'NEXT_PUBLIC_AZURE_MAPS_CLIENT_ID',
  'NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN',
  'SERPER_API_KEY',
  'RESEND_FROM_ADDRESS',
  'ADMIN_NOTIFICATION_EMAIL',
  'FOUNDER_EMAILS',
] as const;

const MIN_SECRET_LENGTHS: Record<string, number> = {
  CRON_SECRET: 32,
  REPORT_ACCESS_TOKEN_SECRET: 32,
};

/**
 * Validate critical environment variables.
 *
 * Gemini is intentionally not required: vision and document extraction now use
 * the Anthropic primary model. Requiring a dead-provider key caused otherwise
 * valid production deployments to fail at startup.
 */
export function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const missingRecommended: string[] = [];
  const weakSecrets: string[] = [];
  const fastProvider = process.env.AI_PROVIDER_FAST?.trim().toLowerCase() || 'anthropic';

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

  if (fastProvider !== 'anthropic' && fastProvider !== 'groq') {
    missing.push('AI_PROVIDER_FAST (must be anthropic or groq)');
  }

  if (fastProvider === 'groq' && !process.env.GROQ_API_KEY?.trim()) {
    missing.push('GROQ_API_KEY');
  }

  if (fastProvider === 'groq' && !process.env.AI_MODEL_RESEARCH?.trim()) {
    missingRecommended.push('AI_MODEL_RESEARCH');
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
      'Recommended env vars not set — some features will be degraded'
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
