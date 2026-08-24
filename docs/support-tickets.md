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
| `RESEND_FROM_INTERNAL` | staff-bound alerts only — see below |

Desk alerts now carry an explicit `replyTo` of the SUPPORT sender, so **replies still land on
`iatsupport@`** — a real, monitored, shared mailbox — whatever address they were sent from.
Before 2026-08-20 that came for free from the From address; it is now stated outright, because
the From address can differ.

### `RESEND_FROM_INTERNAL` — why staff mail sends from a subdomain

Mail to IAT staff comes back into our own tenant, and the route it takes strips the envelope
sender. By the time our filtering sees it, SPF evaluates as None and DKIM/DMARC as N/A: the
message claims to be from `dehumidifiers.com` and can prove nothing, which scores as domain
spoofing and quarantines. Our filtering will not allow-list our own domain — that would be a
genuine spoofing hole — so no allow entry or filter rule fixes it.

Setting `RESEND_FROM_INTERNAL` (e.g. `IAT Portal <noreply@portal.dehumidifiers.com>`) moves
staff-bound alerts onto a subdomain that is **not** a protected domain. The spoofing verdict
stops applying, and the subdomain can be allow-listed the ordinary way.

It covers every send addressed to IAT staff. Action-triggered: ticket desk alerts, the customer
reply alert, the admin digest, troubleshooting alerts, form-submission notifications, time-off
requests, the portal contact relay, and the sales-desk notice on a new quote request.
Schedule-triggered: ticket reminders, quote-request reminders, the unassigned-work escalation to
leadership, and the weekly leadership update.

⚠️ The schedule-triggered half was **missed** in the first pass (2026-08-20) and only caught on
2026-08-24, after two weekend reminders were found sitting in quarantine. If you add a new sender,
ask who receives it, not what triggers it. The reminders are the safety net for a ticket nobody has
picked up — they fire exactly when everything else has already been missed, which makes them the
worst thing to leave on the wrong domain.

**Customer-facing mail is deliberately excluded** and still sends from `dehumidifiers.com`. That
includes the quote-request confirmation, which lives in `lib/resend-rfq.ts` alongside the sales-desk
notice that did move — the two sends in that one file intentionally use different domains.
`app/api/tools/duct-traverse/email` also stays, because it mails an arbitrary address chosen by the
staff member and can legitimately reach a customer.

### Adding a new sender — this is checked, not trusted

```bash
npm run audit:email
```

Every `resend.emails.send` in `lib/` and `app/` must declare its audience, and the script fails
the moment one does not:

- **To IAT staff** — `from: internalFrom(EMAIL_FROM.PORTAL)` (or `SUPPORT` / `FORMS`)
- **To customers** — keep `EMAIL_FROM.*` and put a comment containing `customer-facing` within
  the three lines above the send, saying who receives it
- **A module where every send goes to customers** can say it once near the top instead:
  `// audit: all sends customer-facing — …`

Current state: 22 staff senders, 11 customer senders, none unclassified.

The point is that "who receives this" is no longer something a reviewer has to hold in their head.
A new sender that forgets to choose fails the audit rather than quietly quarantining for four days,
which is exactly how the reminders were lost between 2026-08-20 and 2026-08-24.

⚠️ Never register `portal.dehumidifiers.com` as a protected domain in the mail filter.
Doing so re-creates the exact problem this works around.

Unset, `internalFrom()` returns each caller's existing address and nothing changes.


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

### The assigned owner also gets a copy (2026-08-20)

The rule above governs what the **environment variables** may point at, and it still holds:
never configure one to a person. What changed is that the ticket's assigned owner is now added
to the recipient list **on top of** the desk, resolved at send time from `tickets.owner_id`.

The desk is never replaced and never dropped. An unassigned ticket alerts exactly as before.
That is the whole point — the shared mailbox is the safety net that survives someone being on
leave, and the owner's inbox is what stops a reply from being everybody's problem and therefore
nobody's.

