// ─── Client-Side Instrumentation ─────────────────────────────────────────────
// Initializes Sentry in the browser. This file is the Next.js recommended
// location for client-side SDK initialization.
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client

import * as Sentry from '@sentry/nextjs';

// Export router transition hook for navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production with a configured DSN
  enabled: process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring: sample 5% of client transactions
  tracesSampleRate: 0.05,

  // Session replay: capture 0% of all sessions, 100% of error sessions
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  environment: process.env.NODE_ENV,

  // Filter out noisy browser errors
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'Loading chunk',
    'ChunkLoadError',
    /^cancelled$/i,
  ],
});
