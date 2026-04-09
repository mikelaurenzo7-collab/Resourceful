// ─── Next.js Instrumentation Hook ────────────────────────────────────────────
// Runs once when the server starts. Used for env validation, startup checks,
// and Sentry initialization (server + edge runtimes).
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  const sentryEnabled = process.env.NODE_ENV === 'production' && !!sentryDsn;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('@/lib/utils/validate-env');
    validateEnvironment();

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
          if (event.message) {
            event.message = event.message.replace(
              /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
              '[EMAIL]'
            );
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