One helper does this for every path: `ticketAlertRecipients(ownerId)` in `lib/ticket-recipients.ts`.
It applies to:

| Path | Event |
|---|---|
| `app/api/tickets/status/message` | customer replies from `/support/status` |
| `app/api/bridge/ticket-note` | customer replies from the customer portal |
| `app/api/customer/tickets/[id]/resolve` | customer marks resolved, portal |
| `app/api/bridge/ticket-resolve` | customer marks resolved, customer app |

⚠️ `app/api/bridge/ticket-note` sent **no alert at all** before this date. A customer replying
through the customer portal landed a note in the thread and nobody was told. If you add a new way
for a customer to write on a ticket, wire it to `ticketAlertRecipients` or it will be silent in
exactly the same way.

The owner lookup is deliberately conservative, because these alerts quote the customer verbatim
and a misdelivery is a disclosure rather than just noise:

- **`is_active` is required.** A deactivated person stops receiving customer content immediately,
  even on tickets they still own.
- **A non-empty email is required.** The `employees` table is not staff-only — every customer
  invite adds a row — so a blank address is treated as "no owner to notify", never guessed at.
- **Any lookup failure falls back to the desk alone.** Losing the desk alert is the exact failure
this path exists to prevent, so it must never be caused by a problem resolving the owner.

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

## The queue's filter ribbon (2026-08-21)

`/admin/tickets` filters on two different axes through one row of tabs:

| Tab | Predicate |
|---|---|
| All | everything |
| **My Tickets** | `owner_id === meId`, then Active (not closed) / Closed |
| **Unassigned** | `!owner_id` |
| Open / In Progress / Resolved / Closed | `status === value` |

**My Tickets carries its own Active / Closed switch**, in the toolbar beside the search box, and
defaults to Active. Without it the tab only ever grows: every ticket you have ever owned, forever.
Closed is one click away rather than hidden — nothing of yours is unreachable, it just is not in
your face — and both sides show their count, so "have I got anything closed?" is answerable
without switching.

**"Active" means NOT closed** — open, in progress *and resolved*. Resolved belongs on the active
side because a resolved ticket is not finished: a customer saying "seems fixed" raises a hand, and
someone here still has to agree and close it formally. Filing it under Closed would hide exactly
the tickets still awaiting a decision.

The switch renders only on the `mine` tab, and `mineScope` feeds the row filter, the tab badge, the
switch's own counts, the selection reset and the pagination reset key — so nothing can disagree
with anything else.

**One predicate, `matchesFilter()`, feeds both the tab counts and the rows**, so a badge can never
disagree with the list underneath it.

⚠️ **`meId` is an `employees.id`, and EMAIL IS THE ONLY JOIN.** `tickets.owner_id` references
`employees`, and there is no `user_id` on that table (check the type in `lib/supabase.ts`) — the
auth user and the employee row are related by address alone. `myEmployeeId()` in
`app/admin/tickets/page.tsx` therefore matches case-insensitively and does **not** use
`.maybeSingle()`: the employees table is not staff-only (every customer invite adds a row), so a
duplicate address is possible and `maybeSingle()` throws rather than degrades. Active rows sort
first. No match → the tab is hidden rather than shown permanently empty.

### The default tab is My Tickets (changed 2026-08-21)

It used to be Open — and of 14 live tickets on 2026-08-21, **zero** were `open` (9 in progress, 2
resolved, 3 closed), so the queue opened on an empty screen. It now lands on `mine` / Active.

⚠️ **The fallback matters.** `meId` is null for any account with no matching `employees` row, and
`mine` is hidden in that case, so the default falls back to **All** — a selected-but-absent tab
renders an empty list with nothing highlighted, which looks broken.

## Ticket alerts link to the ticket, not the queue

Every desk alert deep-links to `/admin/tickets/<id>`. `sendCustomerMessageAlert` was the exception
— it linked to the bare queue, which defaults to Open, so the reply you had just been told about
was something you then had to go and find. It now takes a required `ticketId`.

