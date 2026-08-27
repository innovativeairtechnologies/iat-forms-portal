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
| 18 | Daily admin digest | Admin roster, minus `DIGEST_OPT_OUT_DEFAULT` | Daily **18:00 ET**, lands ~18:00–19:00 |
| 19 | Leadership update | `LEADERSHIP_UPDATE_EMAIL` → Lee, Kacy, Crystal | **Mon/Wed/Fri 20:30 ET**, lands ~20:30–21:30 |
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

⚠️ **Every time below is the OLD 4:30pm ET schedule this bug happened under.** The digest moved to
**6:00pm ET** on 2026-08-25 and `withinDigestWindow()` widened with it — see "Both scheduled mails
moved out of the daily deploy window" for the current times. The reasoning here still holds; the
numbers are history.

`digest_runs` held **zero rows from the day migration 038 created it**. The missing
`CRON_SECRET` found on 2026-08-17 was real but was not the whole cause — fixing it
only moved the failure somewhere quieter.

**Vercel fires crons on this project tens of minutes late — 33 to 42 on the measurements that
can actually be attributed.** From Resend send timestamps: 13:00→13:41 (41 min), 21:30→22:03
(33 min), 22:00→22:42 (42 min).

⚠️ This line used to read "14 to 63 minutes" and cited a fourth measurement, "the digest itself at
20:30→21:33". **Both ends of that range were unsupported by the very list beneath it** — the four
figures are 41, 33, 42 and 63, so nothing is near 14 — and the 63 is the 2026-08-20 `digest_runs`
row, which is **ambiguous**: `admin-digest` has entries at BOTH 20:30 and 21:30 UTC, so 21:33:53Z
is either the first running 63 min late or the second running 3.9 min late. It was then requoted
twice more in this file as if it were established. Corrected 2026-08-24. Do not reintroduce a
bound; see "How late, honestly" below. `isDigestTime()` accepted a **ten-minute** window (16:25–16:34 NY)
against an entry scheduled for 16:30 exactly, so every invocation arrived after it
had closed.

⚠️ **Widening to `hour === 16` is NOT enough.** The entry runs at :30 past, so any
delay over thirty minutes crosses into 17:xx. The weekly leadership report survives
on a bare hour check only because it is scheduled at :00, so its whole delay budget
fits inside one hour.

**What shipped:** correctness rests on `digest_runs`' unique index on `run_date` —
the first invocation of the NY day claims it, later ones no-op — with
`withinDigestWindow()` kept only as a sanity bound so a wildly misfired run cannot mail
everyone at 3am. ⚠️ It was `hour >= 16 && hour <= 18` when this was written; it is now
**`hour >= 18 && hour <= 20`** (`lib/admin-digest.ts`).

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

**First successful send: 2026-08-20, 3 recipients.** It landed at 21:33:53Z = **17:33 NY**, i.e.
in hour 17 — so `hour === 16` would have missed again.

⚠️ That conclusion is **independent of the lag dispute**: 21:33:53Z is hour 17 whether it was the
20:30 entry 63 minutes late or the 21:30 entry 3.9 minutes late. The window widening is sound; only
the "63 minutes" attribution was ever in question.

⚠️ Vercel's runtime logs are useless for confirming a cron ran here: wide queries time
out, historical ones return `ExceedsBillingLimitError`, and cron invocations did not
appear even when they demonstrably ran. Check the side effects instead — `digest_runs`
and the Resend send list.

**Editions** name the reporting periods. An edition is one Monday-to-Sunday work week named
after its Monday (`lib/edition.ts`) — **Edition 8.17.26** is 17–23 August.

⚠️ **The leadership update is no longer weekly.** It runs Monday, Wednesday and Friday, and each
run covers only the days since the previous one, so no scheduled send maps to a whole edition any
more. Editions still name and address the history: rebuild any past week by hand with
`?edition=8.17.26` (or `2026-08-17`) — any date inside it resolves to that week's Monday.

