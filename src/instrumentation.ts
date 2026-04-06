// ─── Next.js Instrumentation Hook ────────────────────────────────────────────
// Runs once when the server starts. Used for env validation and startup checks.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('@/lib/utils/validate-env');
    validateEnvironment();
  }
}
