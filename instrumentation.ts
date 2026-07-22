import * as Sentry from '@sentry/nextjs'

// Server + edge error monitoring. INERT until SENTRY_DSN is set in the environment.
// (Setup: create a free Sentry project at sentry.io → copy its DSN → set SENTRY_DSN
//  in Vercel → Settings → Environment Variables. Until then Sentry.init is never
//  called and this is a no-op — safe to ship dark.)
export async function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  const runtime = process.env.NEXT_RUNTIME
  if (runtime === 'nodejs' || runtime === 'edge') {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      // Only report from real deployments, not local dev.
      enabled: process.env.NODE_ENV === 'production',
    })
  }
}

// Next 15: forward server-side render / route-handler errors to Sentry.
// No-op when Sentry was never initialized (no DSN).
export const onRequestError = Sentry.captureRequestError
