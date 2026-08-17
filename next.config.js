// Only OUR Supabase project may be run through next/image. The old wildcard
// (`*.supabase.co`) let an anonymous attacker point the public /_next/image
// optimizer at a malicious image in THEIR OWN Supabase project's public bucket,
// feeding crafted bytes straight into sharp/libvips (Dependabot #37 / the sharp
// CVEs — patched via the `sharp` override in package.json). Narrowing to this
// project's host removes that vector; all of our own public-bucket images live
// on this host, so nothing legitimate breaks.
const SUPABASE_HOST = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname }
  catch { return 'dsbuhdjlkgwcghskvdse.supabase.co' }
})()

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the file-tracing root to this app dir. Without it, Next walks up and
  // picks the repo-root package-lock.json (left from one-off scripts) as the
  // workspace root and mis-infers the serverless file-tracing base.
  outputFileTracingRoot: __dirname,
  // Escape hatch for building while a dev server is up. `next dev` and
  // `next build` share .next, and running both against it corrupts the dev
  // server's chunks — which surfaces as every page 500ing, with nothing wrong
  // in the source. Several people work in this one tree, so "just stop the dev
  // server" means interrupting someone else. Set NEXT_BUILD_DIST_DIR to a
  // scratch path instead:
  //
  //   NEXT_BUILD_DIST_DIR=.next-verify npm run build
  //
  // Inert when unset, so normal builds and the Vercel build are unchanged.
  ...(process.env.NEXT_BUILD_DIST_DIR ? { distDir: process.env.NEXT_BUILD_DIST_DIR } : {}),
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
        hostname: SUPABASE_HOST,
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
      // IAT Learn moved into the admin shell. Platform-level like the rule above,
      // so these run BEFORE middleware — no auth involved, and a login round-trip
      // carrying ?redirect=/learn... still lands on the new path.
      //
      // ORDER IS LOAD-BEARING: Next matches top-down, and '/learn/:path*' also
      // matches the authoring subtree, so the specific rules must come first and
      // the catch-all must come last.
      { source: '/learn/admin', destination: '/admin/learn-content', permanent: true },
      { source: '/learn/admin/:path*', destination: '/admin/learn-content/:path*', permanent: true },
      { source: '/learn', destination: '/admin/learn', permanent: true },
      { source: '/learn/:path*', destination: '/admin/learn/:path*', permanent: true },
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
      {
        // The production board (migration 055) is public and unauthenticated —
        // its URL token is the only thing standing between a crawler and the
        // shop's task list. Unguessable is NOT unindexed: a token leaks through
        // a Referer header, a pasted link, or browser telemetry, and there is no
        // robots.txt anywhere in this app to fall back on.
        //
        // Belt-and-braces with the page's own `robots: { index: false }`
        // metadata: this header also covers the check-off route's JSON responses
        // and anything else non-HTML under /board.
        source: '/board/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          // Don't leak the token to any third party the board might link out to.
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
