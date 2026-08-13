/* The one place that turns NEXT_PUBLIC_SUPABASE_URL into a public-bucket URL
   prefix, and the one place that decides whether a URL is one of our uploads.

   ⚠️ Why this module exists — read before "simplifying" it back into a template
   literal at each call site.

   On 2026-08-13 the Vercel value of NEXT_PUBLIC_SUPABASE_URL was found to carry a
   trailing newline ("https://….supabase.co\n" — almost certainly `echo` piped into
   `vercel env add`, which appends one). Nothing failed loudly:

     • The browser's supabase-js client NORMALIZES the URL it is constructed with,
       so uploads succeeded and getPublicUrl() returned a perfectly clean link.
     • Every server-side allow-list built its prefix by RAW template concatenation,
       so the newline landed in the MIDDLE of the prefix:
           "https://….supabase.co\n/storage/v1/object/public/ticket-photos/"
       and `url.startsWith(prefix)` was therefore false for every legitimate upload.

   Result: customer ticket photos were accepted, stored, and then silently dropped
   on the way into the row — `photo_urls` came out NULL on every ticket, the
   customer saw a success screen, and the files sat orphaned in the bucket. It took
   a customer complaint to surface it (IAT-2026-2944).

   Normalizing in exactly one place means a stray space, newline, or trailing slash
   can never do that again. See docs/support-tickets.md. */

/** Trimmed, de-trailing-slashed origin. Empty string if the env is unset — the
 *  guards below then fail closed rather than accepting everything. */
const SUPABASE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '')

/** Public-object URL prefix for one bucket, e.g. `…/object/public/ticket-photos/`. */
export function publicBucketPrefix(bucket: string): string {
  return `${SUPABASE_ORIGIN}/storage/v1/object/public/${bucket}/`
}

/**
 * True only for an https URL inside `bucket` of OUR Supabase project's public
 * storage. Anything else — javascript:/data:, an off-site host, another project's
 * bucket — is rejected, which is what keeps attacker-supplied URLs out of the
 * columns we render straight into <img src> on public pages.
 *
 * Fails closed: a missing or misconfigured env rejects everything rather than
 * degrading into an allow-all.
 */
export function isPublicBucketUrl(url: unknown, bucket: string): boolean {
  if (typeof url !== 'string') return false
  const prefix = publicBucketPrefix(bucket)
  if (!prefix.startsWith('https://')) return false
  try {
    return new URL(url).protocol === 'https:' && url.startsWith(prefix)
  } catch {
    return false
  }
}
