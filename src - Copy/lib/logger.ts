// ─── Structured Logger ───────────────────────────────────────────────────────
// Production-grade logging via Pino. Replaces console.log/warn/error with
// structured JSON output that integrates with Vercel Logs, Datadog, etc.
//
// Usage:
//   import { logger } from '@/lib/logger';
//   logger.info({ reportId }, 'Pipeline started');
//   logger.error({ err, reportId }, 'Stage failed');

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Redact common secret paths to prevent accidental leakage to log aggregators
// (Vercel Logs, Datadog, etc.). Pino walks the object tree and replaces values
// at these paths with '[REDACTED]'. Paths use dot notation; '*' matches any key.
const REDACT_PATHS = [
  '*.apiKey', '*.api_key',
  '*.apiSecret', '*.api_secret',
  '*.authorization', '*.Authorization',
  '*.cookie', '*.Cookie',
  '*.password',
  '*.secret',
  '*.token',
  'apiKey', 'api_key',
  'authorization',
  'password',
  'secret',
  'token',
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'request.headers.authorization',
  'request.headers.cookie',
];

export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug')),
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  ...(isProduction
    ? {
        // JSON output for production (Vercel, Datadog, etc.)
        formatters: {
          level(label) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {}),
});

// ─── Child Loggers for Key Subsystems ────────────────────────────────────────
// Pre-creates commonly used child loggers with subsystem context.
// Avoids repeating the module name in every log call.

export const pipelineLogger = logger.child({ module: 'pipeline' });
export const apiLogger = logger.child({ module: 'api' });
export const emailLogger = logger.child({ module: 'email' });
export const cronLogger = logger.child({ module: 'cron' });
export const authLogger = logger.child({ module: 'auth' });
export const paymentLogger = logger.child({ module: 'payment' });
export const adminLogger = logger.child({ module: 'admin' });
