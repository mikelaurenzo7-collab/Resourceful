import * as Sentry from "@sentry/nextjs";
import { maskEmails } from "@/lib/utils/pii";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

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
