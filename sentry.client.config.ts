import * as Sentry from "@sentry/nextjs";
import { maskEmails } from "@/lib/utils/pii";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
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
