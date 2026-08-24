# Every automated email the portal sends

One page, because "who gets told what, and when" was previously spread across six
files and nobody could answer it without reading all of them.

Two rules govern the whole table:

- **Staff mail is never gated.** Reminders, escalations and desk alerts go out
  regardless of `CUSTOMER_TICKET_EMAILS`. They are the mechanism that stops work
  going quiet; suppressing them would defeat the point.
- **Customer mail is gated** behind `CUSTOMER_TICKET_EMAILS === "on"` (currently
  **on**). One switch turns every customer-facing send off together, rather than
  leaving quote requests able to mail people while tickets stay silent.

---

## Support tickets

| # | Trigger | Who is told | When |
|---|---|---|---|
| 1 | A ticket is submitted | Support desk (`SUPPORT_NOTIFICATION_EMAIL` → `iatsupport@`) | Immediately |
| 2 | A ticket is submitted | The customer — confirmation + AI first-checks | Immediately |
| 3 | Staff post a **public** note | The customer — a copy of the reply | Immediately |
| 4 | A customer writes back on `/support/status` | Support desk | Immediately |
| 5 | Status changes (not terminal) | The customer — what it changed to | Immediately |
| 6 | Status changes to **Resolved** or **Closed** | The customer — the engineer's closing notes, verbatim | Immediately |
| 7 | A customer marks their own ticket resolved | Support desk — *verify before closing* | Immediately |
| 8 | Assigned, no activity for **24h** | The assignee, one email covering all their stalled tickets | Daily 13:00 UTC |
| 9 | Unassigned for **24h** | Support desk | Daily 13:00 UTC |
| 10 | Unassigned for **24h** | **Leadership** — Kacy and Crystal, individually | Daily 13:00 UTC |