---

## The two scheduled reports, and which is which (2026-08-21)

They are often confused, so: **one is an email, one is a document.**

| | Daily admin digest | Leadership update |
|---|---|---|
| Format | HTML email | Word document, attached |
| When | **every day**, 6:00pm ET | **Mon / Wed / Fri**, 8:30pm ET |
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
Crons here run **tens of minutes late, and the upper bound is not established** (see "How late,
honestly"), so a 6pm entry arriving well into the next hour would have silently sent nothing — the identical failure that stopped the daily digest sending for months. The window is now
**20:00–22:00** (it was 18:00–20:00 until the 2026-08-25 move), and `leadership_last_sent` in
`app_settings` claims the NY day so a wide window cannot send several copies.

DST is handled by window + claim rather than by one entry being wrong for the season. There are
now **three** entries at 00:30 / 01:30 / 02:30 UTC — the season table lives in "Both scheduled mails
moved out of the daily deploy window" below, and is the only copy, so it cannot drift from this one.

⚠️ The claim is read-then-write, not an atomic upsert on a unique index. The entries sit an hour
apart, so the race needs a 60-minute delay landing on the exact second of the other run. A real
`leadership_runs` table with a UNIQUE index on the date is the correct fix once migrations are
available (the Supabase CLI was unauthorized on 2026-08-21 and DDL cannot go through PostgREST).

### 🔴 The report's shape is enforced by the API, not asked for in the prompt (2026-08-27)

Both halves of the report used to request JSON in the system prompt and parse the reply with a
regex + `JSON.parse`. **That shipped a Part-1-only report twice** — 2026-08-19 and 2026-08-26 — and
neither time did anything alarm: the only outward tell is one clause in the covering email, emitted
only when `update.technical.length > 0`.

⚠️ **The 2026-08-26 log entry was wrong, and that is the lesson worth keeping.** `parseSections`
returned null, `stop_reason` was not `max_tokens`, and the code therefore printed **"bad escaping"** —
a guess presented as a diagnosis. Reproduced against that evening's changelog, the model had actually
returned **`stop_reason: 'refusal'`** and no JSON whatsoever. `repairPrompt()` then instructed it to
fix unescaped double quotes, so the retry addressed a fault that did not exist and failed identically.

**Measured, both directions, same input (18 entries, 25–26 August):**

| path | result |
|---|---|
| shipped hand-rolled JSON | `stop_reason: refusal`, no JSON — **twice** |
| `messages.parse` + schema | parsed cleanly — **twice** (51 and 39 lines) |

Full pipeline after the change, current content: **Part 2 present on four consecutive builds.**

`askForSections()` in `lib/leadership-update.ts` is now the single call path for both halves:
`anthropic.messages.parse(...)` with `output_config: { format: jsonSchemaOutputFormat(SECTIONS_SCHEMA) }`.

- ⚠️ **`jsonSchemaOutputFormat`, not `zodOutputFormat`.** This project is on `zod ^3.23`; the SDK's
  zod helper reads Zod v4 internals and throws `Cannot read properties of undefined (reading 'def')`.
  Raw JSON Schema has no version coupling and needs no new dependency.
- ⚠️ **Never retry a refusal.** `SectionsReply.reason` distinguishes `refusal` / `truncated` /
  `unparseable` from the actual `stop_reason` rather than inferring it. A refusal breaks out
  immediately — talking to it again only spends a second call to be refused again.
- The "Return ONLY this JSON" and "NEVER put a double quote inside a line" instructions are **gone**
  from both prompts. The schema makes them redundant, and the second one was aiming the model at the
  wrong fault.
- The technical prompt now **forbids Markdown** — the Word renderer does not interpret it, so
  `**bold**` and backticks were printing literally on the page.

### Coverage, models and the time budget (2026-08-27, same day as the fix above)

Restoring Part 2 exposed the next fault: it wrote about the largest change and dropped the rest. One
run gave **one section, eight lines**, about a single feature, with no closing section.

**Both a brief and a check, because the brief alone does not hold.** `TECHNICAL_SYSTEM` now demands
every input heading be represented and makes the final OPEN/GAPS section mandatory;
`technicalShortfalls()` then verifies section count, line count, the closing title, and lines-vs-entries,
and sends it back **once** with the specific shortfall quoted — the same shape as `offenders()` on the
leadership half. Same input, after: **7 sections / 49 lines, closing OPEN.**

🔴 **The two halves use different models, and that is deliberate.**

| half | model | why |
|---|---|---|
| leadership | `claude-sonnet-4-5` | never refused; fast; unchanged |
| technical | `claude-opus-5` | Sonnet 4.5 **refuses this changelog** |

Measured: the 25–26 Aug window returned `stop_reason: 'refusal'` twice; the 26–27 Aug window was
stopped **mid-JSON at 368 output tokens** against a 16000 ceiling. Same prompt and input on Opus 5 —
`end_turn`, clean parse, every time.

⚠️ **`messages.create` + `output_config.format`, NOT `messages.parse`.** `parse()` throws on a body
it cannot read and the throw carries no `stop_reason`, so a mid-stream refusal is indistinguishable
from truncation — it surfaces as "Unterminated string in JSON at position …", which reads exactly
like running out of tokens. Reading `stop_reason` ourselves is the only way to tell them apart, and
they need opposite handling.

⛔ **Do not set `effort: 'low'`.** Tried, to reclaim the thinking tokens that count against
`max_tokens`. The leadership half returned a well-formed skeleton with **every `items` array empty**.
It parses, so it fails the quiet way. `SectionsReply.reason` now has `empty` as its own value —
parsed-but-useless is not the same fault as unreadable.

⚠️ **`maxDuration` is 300, and it is required.** A 24-entry window measures **113.7s** end to end
(both halves + the Word render). The old ceiling was **60**, which would have killed the run
mid-flight. 300 is already proven on this plan by `/api/cron/kb-sharepoint-sync`. Re-measure before
lowering it — the worst case is a wide window with a retry on each half, not the 114s above.

⚠️ **`max_tokens` 4000 / 8000, and going higher needs streaming.** At 32000 the SDK refuses a
non-streaming request outright — "Streaming is required for operations that may take longer than 10
minutes" — before generating a token. Raise these and you must switch to `.stream().finalMessage()`.

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


## 🔴 Both scheduled mails moved out of the daily deploy window (2026-08-25)

Work on the portals runs **8:00am to 5:30pm ET**, every day, most of it ending in a 4:30–5:30pm
push. The digest was nominally
4:30pm — scheduled into its own worst hour. Moved:

| Job | Was (ET) | Now (ET) | Backstops (ET) |
|---|---|---|---|
| Admin digest | 4:30pm | **6:00pm** | 7:00pm, and 8:00pm in summer |
| Leadership (Mon/Wed/Fri) | 6:00pm → 6:30pm | **8:30pm** | 9:30pm, and 10:30pm in summer |

Both land in the inbox for a next-morning read, which is what they are for.

### 🔴 The November gap this also closes

**A DST pair gives a backstop in summer and NONE in winter.** The pairs were built so the *right*
entry fires in each season — the earlier one falls outside the window and is skipped — which means
in winter only ONE entry can ever send. One lost invocation between November and March meant no
digest and no leadership report at all, and the claim-release logic had nothing to release to.

Both jobs now register **three** entries so both seasons keep a backstop:

| | 22:00Z | 23:00Z | 00:00Z |
|---|---|---|---|
| Digest EDT | 6:00pm **claims** | 7:00pm backstop | 8:00pm backstop |
| Digest EST | 5:00pm skipped | 6:00pm **claims** | 7:00pm backstop |

| | 00:30Z | 01:30Z | 02:30Z |
|---|---|---|---|
| Leadership EDT | 8:30pm **claims** | 9:30pm backstop | 10:30pm backstop |
| Leadership EST | 7:30pm skipped | 8:30pm **claims** | 9:30pm backstop |

⚠️ **Leadership's cron days are `2,4,6` (Tue/Thu/Sat), not `1,3,5`, and that is correct.** 8:30pm ET
is past midnight UTC, so a Monday-evening send is Tuesday in UTC. The route reads
`getNyWallClock()` and `scheduledSpan()` derives the weekday from the NY date, so it still resolves
to Monday. **Move the hour and the day-of-week may have to move with it.**

⚠️ **Leadership is at :30 past deliberately.** The digest's third entry is 00:00Z = 8:00pm EDT.
`admin-digest` runs the RFQ reminder **sweep before its window and claim guards**, so an invocation
that skips the digest still sends mail — two mailing jobs must not share a UTC minute.

### The reminders moved to 3:00am for the same reason (2026-08-25)

The working day starts at **8:00am**, and the first push of the morning used to land right on top
of where `rfq-reminders` and `ticket-reminders` sat — and `ticket-reminders` had no backstop of any
kind, so a morning
deploy lost that day's nudges outright. Both now run at **3:00am ET**, which also puts the mail in
that day's inbox rather than at the bottom of yesterday's.

| | 07:00Z | 08:00Z |
|---|---|---|
| EDT | **3:00am** | 4:00am |
| EST | 2:00am | **3:00am** |

⚠️ **Two entries here, not three, and no window guard — that is not an oversight.** These jobs have
no day-claim: idempotency is per ROW, via the `assignee_nudged_at` / `unclaimed_reminded_at` /
`escalated_at` stamps from migration 090, which are written only on a successful send. A repeat run
is therefore a no-op on anything already chased, so **both entries are live in both seasons** and
each is the other's backstop. The digest needs three entries precisely because its window
deliberately excludes one per season; nothing is excluded here.

⚠️ In EST the first entry lands at 2:00am, so winter mail goes an hour earlier than summer.
Deliberate — still early-AM of the correct ET day, and forcing exactly 3:00am would mean adding
window machinery to a job whose idempotency already makes it unnecessary.

`accrue-pto` (Mon, 08:00Z) still has a single entry, and now shares that minute with the
reminders' second entry on Mondays. Harmless: it sends no mail, and the reminders' 08:00 run is
normally a no-op.

⚠️ **What these reminders do NOT cover.** They chase things that have gone **stale** — a ticket
assigned with no note in 24h, or one nobody has claimed — not everything that is assigned. And
"assigned" across this database means four tables, of which only two are swept:

| Table | Column | Chased? |
|---|---|---|
| `tickets` | `owner_id` | ✅ |
| `rfq_requests` | `assignee_id` | ✅ |
| `eng_tasks` | `assignee_id` | ✅ (2026-08-26) |
| `deals` | `assigned_to` | ❌ |
| `production_tasks` | `assignee` | ❌ |

### Engineering joined the 3:00am pair (2026-08-26)

`/api/cron/eng-reminders`, same two entries (07:00Z + 08:00Z) and the same reasoning: idempotency is
per ROW via `eng_tasks.nudged_at` (migration 096), written only on a successful send, so a repeat run
is a no-op and each entry backstops the other. No window guard, for the same reason.

It differs from the other two in one way worth knowing: it chases work that is **approaching** a due
date, not only work that has gone stale. Anything due within the playbook's `nudgeLeadDays` (default
2, editable at `/admin/engineering/playbook`) is included, grouped so a person with six things due
gets one email rather than six.

