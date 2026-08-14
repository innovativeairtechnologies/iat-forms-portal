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

**`SUPPORT_NOTIFICATION_EMAIL` now has a second consumer.** The RFQ desk alert
(`/api/rfq`, migration 087) resolves
`RFQ_NOTIFICATION_EMAIL || SUPPORT_NOTIFICATION_EMAIL || jacob@dehumidifiers.com`,
so it inherits whatever redirect is in place here rather than needing its own. When
you change the value below, you are changing where quote requests land too — and
when you delete it, both senders fall back to their own proper defaults together.

A customer confirmation and an admin-reply copy also exist
(`lib/resend-customer-tickets.ts`) but ship **inert** behind
`CUSTOMER_TICKET_EMAILS = "on"`. Leave that off until the domain below is verified —
with the sandbox sender it would only ever reach the Resend account owner, never the
customer.

## ✅ Resolved 2026-08-14 — the domain is verified and mail sends as itself

DNS moved from Wix to GoDaddy (name servers changed at Network Solutions, the
registrar). `dehumidifiers.com` now reports **verified** in Resend: DKIM, the
`send` SPF TXT, and the `send` MX all pass. Portal mail sends from the real
domain and reaches anyone — the sandbox-sender limitation is gone.

For the record, the outage this fixed: **no support-desk notification was
delivered between 2026-08-03 and 2026-08-13.** The desk recipient became
`crystal@dehumidifiers.com` on 2026-08-03, the sandbox sender could only reach the
Resend account owner, and every send since was refused silently because the route
logs failures without failing the ticket. Six tickets, nobody notified.

### Senders (Vercel, live)

| Variable | Value |
|---|---|
| `RESEND_FROM_SUPPORT` | `IAT Technical Support <iatsupport@dehumidifiers.com>` |
| `RESEND_FROM_PORTAL` | `IAT Portal <noreply@dehumidifiers.com>` |
| `RESEND_FROM_FORMS` | `IAT Forms <noreply@dehumidifiers.com>` |

Ticket mail carries no separate reply-to, so **replies land on the SUPPORT sender**.
That is why it is `iatsupport@` — a real, monitored, shared mailbox.

### Recipients — shared mailboxes only, never individuals

```
SUPPORT_NOTIFICATION_EMAIL = iatsupport@dehumidifiers.com   (tickets, troubleshooting)
RFQ_NOTIFICATION_EMAIL     = iatsupport@dehumidifiers.com   (quote requests)
```

⚠️ **Do not point any of these at a person.** An individual mailbox is a single
point of failure that goes unnoticed until something is missed — holiday, sick
leave, or someone leaving the company. The hardcoded fallbacks in
`app/api/tickets/route.ts`, `app/api/troubleshooting/route.ts` and
`app/api/rfq/route.ts` were changed from `crystal@` / `jacob@` to
`iatsupport@` on 2026-08-14 for the same reason: even the floor should be shared.

`RFQ_NOTIFICATION_EMAIL` is now set **explicitly** rather than inheriting
`SUPPORT_NOTIFICATION_EMAIL`. Previously the RFQ route fell through to whatever
tickets used, so changing the ticket recipient silently moved quote requests too.

### Customer-facing mail is ON

`CUSTOMER_TICKET_EMAILS = "on"`. Despite the name, this one switch governs **all**
customer-facing sends, so they can never drift apart:

- ticket confirmation when a ticket is created — `lib/resend-customer-tickets.ts`
- a copy of an admin's "Reply to customer" note — same file
- **RFQ confirmation when a moisture survey is submitted** —
  `sendRfqConfirmationToCustomer` in `lib/resend-rfq.ts`, added 2026-08-14

Each goes to the address the customer typed, quotes their reference number, and
invites a reply that keeps the reference in the subject.

### Customer mail never invites a reply

Every customer-facing send goes out from **`noreply@dehumidifiers.com`**
(`EMAIL_FROM.PORTAL`), never from `iatsupport@`, and every one carries the line
*"Please do not reply to this email — it is sent from an unmonitored address."*

