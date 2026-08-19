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

### Cron: `CRON_SECRET` — set 2026-08-17, and until then nothing ran

`CRON_SECRET` did not exist in Vercel production until 2026-08-17. Every cron route guards with
`if (!process.env.CRON_SECRET || auth !== ...)`, and Vercel only attaches the bearer header when
that variable exists — so **every scheduled invocation 401'd.** `digest_runs` was empty from the
day the digest was built, and weekly PTO accrual had never fired either.

It is now set (48 bytes of CSPRNG, base64url, Production only) and the project redeployed, since
a new env var does nothing until the functions are rebuilt. Verified live: anonymous → 401,
wrong secret → 401, correct secret → 200.

⚠️ **Never relax a cron guard to `if (CRON_SECRET && ...)`.** That form skips the check entirely
when the variable is missing. `/api/cron/rfq-reminders` shipped that way for about an hour on
2026-08-17 and an anonymous GET ran the sweep and sent real mail. A route whose only job is to
send email must never be reachable by default. All four cron routes now fail closed.

### Cron schedules and daylight saving — no seasonal maintenance

Vercel Cron is UTC and does not shift, so a fixed schedule drifts an hour twice a year. Jobs whose
local time matters are registered **twice**, and the route discards whichever invocation is wrong
for the season. `vercel.json` as of 2026-08-17:

| Job | UTC schedule | Local | Guard |
|---|---|---|---|
| `accrue-pto` | `0 8 * * 1` | Mon early am | none needed — hour is immaterial |
| `admin-digest` | `30 20 * * *` + `30 21 * * *` | 4:30pm ET | `isDigestTime()` in `lib/admin-digest.ts` |
| `leadership-update` | `0 16 * * 1` + `0 17 * * 1` | Mon noon ET | `isNoonEastern()` in the route |
| `rfq-reminders` | `0 13 * * *` | 9am EDT / 8am EST | none — start of business either way |

⚠️ **The "2-cron account tier limit" was never real.** Three comments asserted it and were the
reason this was not done sooner. A third entry deployed fine, and Vercel documents multiple
schedules for one path as the supported pattern. Do not reintroduce that claim.

The digest's window is a **10-minute band** (`minute >= 25 && <= 34`); the leadership update's is
the **whole noon hour**. The wide window is deliberate and is the better of the two: because the
paired entries sit a full hour apart, a wide window can absorb a late invocation and still never
let both through. The digest's narrow band means a delivery delayed past 4:34pm ET drops that
day's digest entirely — pre-existing, not yet changed, and safe to widen to `hour === 16` if it
ever bites.

**`rfq-reminders` runs twice a day on purpose.** It owns the 13:00 UTC slot *and* is still called
at the top of `admin-digest`. The reminder stamps from migration 088 make the second run a no-op,
so redundancy costs two queries and buys chasing that survives either entry failing.

`?force=1` sends the leadership update outside its window; `?dry=1` previews without sending.
Neither bypasses the secret.

### Daily digest opt-out — TEMPORARY, revisit

Arming the digest meant six admins would receive an email none of them had ever seen. Three are
held back for the first live sends while the format is reviewed:

| Held back | Receives |
|---|---|
| Jacob Younker, Tyler Bell, Jo Evans | Crystal Hill, Kacy Orr, Lee Childers |

The list is `DIGEST_OPT_OUT_DEFAULT` in `lib/admin-digest.ts`. Set `DIGEST_OPT_OUT_EMAILS` in
Vercel to override it without a deploy (empty string = nobody excluded). Every run logs how many
were held back, so this cannot quietly become permanent.

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
`minScore` of **0.7** rather than the 0.5 default. `POST /api/rfq/status/message`
is the same endpoint for quote requests, with the same posture and action
`rfq_message`.

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

## `/support/status` resolves three kinds of reference

Three different intakes hand a customer a reference number, each one living in its
own table, and **each one links the customer to the same status page** from its own
confirmation email. The page routes on the reference prefix:

| Prefix | Table | Resolver |
|---|---|---|
| `IAT-SSSS-NNNN` | `tickets` | `POST /api/tickets/status` |
| `TSC-…` | `troubleshooting_intakes` | `POST /api/troubleshooting/status` |
| `RFQ-YYYY-NNNN` | `rfq_requests` | `POST /api/rfq/status` |

### Ticket numbers: `IAT-SSSS-NNNN` (migration 092, 2026-08-18)

`SSSS` is the last four characters of the unit's serial number, so staff can see
which unit a ticket concerns without opening it. `NNNN` is a **global, never
resetting** counter from `next_ticket_seq()`.

⚠️ **All of the uniqueness lives in `NNNN`.** `SSSS` identifies nothing — two units
can share their last four characters, and one unit files many tickets over its life.
Never look a ticket up by `SSSS`, and never treat two numbers sharing it as the same
unit.

The counter is global rather than per-year for a specific reason: the format has no
year in it, so a counter that reset each January would reissue `IAT-4821-0007` every
year. `tickets.ticket_number` is `UNIQUE`, so the repeat would not create a duplicate
— it would **fail to insert, and the customer would lose their support request**. The
sequence was seeded above every number already issued, so a unit whose serial ends
`2026` can never be handed a number that collides with a legacy `IAT-2026-####`.

Both generation sites (`POST /api/tickets` and warranty-claim approval) build the
number through `lib/ticket-number.ts`, so the format can only change in one place.
A ticket with no serial gets tag `0000` — still unique, because `NNNN` carries it.
The support wizard requires a serial, but `/api/tickets` does not enforce one, and
losing a ticket over a missing serial would be worse than an unhelpful tag.

