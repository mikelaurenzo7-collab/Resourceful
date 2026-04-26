// ─── Sentry Client Config ───────────────────────────────────────────────────
// This file configures Sentry for the browser-side Next.js runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  // Adjusting this value in production, or using tracesSampler for finer control
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