The middleware's `toLogin()` copies the pathname into `?redirect=`, so these links work from a
signed-out inbox: you sign in and land on the ticket.

The only remaining links to the bare queue are in `lib/resend-ticket-reminders.ts`, and both are
correct — they fire when the mail covers **several** tickets, where the queue genuinely is the
destination. The single-ticket branch of the same email already deep-links.


## Assignment, reopening, and the 30-day window (2026-08-21)

### "Waiting on Customer", and the 14-day ladder (2026-08-24, migration 094)

A fifth status for work that is genuinely parked on the customer: we asked them something and
cannot proceed until they answer. `lib/ticket-waiting.ts` runs it down a fixed ladder from the
existing daily ticket-reminders cron:

| Day | What happens |
|---|---|
| 7 | Customer is nudged, **naming the date the ticket will close** |
| 13 | Customer gets a "closing tomorrow" final warning |
| 14 | Ticket moves to **`resolved`**, and the **owner** is emailed that it still needs a real close |

**⚠️ It resolves; it does NOT close.** Closing requires an owner and closing notes written by a
person, and a cron has neither — inventing a note to satisfy our own rule would hollow the rule
out. So the sweep does the part it can defend and hands the last step to a named human. The
alert says so explicitly, and links straight to the ticket.

**A customer reply stops the clock.** `app/api/tickets/status/message` moves a replying ticket
from `waiting_on_customer` back to **`in_progress`** (not `open` like a reopen — nobody needs to
triage it; the owner was already working it and now has their answer). Without this a customer
could answer on day 8 and still be auto-resolved on day 14.

Design notes worth keeping:

- **`waiting_on_customer` is deliberately NOT in `LIVE_STATUSES`** in `lib/ticket-reminders.ts`.
  Nagging an owner daily about a ticket they are correctly blocked on is how people learn to
  ignore the nudge entirely.
- **It counts as ACTIVE** in the queue's My Tickets switch — "active" is everything not closed —
  because a parked ticket is still yours and still on a clock.
- **No new column.** "Waiting since" is derived from `audit_log` exactly like `closedAt`, and the
  already-sent chase emails are tracked as `ticket.waiting_notice` audit rows keyed by
  `metadata.kind` (`day7` / `final24`). Notices only count if written *after* the current wait
  began, so a ticket parked → answered → parked again is chased again from day zero.
- **Fails safe on an undated wait.** If there is no audit row saying when the wait started, the
  sweep reports the ticket in `undated` and leaves it alone rather than assuming it is old and
  resolving it out from under someone.
- The auto-resolve `UPDATE` is guarded with `.eq('status', WAITING_STATUS)` so it cannot land on
  top of a status a human changed while the sweep was running.
- `resolved_reason` is left unset — none of the fifteen fixed phrases means "the customer never
  came back", so the person who closes it picks the honest one.
- The customer is **not** emailed a third time on auto-resolve. They were told at day 7 and again
  24 hours before, and the warning said the ticket would close itself.

### Closing notes are NO LONGER sent to the customer by default (2026-08-24)

Until now, resolving or closing a ticket emailed the engineer's closing remarks to the customer
**verbatim, every time, with no way to opt out**. That quietly made an internal field
customer-facing: closing notes are where the real diagnosis goes, and they can carry a commercial
note or a candid assessment that is entirely right internally and wrong to put in front of the
person who raised the ticket.

**The remarks are still required** — they are the record of what was done. What changed is who sees
them.

Pressing the button on a terminal transition now opens a **closing dialog** instead of saving
immediately. It names the address the mail is going to and offers two choices:

| Choice | The customer gets |
|---|---|
| **Confirmation only** — the default | The ticket is resolved/closed, and an invitation to come back with questions or if the problem returns. No notes, **and no resolution reason** — that is one of fifteen fixed reporting phrases, the same category of internal vocabulary. |
| **Include my closing notes** | The previous behavior: notes word for word, plus the resolution reason. The dialog shows exactly what will be sent before it goes. |

