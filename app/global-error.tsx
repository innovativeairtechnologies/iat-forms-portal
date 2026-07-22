'use client'

import { useEffect } from 'react'

// App-wide error boundary — catches render errors that escape the route-level
// boundaries (this is the app's first error boundary; before it, an unhandled
// render error fell through to Next's default screen). A global-error boundary
// must render its own <html>/<body>.
//
// SERVER-side errors (API routes, server components, server actions) are reported
// to Sentry via instrumentation.ts once SENTRY_DSN is set — that half adds nothing
// to the browser bundle. To ALSO capture browser errors in Sentry, add an
// `instrumentation-client.ts` that calls `Sentry.init({ dsn: NEXT_PUBLIC_SENTRY_DSN })`
// and `Sentry.captureException(error)` here — note it pulls the Sentry SDK (~80 kB)
// into the client bundle, which is why it's left as an opt-in.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#18181b' }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: '#71717a', marginBottom: 16 }}>An unexpected error occurred. Please try again.</p>
            <button
              onClick={() => window.location.reload()}
              style={{ fontSize: 14, fontWeight: 600, background: '#089447', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
