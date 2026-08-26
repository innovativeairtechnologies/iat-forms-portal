# Engineering (`/admin/engineering`)

_Shipped 2026-08-26. Requires migrations `096_engineering.sql` and `097_engineering_upsert_index.sql`._

Replaces two monday.com boards (**Submittals**, **LLI**) and the **Engineering Lead-Times**
workbook with one place engineering works out of and leadership reports on.

## Where the design came from

Three sources, and they agree with each other:

| Source | What it settled |
|---|---|
| Engineering meeting, 2026-08-25 (Plaud transcript) | The five buckets, the sub-task breakdown, and that the point is accountability rather than another tracker |
| The whiteboard photo from that meeting | The "Status Box" layout — job #, assignee, due date, ahead/behind with a day count — and the progress-bar mechanic |
| `Engineering Lead-Times.xlsx` | Target hours, cycle times and priorities per task. The **Elec** sheet additionally publishes completion percentages, which is what makes the progress bar mean something |
| The two monday boards | The eight sub-tasks a submittal actually breaks into, read off completed jobs, plus the Complexity column |

The four **highlighted** rows on the Mech sheet were the stated priority and are the four the
seeded playbook leads with:

| Task | Average Lead-Time | Cycle Time | Priority |
|---|---|---|---|
| Production Packages | See Master | Per Smartsheet | 1 |
| Long-Lead Items | 1 hour | 1 week | 2 |
| Submittal Package Creation | 2 hours | 2 weeks | 3 |
| Unit Outline | 4 hours | 2 days | 4 |

## 🔴 The honest-numbers rule

**A number no source gives is `null`, and prints as "Not set".** The workbook says "TBD", "-",
"See Master", "Per Smartsheet" and "Must be scheduled" in a lot of cells, and the BOM and Production
breakdowns exist as words in the meeting notes with no hours at all. Those are seeded as null and
their playbook steps carry `provisional: true`, which renders an amber **Unconfirmed** chip.

This is not fussiness. A plausible-looking invented estimate becomes the baseline every future
variance is measured against, and nobody ever finds out it was made up. The same rule runs through
the whole section:

- Capacity never treats a null target as a zero — uncosted tasks are counted separately, and every
  hours figure is shown next to the share of work it could actually see.
- The report prints its **hours coverage** next to every hours median.
- A task with **no due date is excluded** from on-time percentages, never scored as on time —
  otherwise the cheapest way to improve the number would be to stop setting dates.

The meeting's own follow-up list asked for exactly this session: *"specific formulas, dependencies,
and timelines for each task were not defined."* `/admin/engineering/playbook` is where that lands.

## Access

**The `engineering_jobs` perm.** Named that, not `engineering`: `engineering` is already a
`StaffRole`, and a perm sharing the name would read as "the engineering role's perm" — the same
collision `production_board`, `tool_crib` and `marketing_calendar` are named around.