**The lead roll-up sends NOTHING when there is nothing outstanding.** A daily all-clear teaches
people to filter the sender, and then the one that matters is filtered too.

⚠️ **Recipients:** `ENGINEERING_NOTIFICATION_EMAIL` (comma-separated) if set, otherwise everyone
whose profile role is literally `engineering`. Deliberately not "everyone holding `engineering_jobs`"
— that includes every admin and every production manager. If neither resolves, nothing is sent and
the cron log says so in `result.skipped` rather than the sweep guessing at an audience.

⚠️ Sends are **sequential**, 600ms apart (`sendAll` in `lib/resend-engineering.ts`). Resend's limit
is 2/sec, and a `Promise.all` fan-out against it once reached only some of three recipients while
reporting success.

## 🔴 Deploying near a job's scheduled time makes that run vanish

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

### 🔴 Crons fire LATE, so the exclusion window starts at the NOMINAL time

⚠️ **An earlier version of this section (written the morning of 2026-08-24) gave a table saying the
window opens at nominal + 25 minutes. That was wrong, and it caused a real bad decision the same
afternoon** — a deploy went out at 16:50 ET on the reasoning that the 16:30 digest "really runs at
16:57, so there is margin". Do not reintroduce a rule that opens the window after the nominal time.

**The window opens at NOMINAL and stays open for at least an hour.** Promoting a production
deployment re-registers the project's jobs, so a run that has not fired yet when the new deployment
goes live is at risk regardless of how far past its nominal time it is.