The reason is structural, not cosmetic. **Nothing ingests inbound email into a
ticket.** An emailed reply lands in a mailbox while the ticket thread sits in the
portal, and the conversation splits across two places nobody reconciles. Sending
from the support mailbox and inviting replies — which is what these emails used to
do — actively caused that split.

Instead each email carries a deep link to
`/support/status?ticket=<reference>` and a **"View your ticket & send a message"**
button.

⚠️ **The no-reply wording and the write path have to ship together.** Telling a
customer not to reply while giving them no way to write back leaves anyone with a
question stranded — worse than the reply-to-a-mailbox behaviour it replaced. If you
ever disable the message box, restore a monitored reply address in the same change.

**`noreply@dehumidifiers.com` is a real alias forwarding to `iatsupport@`** (created
2026-08-14). Sending does not require it — Resend sends on behalf of the verified
domain either way — but people reply to no-reply addresses regardless of what the
email says, and without a mailbox there their message would bounce and be lost.
The forward means a determined customer is never stranded, sitting behind the
message box rather than replacing it. **Do not delete that alias** without first
removing the "do not reply" wording.

### How an anonymous customer writes to a ticket

`POST /api/tickets/status/message`, backing the message box on `/support/status`.

Ownership is proved exactly as the status lookup proves it: **the ticket number
plus the email the ticket was raised with** must both match one row. The number
alone is guessable; the pair is not, and it is what the customer already supplied
to see the ticket at all.

Because it is a public write, it also carries **the strictest reCAPTCHA settings
in the codebase** (action `ticket_message`): `failClosed: true` and a
`minScore` of **0.7** rather than the 0.5 default.

Both are deliberate inversions of the house rule. Everywhere else reCAPTCHA fails
OPEN, because losing a real customer's submission is worse than admitting a bot.
Here reCAPTCHA is the *only* control gating a stranger's write, so failing open
would mean one missing env var silently turns it into an open door that nobody
notices — and a customer blocked here still has the phone. The higher score bar
exists because the "credential" it protects is a guessable pair (a sequential
ticket number plus an often-public email), so automation should face a higher bar
than it does on a first-time submission.

⚠️ A visible "I'm not a robot" checkbox was considered and rejected: it is
reCAPTCHA **v2** (a different site key), it adds friction to the exact journey a
frustrated customer takes to reach us, and it does not address the real threat —
a human guessing a ticket number passes a checkbox without breaking stride.

It also carries a tighter rate limit than the lookup (8 per 10 min vs 20),
message text stored **escaped** and never as caller-supplied HTML, and
`visibility`/`author_type` hardcoded — a crafted request cannot post an internal
note or impersonate staff. The note attaches to the ticket the number+email pair
resolves to, so a caller cannot aim it at someone else's ticket id.

The desk is alerted by `sendCustomerMessageAlert` (`lib/resend-tickets.ts`) to
`SUPPORT_NOTIFICATION_EMAIL`. Without that, a customer reply would land silently
in the thread and nobody would know to look — the same class of failure as the
August outage.

### The DNS that makes this work

| Record | Value |
|---|---|
| name servers | `ns29.domaincontrol.com` / `ns30.domaincontrol.com` (set at Network Solutions) |
| `send` MX | `feedback-smtp.us-east-1.amazonses.com` priority 10 |
| `send` TXT | `v=spf1 include:amazonses.com ~all` |
| `resend._domainkey` TXT | the 218-char DKIM key |
| apex MX | `dehumidifiers-com.mail.protection.outlook.com` priority 10 — **Microsoft, do not touch** |
| apex TXT | `v=spf1 include:spf.protection.outlook.com ~all` |

The website stayed on Wix throughout, reached by "pointing": apex A →
`185.230.63.107`, `www` CNAME → `pointing.wixdns.net`.

⚠️ The stray `feedback-smtp` MX that used to sit on the **apex** at priority 20 was
deleted on 2026-08-14. It belonged on `send`, and as an apex backup it was a route
to a server that does not accept mail for the domain. Microsoft was flagging it as
an error. Never re-create it.

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
