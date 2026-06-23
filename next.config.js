/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 15: staleTimes is stable (was under `experimental` in 14).
  // Disable the client-side Router Cache for dynamic pages so admin tabs
  // always fetch fresh data instead of serving a stale 30-second snapshot.
  staleTimes: {
    dynamic: 0,
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