⚠️ **And the risk starts BEFORE nominal too.** In the table above, a deploy **six minutes ahead of**
a job's scheduled time killed it. There is no measurement establishing how much earlier is far
enough, so do not compute a safe margin — see the rule below.

### 🔴 The rule: nothing goes to production outside 8:00am – 5:30pm ET

Work on the portals happens **8:00am to 5:30pm Eastern**. Every job was deliberately moved outside
that window — the two reminder sweeps into the early morning, the digest and the leadership update
into the evening — precisely so the two never meet.

**So the only rule anyone has to follow is: do not promote a production deployment before 8:00am or
after 5:30pm.** No arithmetic, no per-job boundaries. The table below is the derivation, not the
instruction — a boundary table is what produced the bad 16:50 deploy, when someone reasoned from it
that there was margin.

⚠️ **The digest has the tightest margin in the system, and it is not proven safe.** Work stops at
5:30pm; the digest is nominally 6:00pm. Thirty minutes — against a measured kill six minutes ahead
of nominal, with no evidence about anything in between. What actually protects it is its
**backstops at 7:00pm and 8:00pm**: a deploy that slips to 5:45pm costs an hour, not the day,
provided you then stop. The leadership update at 8:30pm has three hours of clearance; the early
morning jobs have four.

⚠️ **A deploy is not the only way a run vanishes.** The 2026-08-21 table above has one miss with no
deploy anywhere near it. An untouched evening is not proof the job ran — check the side effects.

