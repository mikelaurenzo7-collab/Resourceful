// ─── Environment Variable Validation ─────────────────────────────────────────
// Import this in app/layout.tsx (or instrumentation.ts) to catch misconfigurations
// at startup instead of at request time.

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
] as const;

const RECOMMENDED_VARS = [
  'AZURE_MAPS_SUBSCRIPTION_KEY',
  'NEXT_PUBLIC_AZURE_MAPS_CLIENT_ID',
  'NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN',
  'SERPER_API_KEY',
  'RESEND_FROM_ADDRESS',
  'ADMIN_NOTIFICATION_EMAIL',
  'FOUNDER_EMAILS',
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN',
] as const;

/**
 * Validate that all critical environment variables are set.
 * In production, missing required vars throw. In development, they warn.
 */
export function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const missingRecommended: string[] = [];

  for (const name of REQUIRED_VARS) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }

  for (const name of RECOMMENDED_VARS) {
    if (!process.env[name]) {
      missingRecommended.push(name);
    }
  }

  if (missingRecommended.length > 0) {
    logger.warn(
      { vars: missingRecommended },
      'Recommended env vars not set — some features will be degraded'
    );
  }

  if (missing.length > 0) {
    const message = `Required env vars not set: ${missing.join(', ')}`;
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn({ vars: missing }, `${message}. This would fail in production.`);
  }
}
