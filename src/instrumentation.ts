// ─── Next.js Instrumentation Hook ────────────────────────────────────────────
// Runs once when the server starts. Used for env validation, startup checks,
// and Sentry initialization (server + edge runtimes).
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

import { maskEmails } from '@/lib/utils/pii';

export async function register() {
  const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  const isProd = process.env.NODE_ENV === 'production';
  const sentryEnabled = isProd && !!sentryDsn;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('@/lib/utils/validate-env');
    validateEnvironment();

    if (isProd && !sentryDsn) {
      // Surface missing DSN loudly — silent error tracking is worse than none.
      // eslint-disable-next-line no-console
      console.warn(
        '[instrumentation] SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN not set — error tracking is DISABLED in production.'
      );
    }

    // Sentry server-side initialization
    if (sentryEnabled) {
      const Sentry = await import('@sentry/nextjs');
      Sentry.init({
        dsn: sentryDsn,
        enabled: true,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
        ignoreErrors: [
          'Too many requests',
          'AbortError',
          'The operation was aborted',
          'fetch failed',
          'ECONNRESET',
        ],
        beforeSend(event) {
          // Mask emails in message, exception values, and breadcrumb messages.
          event.message = maskEmails(event.message);
          if (event.exception?.values) {
            for (const ex of event.exception.values) {
              ex.value = maskEmails(ex.value);
            }
          }
          if (event.breadcrumbs) {
            for (const b of event.breadcrumbs) {
              b.message = maskEmails(b.message);
            }
          }
          // Strip user identifiers — we never need them in error payloads.
          if (event.user) {
            delete event.user.email;
            delete event.user.username;
            delete event.user.ip_address;
          }
          return event;
        },
      });
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Sentry edge runtime initialization
    if (sentryEnabled) {
      const Sentry = await import('@sentry/nextjs');
      Sentry.init({
        dsn: sentryDsn,
        enabled: true,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      });
    }
  }
}