| Job | Nominal (ET) | Do not deploy |
|---|---|---|
| reminders (daily) | 03:00 | **03:00 – 05:00** |
| accrue-pto (Mon) | 04:00 | **04:00 – 06:00** (already inside the reminders window) |
| digest (daily) | 18:00 | **18:00 – 20:00** |
| leadership (Mon/Wed/Fri) | 20:30 | **20:30 – 22:30** |

#### How late, honestly

**The evidence is thin — two clean observations per job.** Say that out loud rather than quoting a
bound; three sessions spent an hour on 2026-08-24 reasoning from numbers that turned out to be
artifacts.

Single-entry crons are the only clean sample, because their `sent_at` can be attributed to one
schedule entry. From the reminder stamps (`assignee_nudged_at`, `unclaimed_reminded_at`,
`escalated_at` — the only durable record, since runtime logs on this project return nothing):

| Nominal (UTC) | Ran | Lag |
|---|---|---|
| 2026-08-22 13:00 | 13:47:58 / 13:53:23 | 47 / 53 min |
| 2026-08-23 13:00 | 13:47:58 / 13:53:23 | 47 / 53 min |

So: **wide, variable, and barely measured.** Everything that can actually be attributed:

| Source | Lag |
|---|---|
| **Leadership breadcrumb, 2026-08-24 (cleanest datapoint we have)** | **17m 47s** |
| Resend timestamps, three unambiguous jobs (08-20) | 33-42 min |
| Reminder stamps, single-entry crons (08-22, 08-23) | 47-53 min |
| Everything else | ambiguous or absent |