**Internal notes never reach the customer.** Only notes explicitly marked public
do (#3). This is the single most important line on this page.

**"No activity" means no note** (#8), not "the status has not moved". A ticket
someone is working leaves a trail, even "waiting on parts". Keying on status
would let a ticket sit in *In Progress* forever and count as alive — the exact
failure being chased.

## Quote requests (RFQ)

| # | Trigger | Who is told | When |
|---|---|---|---|
| 11 | An RFQ is submitted | Sales desk (`RFQ_NOTIFICATION_EMAIL` → `SUPPORT_NOTIFICATION_EMAIL` → `iatsupport@`) | Immediately |
| 12 | An RFQ is submitted | The customer — receipt with their reference | Immediately |
| 13 | An RFQ is assigned to someone | The new owner. **Not** sent on self-assignment | Immediately |
| 14 | A customer writes back on `/support/status` | The assignee, or the desk if unassigned — never both | Immediately |
| 15 | Assigned, still `new` after **24h** | The owner, one email covering all their stalled rows | Daily 13:00 UTC |
| 16 | Unassigned after **24h** | Sales desk, subject prefixed `REMINDER:` | Daily 13:00 UTC |
| 17 | Unassigned after **24h** | **Leadership** — Kacy and Crystal, individually | Daily 13:00 UTC |

## Everything else

| # | Trigger | Who is told | When |
|---|---|---|---|
| 18 | Daily admin digest | Admin roster, minus `DIGEST_OPT_OUT_DEFAULT` | Daily, lands ~16:30–17:45 ET |
| 19 | Weekly leadership update | `LEADERSHIP_UPDATE_EMAIL` → currently **lee.childers@** only | **Mondays 17:00 ET** |
| 20 | PTO accrual run | — (no mail; a scheduled data job) | Mondays 08:00 UTC |
| 21 | Form submissions, PTO requests, approvals | Per-form recipients | Immediately |
| 22 | A customer requests portal access | Support desk + the three approving admins, individually | Immediately |

### A portal-access request used to tell nobody (fixed 2026-08-24)

A customer who has filed a support ticket can click **Request portal access** on the ticket success
screen or on their `/support/status` result. Until 24 August that wrote a row to
`customer_portal_requests` and notified **no one**. The customer saw *"we'll review it and email you
once it's approved"*; the only thing that could surface the request was an admin opening
`/admin/customers` and clicking a tab they had no reason to click. Two requests were found sitting
there, one three days old.

Two things now carry it, and they are deliberately different in kind:

- **#22, the immediate alert** (`lib/resend-portal-access.ts`) — fires the moment the request lands.
- **A digest section**, *Portal Access Awaiting Approval* — a standing list of everything still
  pending, on every digest until it is decided.

One is the nudge, the other the net. A request has to survive **both** to go quiet.

**Who is told.** The shared desk (`SUPPORT_NOTIFICATION_EMAIL` → `iatsupport@`) plus the three admins
who can act — `PORTAL_ACCESS_ALERT_EMAIL`, defaulting to **kacy@, crystal@, lee.childers@**. Both,
for the reason `lib/ticket-recipients.ts` gives: the desk is the monitored record that survives
someone being away, the named people are the ones who will do something. One email per recipient,
not a shared `To:` line.

⚠️ **Only a full `admin` can approve or deny.** Both `/api/admin/customers/invite` and the deny route
use the strict `getAdminUser()`, so alerting a scoped role would be telling someone about a button
they cannot press. If the approver roster changes, set `PORTAL_ACCESS_ALERT_EMAIL` in Vercel —
no deploy needed — and check the person actually holds `role='admin'`.

⚠️ **This email deliberately carries no free text from the customer.** Not an oversight: staff-bound
mail is filtered by the Exchange rule `Block Bulk / Sales Emails`, which quarantines any external
message containing phrases like *"act now"* or *"limited time"*, and SCL -1 does not exempt it.
Ticket alerts quote the problem description verbatim and are exposed to exactly that. This one
carries only short identity fields and a link, because the decision it asks for is "is this person
who they say they are" — not a repair narrative. **Keep it that way.**

The alert is **awaited, and its failure is swallowed**. Awaited because a detached promise on a
serverless function can be frozen the instant the response returns — a send that simply never
happens. Swallowed because the row is already committed: failing the customer's submission over our
own mail relay would turn a notification problem into a customer-facing one. A lost alert degrades
to the digest, which is what the digest half is for.

### The digest had never sent, and why (fixed 2026-08-20)

`digest_runs` held **zero rows from the day migration 038 created it**. The missing
`CRON_SECRET` found on 2026-08-17 was real but was not the whole cause — fixing it
only moved the failure somewhere quieter.

**Vercel fires crons on this project 14 to 63 minutes late.** Measured from Resend
send timestamps: 13:00→13:41, 21:30→22:03, 22:00→22:42, and the digest itself at
20:30→21:33. `isDigestTime()` accepted a **ten-minute** window (16:25–16:34 NY)
against an entry scheduled for 16:30 exactly, so every invocation arrived after it
had closed.

⚠️ **Widening to `hour === 16` is NOT enough.** The entry runs at :30 past, so any
delay over thirty minutes crosses into 17:xx. The weekly leadership report survives
on a bare hour check only because it is scheduled at :00, so its whole delay budget
fits inside one hour.

**What shipped:** correctness rests on `digest_runs`' unique index on `run_date` —
the first invocation of the NY day claims it, later ones no-op — with
`withinDigestWindow(hour) = hour >= 16 && hour <= 18` kept only as a sanity bound so
a wildly misfired run cannot mail everyone at 3am.

**Excluding hour 15 is load-bearing.** It makes the correct entry win in each season,
because the earliest *eligible* invocation is the one that claims:

|  | 20:30 UTC | 21:30 UTC | sends |
|---|---|---|---|
| EDT | 16:30 NY **claims** | 17:30 NY no-op | ~4:30–4:45pm |
| EST | 15:30 NY *skipped* | 16:30 NY **claims** | ~4:30–4:45pm |

Same commit: the route claimed the day **before** sending and never released it, so a
failure fetching the briefing or the recipient list burned the whole day silently. The
claim is now released when `sent === 0`, guarded so a partial send can never be
retried into duplicates.

**First successful send: 2026-08-20, 3 recipients.** It fired 63 minutes late and
landed in hour 17 — `hour === 16` would have missed again.

⚠️ Vercel's runtime logs are useless for confirming a cron ran here: wide queries time
out, historical ones return `ExceedsBillingLimitError`, and cron invocations did not
appear even when they demonstrably ran. Check the side effects instead — `digest_runs`
and the Resend send list.

The weekly update covers one **edition** — a Monday-to-Sunday work week named
after its Monday (`lib/edition.ts`), e.g. **Edition 8.17.26** for 17–23 August.
Sent Monday evening, it reports the edition that closed the night before; that
Monday's own work belongs to the edition just starting and appears next week.
Rebuild any past week with `?edition=8.17.26` (or `2026-08-17`) — any date inside it resolves to
that week's Monday.

---

## The two scheduled reports, and which is which (2026-08-21)

They are often confused, so: **one is an email, one is a document.**

| | Daily admin digest | Leadership update |
|---|---|---|
| Format | HTML email | Word document, attached |
| When | **every day**, ~16:30 ET | **Mon / Wed / Fri**, 18:00 ET |
| To | admins, minus `DIGEST_OPT_OUT_EMAILS` | `LEADERSHIP_UPDATE_EMAIL` |
| Built from | live tickets + quote requests | `CHANGELOG.md` |
| Route | `/api/cron/admin-digest` | `/api/cron/leadership-update` |

### The digest now covers quote requests too

Three RFQ sections mirroring the ticket ones: newly assigned to you, yours aging past 3 days, and
unclaimed.

⚠️ **Unclaimed is ORG-WIDE while everything else is per-person**, and the asymmetry is deliberate.
An unclaimed request belongs to nobody, so a strictly per-owner digest is precisely the shape that
never mentions one. Checked 2026-08-21: all ten live requests were unassigned, so a per-owner-only
view would have shown every admin an empty section while ten sat there.

`rfq_requests` has a real `assigned_at`, so "newly assigned" is genuinely when it became theirs —
unlike the ticket half, which approximates with `created_at` because tickets carry no separate
assignment timestamp. The RFQ read **degrades rather than throws**: losing the ticket half is a bug,
losing the RFQ half should still deliver the tickets.

### The digest also covers portal-access requests (2026-08-24)

One section, *Portal Access Awaiting Approval*, listing every `pending` row in
`customer_portal_requests` — ticket number, who is asking, and how many days they have waited.

⚠️ **Org-wide, and it cannot be anything else**: these rows have no owner field at all. Same
reasoning as unclaimed RFQs above, one step further along. Read **once per run** and handed to every
recipient, like the shared briefing paragraph, rather than re-queried per admin — the answer is
identical for all of them. Like the RFQ half it **degrades to an empty list rather than throwing**,
and it is read *after* the recipient roster so it can never be the thing that costs a run its claim
on `digest_runs`.

The subject line gains `, N portal access` only when N > 0, so a quiet day reads exactly as before.
Both the section rows and the immediate alert link to `/admin/customers?tab=requests`, which
deep-links to the tab — a link that drops you one click short of the thing it is telling you about
is how a notification stops working.

### Leadership: three times a week, and what each run covers

Changed 2026-08-21 from Mondays at 5pm. Each run covers **only the days since the previous run**:

| Run | Covers |
|---|---|
| Monday | Saturday, Sunday, Monday |
| Wednesday | Tuesday, Wednesday |
| Friday | Thursday, Friday |

Every day exactly once, nothing twice.

🔴 **EVERY SCHEDULED SEND IS NOW AN INTERIM — there is no automatic weekly edition.** Adding a
Monday full-week edition back alongside these would re-send Tuesday-to-Friday content that already
went out on Wednesday and Friday. `?edition=8.17.26` still rebuilds any past week by hand.

⚠️ **The hour check had to widen, and a claim had to come with it.** `is5pmEastern()` tested
`hour === 17` and survived only because exactly one cron entry could ever land inside that hour.
Crons here run **up to 63 minutes late**, so a 6pm entry arriving at 19:03 would have silently sent
nothing — the identical failure that stopped the daily digest sending for months. The window is now
18:00–20:00, and `leadership_last_sent` in `app_settings` claims the NY day so a wide window cannot
send several copies.

DST is handled by window + claim rather than by one entry being wrong for the season:

|  | 22:00 UTC | 23:00 UTC |
|---|---|---|
| EDT | 18:00 ET **sends** | 19:00 ET in window, day claimed, no-op |
| EST | 17:00 ET outside window | 18:00 ET **sends** |

⚠️ The claim is read-then-write, not an atomic upsert on a unique index. The entries sit an hour
apart, so the race needs a 60-minute delay landing on the exact second of the other run. A real
`leadership_runs` table with a UNIQUE index on the date is the correct fix once migrations are
available (the Supabase CLI was unauthorized on 2026-08-21 and DDL cannot go through PostgREST).

### ⚠️ Setting LEADERSHIP_UPDATE_EMAIL

Use `--value` **and `--no-sensitive`**:

```
npx vercel env add LEADERSHIP_UPDATE_EMAIL production --value "a@x.com,b@x.com" --no-sensitive --yes
```

CLI 54 defaults new Production variables to **sensitive**, and a sensitive value pulls back EMPTY —
so it cannot be verified afterwards, and a silently-empty recipient list means nobody gets the
report. The first attempt on 2026-08-21 stored `""` exactly this way. Always confirm with
`vercel env pull` and read the value back.

### ⚠️ CHANGELOG.md ordering is load-bearing

`entriesForPeriod()` walks newest-first and **breaks on the first entry older than the period
start**, so one out-of-order entry silently truncates a report. Audited 2026-08-21: four entries are
out of order at positions 86–137 (late July / early August). Harmless for the Mon/Wed/Fri runs, which
only ever reach back two or three days — but a manual `?edition=` covering those weeks will
truncate. Fix the ordering before trusting a rebuild of that period.


## 🔴 Deploying near a cron's scheduled time makes that run vanish

Measured 2026-08-21. No error, no log, no trace — indistinguishable from the job never having
been scheduled at all.

| Cron due (UTC) | Nearest production deploy | Result |
|---|---|---|
| 13:00 reminders | none nearby | ✅ ran 13:27 |
| 20:30 digest | 20:24:48 — 6 min before | ❌ missed |
| 21:30 digest | 21:31:43 — on top of it | ❌ missed |
| 22:00 leadership | 21:57:56 — still building at 22:00 | ❌ missed |
| 23:00 leadership | idle | ❌ missed |

**Ten production deploys between 20:09 and 23:21 UTC** that evening. The control is clean:
Saturday and Sunday had **zero** deploys and **all three** cron paths ran on **both** days.

⛔ **It is NOT the plan limit.** That was the first hypothesis — the team is on `hobby` with 7
crons defined — and it is **disproven**: three distinct cron paths ran on the same day, twice,
over that weekend, and all 7 report `"enabled": true` under
`vercel crons ls --format json`. Do not re-open that theory.

**So:** when a scheduled job matters that day, stop deploying around it. But measure that window
from when the job **actually runs**, not from its schedule — see immediately below.

### 🔴 Crons fire 30–55 minutes LATE, so the naive exclusion window guards the wrong time

Measured 2026-08-24 from the reminder stamps (`tickets` / `rfq_requests` →
`assignee_nudged_at`, `unclaimed_reminded_at`, `escalated_at`). Those stamps are the only durable
record of when a cron truly executed — Vercel's runtime logs on this project return nothing.

| Nominal (UTC) | Actually ran | Lag |
|---|---|---|
| 2026-08-22 13:00 | 13:47:58 / 13:53:23 | **47 / 53 min** |
| 2026-08-23 13:00 | 13:47:58 / 13:53:23 | **47 / 53 min** |
| 2026-08-21 13:00 | 13:27 | 27 min |

The 09:00 ET reminders therefore really execute around **09:47 ET**. Someone who dutifully avoids
08:40–09:20 and then ships at 09:30 lands directly on the run — which is exactly the mistake the
rule above was written to prevent.

**Compute the exclusion from nominal + 30..55 minutes.** In ET that means roughly:

| Job | Nominal | Do not deploy |
|---|---|---|
| reminders (daily) | 09:00 | **09:25 – 10:10** |
| accrue-pto (Mon) | 09:00 | **09:25 – 10:10** |
| digest (daily) | 16:30 | **16:55 – 17:40** |
| leadership (Mon/Wed/Fri) | 18:00 | **18:25 – 19:10** |

⚠️ The lag is stable but not constant (27 min on 08-21 against 47 on 08-22/23), so treat it as a
band, not an offset to subtract.

This is also why `withinSendWindow` on the leadership job is a two-hour band (18:00–20:00) rather
than an hour: nominal 18:00 ET really lands near 18:47 ET, and an hour-wide check would have been
uncomfortably close to its own edge.

**And when a cron "fails", check the deploy timeline FIRST** — before the route, the guard or
the secret. On 2026-08-21 an entire evening went into the route before anyone looked at the
deployments.

### Why this was so hard to diagnose, and what now makes it easy

- **Vercel runtime logs are useless on this project.** Twelve hours of them were empty while
  functions were demonstrably running and sending mail.
- **`CRON_SECRET` pulls empty**, so the route cannot be invoked by hand to test it.
- **`leadership_last_invocation`** in `app_settings` now records every invocation and every
  early-exit reason (`invoked` / `bad-period` / `skipped-window` / `skipped-already-sent`). A
  missing row means the route was never called; a row means it was called and says what it did.
  That one query separates "cron never fired" from "cron fired and declined".

### Triggering a cron by hand

```bash
npx vercel crons run /api/cron/leadership-update
```

Vercel supplies the `Authorization` header itself, so this works **without** `CRON_SECRET`.
⚠️ It triggers the path as configured — it cannot pass query parameters, so it always runs the
job's default behavior. To send a specific past range you still need the `?from=&to=` form,
which means either the secret or a temporary dated entry in `vercel.json` (see the 2026-08-19
one-off for the worked example).


## The escalation ladder

Three steps, each existing because the one before it can fail:

1. **Desk sweep** → the shared mailbox. *A mailbox can go unread.*
2. **Owner nudge** → the person holding it. *Requires someone to be holding it.*
3. **Leadership escalation** → Kacy and Crystal, by name.

Step 3 fires precisely when neither of the first two can help: an unassigned row
has nobody to nudge, and the desk has already been told once. It covers **tickets
and quote requests in one email**, because they need the same decision — hand it
to a person — and two emails minutes apart would be merged by hand anyway.

**Individual sends, not a shared `To:` line.** A message addressed to two people
is a message addressed to nobody; each assumes the other has it, which is the
exact failure this email exists to break. Override the pair with
`LEADERSHIP_ESCALATION_EMAIL` (comma-separated) — a name changing must not need
a commit.

**Repeat cadence: 48 hours.** Assigning an owner stops everything for that row.
Nothing can go permanently quiet, and nothing arrives daily.

## Idempotency — why timestamps, not flags

Every sweep is a cron re-running against the same rows, so *"have we already
chased this one?"* has to survive between invocations. One column per reminder
kind, stamped when mail goes out and checked before the next send:

| Column | Table | Set by |
|---|---|---|
| `assigned_at` | `tickets`, `rfq_requests` | The moment an owner is set |
| `assignee_nudged_at` | both | The owner nudge |
| `unclaimed_reminded_at` | both | The desk reminder |
| `escalated_at` | both | The leadership escalation |

**Deliberately not stamped when a send throws**, so a failure is retried on the
next run rather than silently swallowed. An in-memory flag would not outlive a
serverless invocation.

## Closing a ticket

Both terminal states — **Resolved** and **Closed** — require closing notes from
the employee, at least 10 characters, enforced in the UI *and* in the server
action. Those notes are written to the ticket thread as a public note and emailed
to the customer word for word.

The resolution-reason dropdown does not satisfy this. It is fifteen fixed phrases
chosen for reporting, and *"Replacement part installed"* tells the person whose
machine broke nothing about their machine.

**A customer marking their own ticket resolved does not close it.** They must say
what changed (same 10-character floor), it lands on the thread, and the desk is
emailed to go and verify. "It seems fine now" and "the fault is gone" are
different claims; only the second belongs in the record.

⚠️ The bridge endpoint `/api/bridge/ticket-resolve` — used by the separate
`iat-customer` app — takes the note as **optional**, because enforcing a field
that app's UI does not send would break marking-resolved there rather than
improving it. It does send the desk alert. Add `note` to that app's request
first, then tighten the endpoint; in that order.

## Cron auth — fail closed, always

Every cron route guards with `if (!CRON_SECRET || auth !== ...)`. **Never relax
this to `if (SECRET && ...)`** — that form skips the check entirely when the
variable is unset, and an anonymous GET has already run a sweep and sent real
mail once because of it.

`CRON_SECRET` was itself unset in production until 2026-08-17, which meant every
scheduled job had been 401ing since it was built. Verify from the outside after
touching any of this: anonymous → 401, wrong secret → 401, correct secret → 200.
