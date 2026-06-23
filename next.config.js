/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the file-tracing root to this app dir. Without it, Next walks up and
  // picks the repo-root package-lock.json (left from one-off scripts) as the
  // workspace root and mis-infers the serverless file-tracing base.
  outputFileTracingRoot: __dirname,
  // Disable the client-side Router Cache for dynamic pages so admin tabs always
  // fetch fresh data instead of serving a stale snapshot. NOTE: in Next 15
  // staleTimes lives under `experimental` — a top-level key is silently ignored
  // (it regressed there during the 14->15 upgrade). Pairs with RefreshOnNavigate.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      // Support ticketing moved from /support/ticket to the /support/[form] template
      { source: '/support/ticket', destination: '/support/equipment-support', permanent: true },
      // Login consolidated to /login. Platform-level redirect keeps old
      // /employee/login bookmarks working (query string, e.g. ?redirect=, is
      // forwarded automatically). Runs before middleware, so no route file needed.
      { source: '/employee/login', destination: '/login', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        // Allow embed route to be iframed from any origin
        source: '/forms/:slug/embed',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
        ],
      },
      {
        // Allow success page to be shown inside iframe after submission
        source: '/forms/:slug/success',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
        ],
      },
    ]
  },
}

module.exports = nextConfig