Enforcement and defaults, all pointing the same way:

- `sendTicketClosedToCustomer(ticket, remarks, status, shareNotes, resolvedReason?)` takes
  `shareNotes` as a **required** parameter, so a future caller has to state its intent and this can
  never silently revert to sending.
- `updateTicket` reads `data.share_closing_note === true`, not a truthy check — an absent flag means
  *do not send*, never *unspecified, so send*.
- The dialog resets to "do not send" every time it opens; the choice is never inherited from the
  previous ticket.
- The `ticket.status` audit row records `notes_shared: true｜false` on a close, so "did they see
  what I wrote?" stays answerable afterwards.

⚠️ If a ticket has no customer email, or `CUSTOMER_TICKET_EMAILS` is not `on`, the dialog says so
plainly rather than implying a send. The page resolves that gate server-side and passes it down as
a boolean — ⛔ never import `resend-customer-tickets` into the client component, it builds the
Resend client at module scope.

### A ticket cannot be resolved or closed while unassigned (2026-08-24)

Tickets were reaching a terminal state with nobody's name on them. That loss is **unrecoverable**:
`audit_log` records that the status changed and who clicked the button, but an owner that was never
set is simply absent — so time-to-close by engineer, workload, and the plain question "who do I ask
about this one?" all quietly degrade.

`updateTicket()` now refuses the move, right beside the closing-notes guard and on the same
`closing` condition:

```ts
if (closing && !data.owner_id) {
  return { error: 'Assign an owner before resolving or closing — a finished ticket needs a name on it.' }
}
```

**Applied to `resolved` as well as `closed`**, matching the closing-note rule rather than inventing
a second, differently-shaped one. Resolved is if anything the more important of the two: per the
queue's Active/Closed split a resolved ticket is still live work awaiting formal closure, so an
unowned one is a job with nobody on the hook to finish it.

Enforced on the server because that is where it is authoritative. The detail page mirrors it —
the Owner label gains a `*`, the select turns rose, and **Update Ticket** is disabled with a line
saying why — for the same reason the closing-note guard does: refusing without explaining is not
help.

⚠️ Only a genuine transition is guarded (`statusChanged`), so editing the priority of an already
closed ticket is never blocked by it.

### ⚠️ Queue status actions could fail silently — fixed 2026-08-24

`setStatusFor()` in `TicketsQueueClient` called `updateTicket` for each selected row and **discarded
the returned `error`**, then called `router.refresh()` regardless. A refused change was therefore
indistinguishable from a successful one: the row simply did not change.

This was not hypothetical. The queue offers **Resolve** (row menu and bulk bar) but has nowhere to
write closing remarks, so *every* Resolve from the queue was already being rejected by the
closing-note guard and silently swallowed. The owner guard above would have added a second silent
rejection on the same path.

Failures now surface in a rose banner above the filter ribbon, naming the ticket numbers and the
reason, and pointing at the ticket itself — neither requirement can be satisfied from the queue.

### Assigning a ticket emails the new owner

`updateTicket()` already detected owner changes for the audit trail; the alert hangs off the same
branch. Three deliberate limits:

- **The new owner only, never the desk.** The desk hears every customer-facing event already, and
  "Kacy now owns this" in a shared mailbox is noise — the thing the whole alert redesign exists to
  reduce.
- **Nothing on unassignment.** There is nobody to tell.
- **Nothing when you assign to yourself.** You were just there.

The lookup mirrors `ticketAlertRecipients`' guards (`is_active`, non-empty address) for the same
reason: this mail quotes the customer's problem verbatim, so a misdelivery is a disclosure. A send
failure is caught and logged — the assignment is already committed and is what the queue reads.

### A customer reply to a CLOSED ticket reopens it

Previously the reply landed in the thread and the ticket stayed closed, i.e. invisible in every
queue view. Now, inside the window, it goes back to **`open`** — not `in_progress`, because it needs
triage and should surface in Open/Unassigned rather than looking like something already in hand.
The **owner is kept**, so it stays with whoever knows it and no assignment alert re-fires.