⚠️ **The 17m47s reading disproves the 33-minute floor** this table asserted earlier the same day.
`leadership_last_invocation` stamped `at 2026-08-24T22:17:47.666Z` against a 22:00:00Z entry, and it
is unambiguous — the paired 23:00Z entry had not fired. It is also the only measurement here taken
from a breadcrumb the route writes about ITSELF, rather than inferred from a side effect, which
makes it the most trustworthy of the three sources.

So the original "14 to 63" was **not** invented at the low end after all; something near it was
probably real. The honest span across everything measured is roughly **18 to 53 minutes**, with the
top end disputed. Still: do not quote a bound.

**Do not quote a bound in either direction.** "Anywhere up to about an hour" is as far as this data
goes. In particular there is no evidence for a 14-minute lower bound anywhere in this file, and the
only measurement above 53 minutes is the ambiguous 08-20 digest row.

#### ⚠️ Two traps that produced wrong numbers on 2026-08-24

**1. `admin-digest` has TWO entries (20:30 and 21:30 UTC), so `sent_at` cannot be attributed to a
schedule entry without care.** `digest_runs` for 08-20 shows 21:33:53Z. Read as the 20:30 entry
that is a 63-minute lag; read as the 21:30 entry it is 3.9 minutes. **Both are possible and this one
is genuinely unresolved** — the section above ("The digest had never sent") independently measured
14-63 minute lags on 2026-08-20 from Resend timestamps across four different jobs, so a 63-minute
lag on this project is entirely plausible.

The point is not which reading wins. It is that a two-entry job cannot be used as lag evidence at
all, because the datapoint is ambiguous by construction. Use the single-entry crons for that.

**2. "It has not run yet" is not evidence that it was eaten.** Late and lost look identical until
the full delay budget has passed. On 08-24 an absent `digest_runs` row at 21:24 was diagnosed as
"the deploy ate it" — by two separate sessions — with no evidence beyond the row being missing.
Wait out the budget before concluding anything.

⚠️ **Triggering a job by hand claims the day.** `vercel crons run /api/cron/admin-digest` at 21:25
on 08-24 wrote the `digest_runs` row 4 seconds later, which means any later natural invocation
no-ops — and whether the 20:30 entry would have arrived became permanently unanswerable. Recovering
a run by hand is right when the day's mail matters, but it destroys the evidence. Decide which you
want first.

### ⚠️ Why the leadership update stopped arriving (2026-08-25)

**It was three PARALLEL sends against Resend's rate limit — not the domain, not the recipients,
not a collision with the digest.** `lib/resend-leadership.ts` was the only sender in the codebase
doing `Promise.all(recipients.map(...))`, and the only one carrying an attachment: three
simultaneous requests, each with a base64 .docx, against Resend's documented **2 requests per
second** default.

The differential is what proves it. On 2026-08-24 the admin digest arrived and the leadership
update did not, and the two are near-identical:

| | Digest (arrived) | Leadership (did not) |
|---|---|---|
| Sender | `noreply@portal.dehumidifiers.com` | **identical** |
| Recipients | Crystal, Kacy, Lee | **the same three** |
| Send pattern | `for … await` — one at a time | **`Promise.all` — three at once** |
| Attachment | none | **.docx** |

Same sender to the same mailboxes on the same day rules out the Proofpoint/SPF/domain-spoofing
family — those would have killed both. The changelog also carried none of the Exchange
"Block Bulk / Sales Emails" trigger phrases.

