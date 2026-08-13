# Support ticket photos

How a customer's photos get from the public support form onto the admin ticket, and
the failure mode that silently ate them for months.

## The pipeline

The Photos step of `/support/equipment-support` is optional and capped at 8 images.

1. **Browser → Storage, directly.** `components/support/EquipmentTicketForm.tsx`
   uploads each file straight to the public `ticket-photos` bucket with the anon
   key. It deliberately does *not* route the bytes through a route handler —
   Vercel caps a function body at ~4.5MB, which a single phone photo clears easily.
   A failed upload blocks submission and names the files, so photos are never
   half-lost at this stage.
2. **Public URLs into the POST.** `getPublicUrl()` produces one link per file and
   they ride along in the `photo_urls` field of the `POST /api/tickets` body.
3. **Server-side allow-list.** `validPhotoUrls()` keeps only https URLs whose
   prefix is *our* project's public `ticket-photos` path, then caps at 8. This is
   what stops a direct POST to the public endpoint from seeding the table with
   `javascript:`/`data:`/off-site URLs — the column renders straight into `<img
   src>` in the admin, and it keeps us off `images.remotePatterns` wildcards.
4. **Storage on the row.** `tickets.photo_urls` (`text[]`, NULL when empty).
   `TicketDetailClient` renders the Photos section only when the array is
   non-empty, so a ticket that lost its links shows no section at all.

The same allow-list shape guards `form-uploads` for SRV photos
(`app/api/customer/srv/route.ts`, `app/api/bridge/srv-submit/route.ts`) and the
staff-managed reference photos (`lib/support-reference.ts`).

## Incident, 2026-08-13 — a trailing newline ate every customer photo

**Symptom.** A customer (IAT-2026-2944, Norman S Wright) attached six photos to a
burner-alarm ticket. Staff opened the ticket and there were no photos — only the
`image5.jpeg`-style filenames that came from pasting an Outlook email into the
description box, which are just text and were never clickable.

**What actually happened.** All six photos uploaded fine. They were in the bucket,
timestamped one second before the ticket row was written. The row had
`photo_urls = NULL`. Every ticket in the table did.

**Root cause.** The Vercel production value of `NEXT_PUBLIC_SUPABASE_URL` carried a
**trailing newline** — `"https://….supabase.co\n"`. Almost certainly `echo` piped
into `vercel env add`, which appends one. It broke asymmetrically:

- The browser's `supabase-js` client **normalizes** the URL it is constructed with,
  so uploads succeeded and `getPublicUrl()` returned a perfectly clean link.
- Every server-side allow-list built its prefix by **raw template concatenation**,
  putting the newline in the *middle* of the prefix:
  `"https://….supabase.co\n/storage/v1/object/public/ticket-photos/"`.

So `url.startsWith(prefix)` was false for every legitimate upload. The photos were
accepted, stored, and then dropped on the way into the row. Nothing errored: the
customer saw a success screen, the desk email sent, and the files sat orphaned in
the bucket. It took a customer complaint to surface it.

**Blast radius.** The same untrimmed prefix guarded SRV photos (`form-uploads`) and
the `/admin/support-content` reference photos — which is why saving a wheel/seal
image failed with the misleading *"Images must be uploaded here — external links
are not allowed"* and both `app_settings` rows sat empty. `next.config.js` was
unaffected: `new URL()` tolerates the newline, so `remotePatterns` still resolved.

**Fix.**

- Re-saved `NEXT_PUBLIC_SUPABASE_URL` for Production and Preview with no trailing
  whitespace. **Note this is inlined at build time — an env change alone does
  nothing until you redeploy.**
- Added `lib/public-storage.ts`, the single place the env becomes a bucket prefix.
  It trims and strips trailing slashes once; every allow-list defers to it.
- `validPhotoUrls()` now logs when it drops URLs, so this class of silent data loss
  leaves a trace in the runtime log instead of nothing at all.
- Backfilled the six orphaned photos onto IAT-2026-2944.

**If you ever set this env var again:** use `printf '%s'`, never `echo`, and verify
after deploying by grepping the shipped bundle for the literal —
`curl -s <site>/_next/static/chunks/app/support/%5Bform%5D/page-*.js | grep -o '.\{20\}supabase\.co.\{10\}'`.
A stray `\n` shows up there plainly.