Anything unrecognised falls through to the ticket resolver. All three return the
**same response shape**, so the page needs no per-kind result plumbing — only the
wording differs (an RFQ moves Received → In Review → **Quoted**, and is never told
an engineer is working on a repair).

⚠️ **A new intake that emails a reference needs a resolver here, in the same
change.** The RFQ resolver was missing from 2026-08-14 until 2026-08-17: the RFQ
confirmation email carried a `/support/status?ticket=RFQ-…` button the whole time,
and every customer who pressed it was told *"No ticket found matching that number
and email"* — a correct answer from the ticket resolver, which was the only place
the page ever looked. The link was live and the lookup worked; they were just
pointed at different tables.

**Tickets and quote requests each get an "Add a message" box; checklists do not.**
Each kind writes to its own endpoint and its own note table:

| Kind | Write endpoint | Lands in | reCAPTCHA action |
|---|---|---|---|
| ticket | `POST /api/tickets/status/message` | `ticket_notes` | `ticket_message` |
| rfq | `POST /api/rfq/status/message` | `rfq_notes` | `rfq_message` |
| checklist | — none — | — | — |

TSC- checklist intakes have no note table and no write endpoint, so the box is
hidden for them rather than offering a reply that could never land. The box and
the endpoint choice are both keyed off the **resolved** reference kind, never off
what is currently typed in the input — retyping the box cannot aim a message at
the wrong table.

**"Request portal access" stays ticket-only.** That CTA links a submission to a
customer portal account, which is a ticket-shaped thing; a quote request has no
equipment behind it to show.

⚠️ **`rfq_notes.body` is rendered as TEXT** (`whitespace-pre-wrap` in
`TriageCard`), while `ticket_notes.content` is rendered as **markup**. The ticket
endpoint therefore escapes the customer's message into HTML and the RFQ endpoint
stores it verbatim. Copying `toSafeHtml()` across would show a customer their own
message wrapped in visible `<p>` tags.

### Telling a customer's message apart from a sales note

`rfq_notes` began (088) as a purely internal trail, and the card above it said so.
Migration **089** adds `author_type` (`staff` | `customer`, defaulting to `staff`)
because both now share one list. The admin trail gives customer entries a sky wash
and a **Customer** badge, and the "internal" promise moved from the heading onto
the composer — the only place it is still true.

`author_type` is hardcoded per route and never read from a request body, so a
crafted POST cannot file a note that reads as staff.

**Who hears about it:** the assignee if the request has one (and their account is
active), otherwise the shared desk — never both. A request with an owner has
someone whose job this is; copying the desk on every message teaches the desk to
filter the folder.

## What the support form now requires

Three gates, added 2026-08-17 at the owner's request, enforced **both** in
`EquipmentTicketForm` (step by step, so the customer sees why "Next" is disabled)
and again in `POST /api/tickets` (the endpoint is public and unauthenticated):

- **Company / organization** — non-empty.
- **Phone number** — at least 10 digits after stripping punctuation. Deliberately
  loose: it checks that a number was really given, not that it is dialable.
- **Problem description** — at least **100 characters** (`MIN_PROBLEM_CHARS`,
  duplicated as a constant in both files; change them together). The Problem step
  shows a live `n / 100` counter and the exact shortfall, because a disabled "Next"
  with no explanation reads as a broken form.

A one-line "it's broken" costs the desk a whole round trip before anyone can help,
and a ticket with no organization or callback number cannot be triaged.

## Endpoint gating

| Endpoint | Rate limit | reCAPTCHA action | Notes |
|---|---|---|---|
| `POST /api/tickets` | 5 / 10 min | `submit_ticket` | the live support form |
| `POST /api/tickets/analyze` | 20 / 10 min | `analyze_ticket` | paid model call |
| `POST /api/troubleshooting` | 10 / 10 min | `submit_troubleshooting` | gated 2026-08-13 |
| `POST /api/troubleshooting/analyze` | 20 / 10 min | `analyze_troubleshooting` | gated 2026-08-13 |
| `POST /api/tickets/status` | yes | none | read-only lookup |
| `POST /api/troubleshooting/status` | yes | none | read-only, used by `/support/status` |
| `POST /api/rfq/status` | yes | none | read-only, used by `/support/status` |
| `POST /api/tickets/status/message` | 8 / 10 min | `ticket_message` | **fail-CLOSED, minScore 0.7** |
| `POST /api/rfq/status/message` | 8 / 10 min | `rfq_message` | **fail-CLOSED, minScore 0.7** |

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

### Ticket-number rollout state (2026-08-19)

Migration `092` is **applied**. The sequence was seeded above every number already
issued, which mattered more than expected: a test ticket at `IAT-2026-9001` sits well
above the real numbering (which ran `IAT-2026-2941`–`2950`), so live numbers now start
at **9004** rather than ~2951. That is the seeding working, not a bug — without it a
unit whose serial ends `2026` could have been handed a number that already existed.

Consequence: roughly 1,000 tickets before the counter widens to five digits and the
number stops being a strict `IAT-XXXX-XXXX`. Reseeding lower is possible but reopens
the collision the seeding closed, so it is a deliberate trade rather than an oversight.

⚠️ `next_ticket_number(p_year)` from `029` is still in the database and unused. It was
left deliberately — dropping it in the same deploy as the code change would have broken
ticket creation for the seconds between the migration landing and the new build going
live. Safe to drop now, in its own change.

**Not yet exercised end to end:** no ticket has actually been created since the format
changed. The sequence was tested directly in SQL and the helper unit-tested against
literals, but the first real submission is still the first real submission.
