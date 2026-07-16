/* Validation for the ?redirect= param that middleware's toLogin() sets and the
   login page consumes.

   This exists because /login previously pushed searchParams.get('redirect')
   straight into router.push() with no checks — and Next's router.push happily
   navigates to an absolute external URL, so /login?redirect=https://evil.com was
   a live open redirect. The Tool Crib QR deep-link leans on this param heavily
   (scan a label while logged out → sign in → land on the tool), so it's now
   load-bearing and gets validated rather than trusted.

   Dependency-free on purpose — importable from client components, server
   components and edge middleware alike, same as lib/roles.ts. */

/* Drop C0 controls (0x00-0x1F) and DEL (0x7F). A raw newline or tab inside the
   value can slip past a naive startsWith('/') check. Done with a codepoint test
   rather than a regex so there are no escape sequences to get mangled — and so
   no invisible control characters end up living in this source file.

   Only controls are stripped: '-' and ' ' are legal in a path and must survive,
   or '/tool-crib/IAT-0042' would be mangled into '/toolcrib/IAT0042'. */
function stripControlChars(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c > 0x1f && c !== 0x7f) out += ch
  }
  return out
}

/**
 * Returns `raw` only if it is a safe same-origin path, else `fallback`.
 *
 * Rejects:
 *   - absolute URLs ('https://evil.com') — router.push would leave the site
 *   - protocol-relative URLs ('//evil.com') — a browser reads these as absolute
 *   - anything containing a backslash ('/\evil.com') — some parsers normalize
 *     '\' to '/', so these can smuggle a protocol-relative URL past a
 *     startsWith('/') check
 *   - anything not starting with '/'
 */
export function safeRedirect(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback

  const s = stripControlChars(raw).trim()

  if (!s.startsWith('/')) return fallback
  if (s.startsWith('//')) return fallback
  if (s.includes('\\')) return fallback

  return s
}