🔴 **A partial rate-limit failure was SILENT.** The function only threw when *every* send failed,
so one success and two 429s returned "ok" and two people simply never got the report — which is
why it had "worked before" and then intermittently did not. Fixed by sending sequentially (the
digest has always looped with `await` and has always arrived) and by returning `failed` alongside
`sent` so a partial failure is recorded.

🔴 **`leadership_last_sent` is a CLAIM marker, not a send marker.** It is written by `claimDay()`
*before* anything is sent, so it proves only that a run started. Two people read it as proof of
delivery on 2026-08-24, including me. Worse, a failure after the claim burned the day *and*
disarmed the paired second entry — the 19:13 ET run stood down with `skipped-already-sent` for a
send that may never have happened. `releaseDay()` now puts the claim back when nothing went out,
matching what the admin digest has always done, and the send path is stamped (`sent` /
`sent-partial` / `failed`) so the outcome is answerable afterwards.

Moved to **18:30 ET** the same day at the owner's request, to keep clear air between this and the
digest. ⚠️ **Superseded on 2026-08-25** — it is now 8:30pm ET, and the digest 6:00pm, so the nominal
times sit two and a half hours apart against a worst observed lateness of ~55 min.

This is also why `withinSendWindow` on the leadership job is a two-hour band (**20:00–22:00**)
rather than an hour: nominal 20:30 ET can land near 21:20, and an hour-wide check would sit
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

Five steps, each existing because the one before it can fail:

1. **Desk sweep** → the shared mailbox. *A mailbox can go unread.*
2. **Owner nudge** → the person holding it. *Requires someone to be holding it,
   and requires them to read it.*
3. **Admin escalation, unassigned** → Kacy, Crystal and Lee, by name.
4. **Admin escalation, stalled ticket** → the same three, same email.
5. **Admin escalation, stalled quote** → the same email again, **plus sales**.

Steps 4 and 5 were added 2026-08-24. Before them the escalation only ever covered
work **nobody had picked up**. Anything with a name against it produced an owner
nudge and nothing else — read or not. At the time of the change there were **zero**
unassigned tickets and **six stalled ones, four quiet for a full week**, so the admin
email had been sending nothing at all while a week of work sat untouched.

**One email, not three.** An admin asking "is anything being dropped?" should read one
list. Sorted unassigned first (no name against it), then stalled; tickets before quotes.

### Who gets it

| | Recipients |
|---|---|
| Any escalation | The three admins — `LEADERSHIP_ESCALATION_EMAIL`, defaults to Kacy, Crystal, Lee |
| **Containing a quote request** | The above **plus sales** — `SALES_ESCALATION_EMAIL`, defaults to Mike Payton and Jacob Reagan |

Sales are added **only when the email actually carries a quote request**. A rep copied
on ticket-only mail learns to skim past it, and the one time it does concern them is the
time they will not read it.

⚠️ `jacob@dehumidifiers.com` is **Jacob Reagan** (Inside Sales Engineer).
`jacob.younker@dehumidifiers.com` is a different person. The roster holds several Jacobs
and they must never be conflated — see the employees-table note in the project memory.

⚠️ Steps 4 and 5 also close a real hole. Sweep 1 needs an **active roster row** to reach
anybody, and steps 1–3 skip any row that has an owner. So work assigned to someone who
has since left was chased by **nobody at all**. Steps 4 and 5 do not depend on the owner
being reachable — those rows appear reading *"with an owner who has no active account"*.

**Individual sends, not a shared `To:` line.** A message addressed to five people is a
message addressed to nobody; each assumes another has it, which is the exact failure this
email exists to break.

### What stops each one

| Row | Stops when |
|---|---|
| Unassigned ticket or quote | An owner is assigned |
| Stalled ticket | **A note is written** — "waiting on parts" counts. A status change does **not** |
| Stalled quote | Status moves off `new` — one click onto Reviewing says a human has it |

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
| `escalated_at` | both | The admin escalation — unassigned **and** stalled. Safe to share: a ticket cannot be both at once, and the column means the same thing either way (leadership was told at time T) |

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
