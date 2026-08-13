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

---

# Who gets notified when a ticket comes in

`POST /api/tickets` sends exactly one email — a heads-up to the support desk. The
recipient list is:

```
SUPPORT_NOTIFICATION_EMAIL (comma-separated)  ||  crystal@dehumidifiers.com
```

`/api/troubleshooting` uses the identical expression. There is deliberately **no**
admin fan-out; don't re-plumb `getAdminRecipients()` / `ADMIN_NOTIFICATION_EMAIL`
into either route.

A customer confirmation and an admin-reply copy also exist
(`lib/resend-customer-tickets.ts`) but ship **inert** behind
`CUSTOMER_TICKET_EMAILS = "on"`. Leave that off until the domain below is verified —
with the sandbox sender it would only ever reach the Resend account owner, never the
customer.

## ⚠️ Current state: the domain is unverified, so mail only reaches the account owner

`dehumidifiers.com` is `status: failed` in Resend. With no `RESEND_FROM_*` set in
Vercel every sender falls back to `onboarding@resend.dev`, and **Resend's sandbox
sender can only deliver to the account owner's address**. Any send to anyone else is
refused outright.

That is why **no ticket notification was delivered between 2026-08-03 and
2026-08-13**: the desk recipient became `crystal@dehumidifiers.com` on 2026-08-03,
and every send since was rejected. The route logs the failure and never fails the
ticket, so nothing surfaced.

**Stopgap in place:** `SUPPORT_NOTIFICATION_EMAIL` = `jacob.younker@dehumidifiers.com`.
Alerts must be **forwarded to Crystal by hand** until the domain verifies.

## Fixing it — two DNS edits (NOT yet applied as of 2026-08-13)

Resend authenticates via a **`send.` subdomain**, so the apex SPF record is *not*
involved and Microsoft 365 mail flow is not at risk. Current live DNS:

| Record | State |
|---|---|
| `send.dehumidifiers.com` TXT → `v=spf1 include:amazonses.com ~all` | ✅ correct |
| `send.dehumidifiers.com` MX | ❌ **missing** |
| `dehumidifiers.com` (apex) MX → `feedback-smtp.us-east-1.amazonses.com` pri 20 | ⚠️ **wrong place** |
| `resend._domainkey` DKIM | ✅ verified |

Resend's MX was added to the **root domain** instead of the `send` host. Two edits:

1. **Delete** from `dehumidifiers.com`:
   `MX  @  feedback-smtp.us-east-1.amazonses.com  priority 20`
2. **Add** on host `send`:
   `MX  send  feedback-smtp.us-east-1.amazonses.com  priority 10`

Leave the apex SPF (`include:spf.protection.outlook.com`) and the Outlook MX
(priority 10) exactly as they are.

Do edit 1 regardless of Resend: that stray priority-20 apex MX is a **backup mail
route pointing at an SES feedback endpoint that does not accept mail for the
domain**. If Outlook's MX is briefly unreachable, senders fall back to it and
inbound mail can bounce.

Once Resend reports `verified`:

1. Set `RESEND_FROM_SUPPORT` = `IAT Technical Support <technicalsupport@dehumidifiers.com>`
   in Vercel (read at runtime — no code change).
2. Point `SUPPORT_NOTIFICATION_EMAIL` back at `crystal@dehumidifiers.com`, or delete
   the var to fall through to the hardcoded default.
3. Only then consider `CUSTOMER_TICKET_EMAILS = "on"`.

**Do not set `RESEND_FROM_*` before the domain verifies** — sending from an
unverified domain makes Resend reject every message, which is strictly worse than
the sandbox fallback.

## Endpoint gating

| Endpoint | Rate limit | reCAPTCHA action | Notes |
|---|---|---|---|
| `POST /api/tickets` | 5 / 10 min | `submit_ticket` | the live support form |
| `POST /api/tickets/analyze` | 20 / 10 min | `analyze_ticket` | paid model call |
| `POST /api/troubleshooting` | 10 / 10 min | `submit_troubleshooting` | gated 2026-08-13 |
| `POST /api/troubleshooting/analyze` | 20 / 10 min | `analyze_troubleshooting` | gated 2026-08-13 |
| `POST /api/tickets/status` | yes | none | read-only lookup |
| `POST /api/troubleshooting/status` | yes | none | read-only, used by `/support/status` |

The two troubleshooting endpoints were open until 2026-08-13 — a rate limit was the
only barrier on a public POST that wrote a row, spent a model call and sent mail.
Nothing in the live UI posts to them: the checklist merged into the Equipment
Support ticket, `/support/troubleshooting` redirects, and
`components/support/TroubleshootingChecklistForm.tsx` is no longer rendered.
**If that form is ever revived it must send a token with action
`submit_troubleshooting`**, or every submit will 400.

The `/status` endpoints stay ungated on purpose: they are read-only, and the live
`/support/status` page sends no token.

## Verifying a change to any of this

reCAPTCHA blocks scripted submissions (an automated browser scores ~0.3 against a
0.5 threshold), so the ticket flow **cannot be smoke-tested by a script** — it needs
a human on `/support/equipment-support`. After a real submission, confirm:

1. `tickets.photo_urls` is a populated array, not `NULL`.
2. Resend shows a `delivered` event to whatever `SUPPORT_NOTIFICATION_EMAIL` points at.
3. Vercel runtime logs contain no `dropped N of M photo URL(s)` warning.