`sendTicketReopenedAlert` is a separate email from `sendCustomerMessageAlert` on purpose: a reply on
a live ticket is routine, a reply on one we closed means we called it done and the customer
disagrees.

⚠️ **The reopen writes a `ticket.status` audit row, and that is load-bearing, not decoration.**
`lib/ticket-history.ts` derives the entire lifecycle — close time, reopen count, and therefore the
30-day gate itself — from those rows. Skip it and the ticket's next reopen check reads the
*original* close date.

### The 30-day window

`REOPEN_WINDOW_DAYS = 30`, in `lib/ticket-history.ts`. Checked BEFORE the note is written, so a
blocked customer does not leave a message nobody will read. A 409 carries `code:
'reopen_window_closed'` and a `newTicketUrl`, and the status page turns that into a real link
rather than only naming the rule.

🔴 **`reopenDecision` FAILS OPEN in three separate ways, all deliberate:** a ticket that is not
closed, a closed ticket with no close row, and an unreadable audit trail are all allowed. The cost
of wrongly allowing is one ticket to triage. The cost of wrongly blocking is a customer with a
broken dehumidifier being turned away by a rule they cannot see or argue with. Do not "tighten"
this.

⚠️ **There is no `closed_at` column.** The tickets table records `created_at`,
`customer_resolved_at`, and the reminder/escalation stamps from migration 090 — nothing for when
staff closed it. Every close date here comes from `audit_log`. Verified 2026-08-21: 8 close events
on record covering all then-closed tickets exactly. The intended end state is a real column with
this as the backfill; it was not built only because the Supabase CLI was unauthorized that day and
DDL cannot go through PostgREST.

## Reports (2026-08-21)

`/admin/reports` — new sidebar group, `Support Tickets` its first entry.

**Access: the `reports` perm, admin-only BY OMISSION.** It is granted to no scoped role in
`DEFAULT_ROLE_PERMS`, so `hasPermission()` returns true only for `admin` and no `role_permissions`
seed or migration is needed — the same pattern as `srv` and `sizing`. The `check-perm-seed`
prebuild gate passes precisely because nothing is granted. Grant it to a role from
`/admin/permissions` when someone specific needs it.

⚠️ **Deliberately NOT reusing `tickets`.** That perm is held live by engineering and
production_manager; reporting aggregates who closed what and how fast, which is a different question
from working the queue. Widening the queue perm to cover it would have been invisible.

Gated **twice**: `ADMIN_PATH_PERMS` maps `/admin/reports` → `reports`, and each page re-checks
`can('reports')` and calls `notFound()`. An unmapped `/admin/*` path falls back to `dashboard`,
which every scoped role holds, so the second check is what makes a future matcher edit fail closed
instead of exposing the whole report.

### What it measures, and why

| Metric | The question behind it |
|---|---|
| Opened / Closed / Net | is the backlog growing |
| Reopen rate | did we call things done that were not |
| Median days to close | how long a customer actually waits |
| Aging buckets | which tickets have gone quiet |
| By owner | workload and throughput |
| By customer | who absorbs the most support |
| **By equipment model** | which machines keep coming back — the only one that can change what gets *built* |
| Resolution reasons | what actually fixes these |

**Medians, not means.** One ticket left open over a shutdown drags a mean into uselessness, and
support data is full of those. Time-to-close uses the FIRST close, so a reopen does not flatter it.

🔴 **`lib/ticket-report-types.ts` exists for one reason: `TicketReportClient` is a `'use client'`
component and must not import a value from `lib/ticket-report.ts`, which imports `supabase-admin`.**
Importing `RANGES` from there shipped the service-role client to the browser and the page died at
hydration with `supabaseKey is required` — **past `tsc` and past a green server render**, so only
loading the page caught it. Types are erased and would have been fine; the constant was not.


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