Seeded by 096 for **`engineering`** and **`production_manager`**. The second is deliberate and was
asked for in the meeting ("alert the ordering department as soon as a Bill of Materials is
released"); ordering is not a role, and production_manager sits closest to it.

**Sales is not seeded.** Sales generates engineering work — the workbook's "Sales Support" row is
20% of a mechanical engineer's Monday-to-Wednesday — and a queue the requesters can also
re-prioritise is not an accountability tool. Grant it per person from `/admin/permissions`.

**Editing the playbook needs more.** `requireEngineeringAuth({ playbook: true })` requires `admin`
or the `engineering` role — the same shape as SOO approval. A production manager works the board
daily and can *see* the standard, but changing what every future job is measured against is a
department-lead decision. The page renders read-only for them rather than offering a Save that 403s.

**The report is narrower still.** `/admin/reports/engineering` is gated on `reports`, which is
admin-only by omission. It scores named people on on-time delivery; that is a tighter trust boundary
than the working board.

`ADMIN_PATH_PERMS` maps `/admin/engineering` → `engineering_jobs`, and every page re-checks. An
unmapped `/admin/*` path falls back to `dashboard`, which every scoped role holds, so the second
check is what makes a future matcher edit fail closed instead of showing the whole department's
per-person workload to HR and marketing.

## The buckets

`Stream` in `lib/engineering.ts`, in whiteboard order:

| Key | Label | Notes |
|---|---|---|
| `submittal` | Submittals | 8 steps, from a completed monday job |
| `long_lead` | Long-Lead Items | Both workbook rows verbatim |
| `bom` | Bill of Materials | Mechanical only — see below |
| `production` | Production / Design | Mostly unconfirmed; the workbook defers to a master schedule |
| `electrical` | Electrical Production | The Elec sheet, complete and unaltered |
| `support` | Support & Other | Every un-highlighted workbook row |

⚠️ **The electrical BOM lives in the `electrical` stream, not `bom`.** That is where the Elec sheet
costs it (1 hr) and bands it (60%); carrying it in both places would double-count an hour into every
capacity forecast. The BOM tile on the status board is a **union** — `bom` plus the electrical
stream's `elec_bom` step — so "alert ordering when the BOM is released" still sees both halves in
one place. One documented join in `lib/eng-data.ts` (`tileMembership`).

⚠️ **`support` is not a leftovers bin.** It is the answer to "somebody worked 60 hours and finished
nothing" — the 20% of Monday-to-Wednesday the workbook already allocates to work that is not a
production package. `job_id` is nullable precisely for it, and `AddSupportTask` is one line and four
fields because a form any longer than that does not get filled in.

## The progress bar and the ahead/behind figure

The Elec sheet is the only source that publishes completion percentages: Drawings (incl sub) **30%**,
BOM **60%**, Programming **99%**, and a cell comment on D3 reading *"Upload 1%"* that closes it at
100. `streamProgress()` uses those bands when every step in a stream has one, and falls back to a
plain average where nobody has told us the weights.

**Ahead/behind is arithmetic, not a model.** `projectTask()`:

```
elapsedFrac  = (today − start) / (due − start)
projectedEnd = start + (elapsed / progressFrac)
varianceDays = due − projectedEnd          // negative ⇒ behind by N days
```

Deliberately not an LLM. It is auditable (a manager can be shown the sum), stable (the same task on
the same day always reads the same, so "behind by 3 days" cannot become "behind by 5" because
something was re-rolled), and free.

🔴 **It refuses to answer at 0% progress.** Dividing by zero would report every freshly-opened task
as catastrophically late, and a board where everything is red is a board nobody reads. A 0% task
reports *days left*, kind `not_started`, and is not projected. That distinction is why
"in progress at 0%" and "not started" stay separate states.

`at_risk` exists as a band between green and red for the same reason — without it the board flips
straight from fine to late the day something slips, which is the warning arriving too late to act on.

Verified 2026-08-26 against hand-derived literals (19 cases): overdue day counts, a behind case
(10 of 14 days used at 25% ⇒ 26 days late), an ahead case, the 0% refusal, undated tasks, finished
early/late, and the four banded-progress cases.

## Automation

**Opening a job generates its plan.** `POST /api/admin/engineering/jobs` creates the job, then
`generateTasksForJob` writes every playbook step, dated `po_date + cycleDays` and costed at the
step's target hours.

⚠️ **The job is created first and a failed generation does NOT roll it back.** A job that exists
with no tasks is visible, obviously wrong, counted on the Jobs page as **"No plan yet"**, reported in
the daily roll-up, and one click from fixed. A PO that silently created nothing is invisible until
somebody misses a ship date.

⚠️ **No PO date ⇒ no due dates.** A job back-entered three weeks late would otherwise arrive with a
fortnight of runway counted from today and sit on the board looking comfortable. The New Job dialog
says so before you save, and the job page shows an amber banner.

**Regeneration is idempotent, re-dating is explicit.** The unique index on
`(job_id, stream, step)` plus `ignoreDuplicates` means "Regenerate plan" adds what is missing and
overwrites nothing. Verified 2026-08-26: a second run inserts 0 and leaves a task already at 55%
untouched.

🔴 **That index must stay NON-PARTIAL.** 096 shipped it as `WHERE job_id IS NOT NULL`, so that
standing support work could repeat a step. A partial index cannot be inferred by `ON CONFLICT`
(Postgres 42P10), so generation threw on every job creation — past `tsc` and past a green build,
because these pages are force-dynamic and nothing runs the query at build time. 097 makes it plain;
standing work still repeats because **NULLs are distinct in a unique index**. Never add
`NULLS NOT DISTINCT` to it — that would silently cap the Support & Other bucket at one row per step. "Re-date from PO" is a separate button and never a side effect of editing the
date — a due date is a promise somebody made, and moving five of them silently is how a schedule
stops meaning anything.

**`started_at` / `completed_at` are set by a database trigger**, not application code. There are four
write paths into `eng_tasks`; one of them forgetting to stamp a start would not error, it would
quietly produce a task that can never be projected and a median that silently excludes it. Every
lead-time number on the report rests on those two columns.

## Chasing

`/api/cron/eng-reminders`, registered at **07:00 and 08:00 UTC** — 3am Eastern on both sides of the
DST line, clear of the 9am and 4:30–5:30pm deploy windows. The second run is a no-op; the
`nudged_at` stamps make it one.

1. **Owner nudge** — anything due within `nudgeLeadDays` (default 2) or already past, grouped so a
   person with six things gets one email.
2. **Lead roll-up** — past due, unowned, untouched for `staleAfterDays` (default 5), plus any active
   job with no plan. **Not sent when there is nothing outstanding**: a daily all-clear is the fastest
   way to teach people to filter the sender, and then the one that matters is filtered too.

**Recipients:** `ENGINEERING_NOTIFICATION_EMAIL` (comma-separated) if set, otherwise everyone whose
profile role is literally `engineering`. Deliberately **not** "everyone holding `engineering_jobs`" —
that includes every admin and production manager. An empty result sends nothing and says so in the
cron log rather than guessing.

⚠️ **A `nudged_at` stamp is a CLAIM, not proof of delivery.** It records that a send was attempted
and did not throw. Resend reporting "delivered" is also not an inbox — see `docs/notifications.md`
for the two filters between here and one, and run an Exchange Message Trace first if staff report
missing alerts.

⚠️ **Sends are sequential** (`sendAll`, 600ms apart). Resend's limit is 2/sec, and a `Promise.all`
fan-out against it once reached only some recipients while reporting success.

⚠️ **Auth fails closed.** No `CRON_SECRET` ⇒ nobody may call it. Never relax this to
`if (SECRET && …)` — that form is fail-open and has sent real mail.

## Architecture

| File | Role |
|---|---|
| `lib/engineering.ts` | 🔴 **Dependency-free.** Streams, statuses, `projectTask`, `streamProgress`. Client components import values from here |
| `lib/eng-playbook.ts` | 🔴 **Server-free.** The seeded rules + `coercePlaybook` |
| `lib/eng-data.ts` | `server-only`. Every read and write, plus generation |
| `lib/eng-report.ts` / `-types.ts` | The report builder and its client-safe types |
| `lib/eng-reminders.ts` / `resend-engineering.ts` | The morning sweep and its mail |
| `app/admin/engineering/` | Status board, jobs, tasks, my work, workload, playbook |
| `components/dashboards/eng-cards.tsx` | The four dashboard cards |

🔴 **Never import a VALUE from `lib/eng-data.ts` or `lib/eng-report.ts` into a client component.**
Both import `supabase-admin`; a value import ships the service-role client to the browser and kills
the page at hydration — past `tsc` and past a green server render. That is why the pure modules
exist. This has bitten the reports once already.

⚠️ **`coercePlaybook` REBUILDS rather than patches.** A field it does not know about is dropped. Add
a field to `PlaybookStep` and you must add it there too, or edits to it are silently discarded on
save. (The RFQ intake's `coerce()` has the same shape and the same trap.)

## Leadership surfacing

- **Dashboard cards** — `eng_status`, `eng_risk`, `eng_my_work`, `eng_load`. On the **admin default
  layout** alongside the ticket alerts, not below the analysis: a job trending late has to be visible
  before the ship date. On the **engineering/production-manager default layout** they lead the page.
  All four share one read, memoized per request with React `cache()`.
- **KPI strip** — "Engineering Tasks" and "Past Due" join the department metric tiles.
- **Nav badge** — Task Queue carries a rose badge counting tasks past their due date. Rose, unlike
  every other badge on the rail, because it counts a missed deadline rather than a queue.
- **`/admin/reports/engineering`** — on-time rate, median finish, target vs actual per step, per
  person, month by month, and a full CSV.

## The wall display

`/admin/engineering?tv=1` — the meeting's "displayed on a screen in the engineering department for
live updates". Same data, no chrome, larger type, refreshes itself every 60 seconds. The desk view
deliberately does **not** auto-refresh: a page that reloads under someone reading it is worse than a
stale one, and an unattended screen that goes stale is worse than no screen.

## Open questions for James

These are the gaps the sources leave, marked **Unconfirmed** in the playbook editor:

1. **Mechanical production steps.** The meeting notes give "drawings, sheet metal, framing"; the
   whiteboard sketches a finer breakdown (frame → component drop → skin) against a 0–100 bar. Neither
   gives hours, and the workbook says "See Master / Per Smartsheet".
2. **BOM hours and cycle.** No source has a BOM row at all.
3. **PLC vs HMI.** The whiteboard splits programming in two; the Elec sheet costs it as one 2-hour
   block. Splitting it would mean inventing the ratio.
4. **Weekly hours per role.** The workbook describes the *shape* of the week (Mon–Wed 80/20,
   Thursday, "OT if required" Friday) but never its length. Capacity degrades to "scheduled hours"
   until it is set.
5. **`long-lead` vs "mid-lead".** Raised in the meeting and left undefined. One `stream` covers both
   today; splitting it is a playbook edit, not a code change.
