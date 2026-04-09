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

export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug')),
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
    : {
        // Pretty output for development
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
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
