# Session handoff — 2026-08-26 (b): ticket lifecycle, list selection, RFQ document capture

Covers one long session, **2026-08-24 ~08:40 ET → 2026-08-26 11:10 ET**. One repo
(`iat-forms-portal`), **20 commits**, 36 files, 2 migrations (094, 095), one new storage bucket.
No env vars changed by this session.

⚠️ **This is the SECOND handoff for 2026-08-26.** `2026-08-26-session-handoff.md` belongs to a
concurrent session (RFQ PDF layout, survey physics, mail re-timing) and must not be merged into or
overwritten by this one. Both are needed to reconstruct the day.

⚠️ **Read §4.1 and §4.2 before touching a checkbox or a cron.** The two most expensive lessons here
are that *a CSS class you did not write can silently defeat your layout* and that *"committed but
not pushed" is not a hold in a shared working tree*.

🔴 **§6.1 is the highest-priority open item: a concurrent session moved every cron schedule after
this session documented them, so the exclusion windows in `docs/notifications.md` are stale.**

---

## 1. SCOPE

### What it set out to do

Resume the 2026-08-24 handoff at **§6.1** — the Monday 18:00 leadership run had never successfully
sent, and the session before this one stopped to wait for it.

### What it became

Owner-directed, in this order. Nothing below was speculative.

| Area | Outcome |
|---|---|
| Leadership §6.1 | **Resolved** — sent 18:17:47 ET, day claimed, breadcrumb readable |
| Ticket close rules | An owner is now required to resolve/close |
| Closing notes | No longer sent to the customer by default; per-ticket choice in a dialog |
| Waiting on Customer | New status + 7/13/14-day self-chasing ladder (migration 094) |
| Queue silent failures | Refused bulk actions now say so instead of doing nothing |
| List select-all | Was selecting off-screen rows across six lists |
| List checkboxes | Selected the row without ever appearing ticked, across five lists |
| RFQ bulk actions | Checkboxes + Reviewing / Close / Assign to me / Delete |
| RFQ document capture | The customer's own PDF is kept and openable (migration 095) |
| Cron timing | The documented exclusion window was wrong and had caused a bad deploy |

### Left open

1. 🔴 **Cron exclusion windows are stale** — schedules moved by another session (§6.1).
2. **Step 7 illustration not verified in situ** (§6.2) — the wizard cannot be driven by automation.
3. **The RFQ PDF has never been captured from a real submission** (§6.3).
4. **Migration 093 still unapplied and untracked** — standing owner decision, do not re-raise.
5. **Leadership schedule may not match its stated intent** (§6.4) — worth one look, not this session's change.

---

## 2. CHANGE LOG

### 2.1 — Ticket close rules (`bbea284`, `f203754`, `c8d09b5`, `55f1d45`)

| File | Change | Why |
|---|---|---|
| `app/admin/tickets/actions.ts` | Owner guard on terminal transitions; `share_closing_note` plumbed; `notes_shared` in the audit row; `/_/g` fix | An owner that was never set is unrecoverable — `audit_log` records the status change and who clicked, but not a name nobody entered |
| `app/admin/tickets/[id]/TicketDetailClient.tsx` | `ownerRequired`; closing dialog; button becomes "Review & Close"; note copy reworded | The dialog is the only place the send decision is made, so it must state what will be sent |
| `lib/resend-customer-tickets.ts` | `sendTicketClosedToCustomer` takes a **required** `shareNotes`; `waiting_on_customer` added to `STATUS_WORDS` | A required parameter forces every future caller to state intent, so this cannot silently revert to leaking notes |
| `app/admin/tickets/[id]/page.tsx` | Resolves `customerEmailsEnabled` server-side and passes a boolean | ⛔ `resend-customer-tickets` builds the Resend client at module scope — importing it client-side ships the API key |
| `lib/resend-tickets.ts`, `components/admin/CommandPalette.tsx`, `app/admin/equipment/[id]/EquipmentDetailClient.tsx` | `.replace('_',' ')` → `/_/g` | `waiting_on_customer` is the first status with **two** underscores |

### 2.2 — Waiting on Customer (`b071a1b`, migration **094**)

| File | Change | Why |
|---|---|---|
| `supabase/migrations/094_ticket_waiting_on_customer.sql` | **NEW.** Rebuilds `tickets_status_check` with a fifth value | The column is a CHECK constraint, not an enum, and the table predates this migrations folder — the original body is not in the repo |
| `lib/ticket-waiting.ts` | **NEW.** The 7 / 13 / 14-day ladder | Day 14 **resolves, it does not close** — closing needs an owner and human notes, and a cron has neither |
| `lib/ticket-history.ts` | `waitingSince` on the lifecycle; exported `WAITING_STATUS` | Derived from `audit_log` exactly as `closedAt` already is — no new column needed |
| `app/api/cron/ticket-reminders/route.ts` | Runs the waiting sweep after the reminder sweep, in its own try | Either sweep must be able to fail without taking the other down |
| `app/api/tickets/status/message/route.ts` | A customer reply moves `waiting_on_customer` → `in_progress` | Without this a customer could answer on day 8 and still be auto-resolved on day 14 |
| `lib/supabase.ts` | Status union += `waiting_on_customer` | |
| `components/admin/list.tsx` | Violet `TICKET_STATUS` entry | Separates "we are working it" from "we are blocked on them" at a glance |

### 2.3 — List selection, across six lists (`c021004`, `69f6bd5`, `288a27f`, `8c47a81`, `7f2e11a`)

| File | Change | Why |
|---|---|---|
| `components/admin/bulk-select.tsx` | `togglePage()`; `SelectBox` gains `indeterminate` + `label`; **input made decorative with `pointer-events` off**, wrapper carries `role="checkbox"`, `tabIndex`, `aria-checked`, Space/Enter | Two distinct defects — see §3.6 and §4.2 |
| `app/admin/tickets/TicketsQueueClient.tsx` | Page-scoped select-all; error banner; migrated **off** its hand-rolled boxes onto `SelectBox` | Hand-rolling is why this list behaved differently from every other and why the click bug was invisible here |
| `app/admin/customers/`, `employees/`, `equipment/`, `requests/` clients | Page-scoped select-all + indeterminate | Same defect; Customers and Employees both bulk-delete |
| `app/admin/rfq/RfqClient.tsx` | Checkboxes, bulk bar, `applyToSelected`, error banner | |

### 2.4 — RFQ bulk actions (`c021004`)

| File | Change | Why |
|---|---|---|
| `lib/bulk-delete.ts` | `'rfq'` entity + label | |
| `app/api/admin/bulk-delete/route.ts` | `rfq` case — `rfq_notes` first, then `rfq_requests` | The FK has no `ON DELETE CASCADE` |
| `app/admin/rfq/page.tsx` | Passes `canDelete` (full admin) and `myEmployeeId` | The page is gated on `deals`; the delete endpoint is admin-only. A 403 reads as broken, not forbidden |

### 2.5 — RFQ document capture (`8b54855`, `48966e0`, migration **095**)

| File | Change | Why |
|---|---|---|
| `supabase/migrations/095_rfq_pdf_storage.sql` | **NEW.** Private `rfq-pdfs` bucket (5MB, `application/pdf`), `pdf_path`, `pdf_stored_at` | Page one carries contact details, site location and project economics — never a public bucket |
| `app/api/rfq/pdf/route.ts` | **NEW.** Anonymous, guarded, service-role write | ⛔ The browser does not write to Storage directly — that needs an anon INSERT policy, an open backlog item (§8.2) |
| `components/support/RfqWizard.tsx` | `storePdfCopy()`, fired after the success screen, never awaited | The survey is already committed; a customer must never wait on, or see an error from, a convenience for us |
| `app/admin/rfq/[id]/page.tsx` | Signed 10-minute URL; card renders **even when empty**, distinguishing "predates capture" from "did not arrive" | Hiding it made "no copy" look identical to "feature not shipped" — which is exactly how it was read |

### 2.6 — RFQ step 7 illustration (`48966e0` → `622256a` revert → `f5455fb`)

| File | Change | Why |
|---|---|---|
| `components/support/RfqWizard.tsx` | `CrispMagnifyImage` — image laid out at magnified size, scaled **down** at rest | `transform: scale()` stretches a raster made at layout size; the 760px source was never used |

⚠️ **`HoverMagnify` is untouched.** The render and the wall build-ups have a settled interaction.

### 2.7 — Documentation (`bc30c47`, `346784e`, `2180103`, `6382593`, `0bf5b8b`, `f890744`)

| File | Change |
|---|---|
| `docs/notifications.md` | Exclusion window opens at **nominal**; the "14 to 63 min" figure removed as unsupported at both ends; 17m47s datapoint |
| `docs/list-views.md` | Page-scoped select-all; the three checkbox fixes that **failed** and why each looked right |
| `docs/support-tickets.md` | Waiting ladder; owner guard; closing-notes choice; the two-underscore trap |
| `docs/dashboards.md` | The customer-reopen filter |
| `docs/rfq-moisture-survey.md` | Multi-select + bulk actions; PDF capture design |
| `docs/handoff/2026-08-19-session-handoff.md` | **Added to the repo** — existed only in the untracked parent folder, so was outside version control and the DR backup |
| `docs/handoff/2026-08-24-session-handoff.md` | §6.1 corrected (its command could never have run) and marked resolved |

### 2.8 — Infrastructure state

| System | Change |
|---|---|
| **Supabase migrations** | **094** and **095** applied. `093` deliberately **NOT** applied |
| **Supabase storage** | New private bucket `rfq-pdfs` |
| **Supabase CLI** | Owner authenticated it this session; `iat-forms` linked. Migration history shows **no drift** (001–092 all match) — the "059–063 pending" note is now **stale** |
| **Vercel env** | **None changed by this session** |
| **Vercel crons** | **Not changed by this session** — but changed by a concurrent one, see §6.1 |
| **DNS** | No changes |

---

## 3. DECISIONS & LOGIC

### 3.1 — The owner guard covers `resolved` as well as `closed`

**Options:** (a) `closed` only, as literally asked; (b) both terminal states.

**Chose (b).** It shares the `closing` condition with the closing-note guard directly above it, so
splitting them would mean two differently-shaped rules on one transition. Per the queue's
Active/Closed split a resolved ticket is still live work, so an unowned one is a job with nobody on
the hook to finish it. **Flagged to the owner as a widening; not objected to.**

### 3.2 — Closing notes default to NOT being sent

**Options:** (a) keep sending always; (b) opt-out; (c) **opt-in, defaulting to a confirmation only**.

**Chose (c).** Closing notes are the internal record of what was actually wrong; they can carry a
diagnosis, a commercial note or a candid assessment that is right internally and wrong in front of
the customer. Four independent defaults all point at not-sending: a **required** `shareNotes`
parameter, `=== true` rather than a truthy check, the dialog resetting on every open, and
`notes_shared` in the audit row.

⚠️ The **resolution reason** is withheld too when notes are withheld — it is one of fifteen fixed
reporting phrases, the same category of internal vocabulary.

### 3.3 — Day 14 auto-**resolves**; it does not auto-close

**Options presented to the owner:** (1) resolve + alert the assignee; (2) genuinely close with a
system-written note; (3) never change status, only nag.

**Owner chose (1).** (2) would punch a hole in the rule built hours earlier and every such close
would carry a note nobody wrote. (3) clears nothing, so the queue still fills.

### 3.4 — Waiting state derived from `audit_log`, not a new column

Same precedent as `closedAt`. Kept the DDL surface to a single CHECK constraint. Sent chases are
`ticket.waiting_notice` audit rows keyed by `metadata.kind`, counted only if written **after** the
current wait began — so park → answer → park is chased again from day zero.

### 3.5 — RFQ bulk actions drive the existing per-row `PATCH`, once per id

**Options:** (a) a new bulk endpoint; (b) **loop the existing route**.

**Chose (b).** The per-row route already owns the perm gate, the status whitelist, the
reminder-stamp clearing and the assignment email. A second write path would reimplement all of it
and drift. A triage queue is tens of rows.

### 3.6 — Select-all means the visible page

**Options:** (a) whole filtered set, as it was; (b) **current page**.

**Chose (b).** (a) put off-screen rows into a selection that has a Delete button on it. If
"select all N across pages" is ever wanted, it needs an explicit affordance that says so — not a
header box that quietly reaches past the screen.

### 3.7 — The customer's PDF is stored, not regenerated

**Options:** (a) regenerate server-side on demand; (b) regenerate client-side in the admin page;
(c) **keep the bytes the customer's browser produced**.

**Chose (c).** `lib/rfq-pdf.ts` is browser-only by design, so (a) is a port, not a switch. Both (a)
and (b) produce a document matching *today's* template — the moment the layout changes, the admin
page and the customer's copy disagree. Same reasoning the detail page already applies to `summary`,
which it never recomputes.

### 3.8 — ⛔ REJECTED: SharePoint, and Postgres, for the PDFs

The owner raised SharePoint in case of storage pressure. **There is none:** ~200KB per vector PDF
against 13 requests to date; even 500/year is ~100MB, on a project already running ten buckets.
SharePoint would add an Entra dependency that is already blocking other work. `bytea` in Postgres
is worse than object storage for binaries. **Do not re-propose either.**

### 3.9 — ⛔ REJECTED: letting the browser write to Storage directly

It would need an anonymous INSERT policy, and anonymous storage writes are an open backlog item
(§8.2). The ~4.5MB function-body cap is irrelevant for a ~200KB vector PDF — unlike ticket photos,
which genuinely must bypass the route.

### 3.10 — The empty PDF card renders anyway

Hiding it made "this request has no copy" indistinguishable from "the feature was never built".
It now names which of the two it is.

---

## 4. GOTCHAS DISCOVERED

### 4.1 — 🔴 "Committed but not pushed" is NOT a hold in a shared working tree

Other sessions commit and push to this same tree. A commit sitting on `main` goes to production
with **anyone's** next push. Two commits shipped that way in one afternoon while their authors
believed they were holding.

⛔ If something genuinely must not deploy, **stash it or branch it** — or push it deliberately
before the risky window opens, which is usually the better answer because it removes the hazard
rather than relocating it.

### 4.2 — 🔴 `img { max-width: 100% }` silently defeats a laid-out-large image

A global rule clamps a full-size image to its container's width, and any `scale()` you apply then
operates on the clamped size. An illustration meant to render at 132px rendered at **54px** —
shipped, and had to be reverted.

**`max-w-none` is load-bearing** wherever an image is deliberately laid out larger than its box.
Reproduced and measured in the browser before fixing: expected 132×176, got 54×72.

### 4.3 — 🔴 A checkbox inside a row link cannot use its own native toggle

The wrapper must `preventDefault()` or selecting navigates. On a checkbox that also cancels the
browser's toggle, and React will not re-sync because the prop it last wrote already matches.
**Three fixes failed, each of which looks correct in review:**

| Attempt | Why it failed |
|---|---|
| `checked` prop + `onChange` | React does not re-sync |
| prop + **ref callback** | Runs during render; React flushes discrete events **synchronously**, so it lands before the revert |
| prop + **`useEffect`** | Fixed every box *except the clicked one* — passive effects flush at the end of that same event |

**What works:** `pointer-events` off on the input so only the wrapper is ever clicked. No default
action, nothing to revert.

### 4.4 — ⚠️ A test that clicked the wrong thing passed while the bug was live

The first check of the ticket rows called `.closest('div').click()` — the **wrapper**, which was
the path that already worked. It reported success for a week-old bug. **Click the affordance a
person clicks**, not the container that is convenient in a script.

### 4.5 — 🔴 `supabase db push` applies EVERY pending migration

Migration `093` is deliberately unapplied. A plain `db push` would have shipped it silently,
granting a super-admin change the owner chose to defer. **Move it aside, push, move it back, then
verify it is still unapplied.** This trap was hit twice in one session.

### 4.6 — ⚠️ The reminder stamps cannot prove a cron ran

`assignee_nudged_at` / `unclaimed_reminded_at` / `escalated_at` are written only when a reminder
**fires**. A healthy run with nothing to nudge stamps nothing. **Absence proves nothing** — an hour
of a push was blocked waiting for a stamp that was never coming.

`rate_limits` is the better signal for "did a request arrive at all": it is written before any
validation, so a missing row means the client never called.

### 4.7 — ⚠️ A two-entry cron cannot be used as lag evidence

`admin-digest` has two entries. A `digest_runs.sent_at` of 21:33 is either the first entry 63
minutes late or the second 3.9 minutes late, and **both readings are live**. The widely-quoted "14
to 63 minutes" came from picking one; nothing in the evidence supports 14 at all. Use single-entry
crons, and quote no bound.

### 4.8 — ⚠️ Triggering a cron by hand claims the day and destroys the evidence

`vercel crons run /api/cron/admin-digest` wrote the `digest_runs` row four seconds later. Whether
the scheduled run would have arrived became permanently unanswerable. **Recover the mail OR learn
the cause — not both.**

### 4.9 — `vercel crons run` and Git Bash

MSYS rewrites a leading `/api/...` into `C:/Program Files/Git/api/...`. Run it from PowerShell.

### 4.10 — The RFQ wizard cannot be driven by automation, still

Neither the React native-setter trick nor real typing enables Continue on step 1. Every step tab
stays disabled, so React's state never updates. **Step 7 could not be reached to verify in situ.**

### 4.11 — Looks wrong, is correct on purpose

- **`resolved_reason` is left NULL by the auto-resolve.** None of the fifteen fixed phrases means
  "the customer never came back"; whoever closes it picks the honest one.
- **No customer email on the day-14 auto-resolve.** They were told at day 7 and again 24 hours out.
- **`waiting_on_customer` is absent from `LIVE_STATUSES`.** Nagging an owner daily about a ticket
  they are correctly blocked on is how people learn to ignore the nudge.
- **The PDF endpoint returns the same response for "no such reference" and "already stored"** so it
  cannot be used to enumerate references.
- **The bulk bar's Delete is hidden, not disabled,** for non-admins.

---

## 5. VERIFICATION STATE

| Change | Built | Deployed | Prod alias | Browser-tested |
|---|---|---|---|---|
| Owner required to resolve/close | ✅ | ✅ | ✅ | ✅ **Confirmed on the live ticket** — refused, then allowed |
| Closing dialog + notes choice | ✅ | ✅ | ✅ | ✅ both branches; `notes_shared:false` in the audit row |
| Waiting ladder — day 7 nudge | ✅ | ✅ | ✅ | ✅ fired, notice row written |
| Waiting ladder — idempotency | ✅ | ✅ | ✅ | ✅ re-trigger produced no duplicate |
| Waiting ladder — day 13 warning | ✅ | ✅ | ✅ | ✅ fired |
| Waiting ladder — day 14 auto-resolve | ✅ | ✅ | ✅ | ✅ status moved, alert sent to the desk |
| Customer reply clears waiting | ✅ | ✅ | ✅ | ✅ `waitingSince` re-derives to null |
| Select-all page-scoped | ✅ | ✅ | ✅ | ✅ tickets **and** RFQ: 10 ticked, bar says 10 |
| Checkbox ticks when clicked | ✅ | ✅ | ✅ | ✅ on **both** lists, clicking the box itself |
| RFQ bulk actions render | ✅ | ✅ | ✅ | ⚠️ **buttons confirmed present; none executed** |
| RFQ PDF endpoint | ✅ | ✅ | ✅ | ✅ end-to-end probe: 200, stored, row updated |
| RFQ PDF from a real submission | ✅ | ✅ | ✅ | ❌ **never happened — see §6.3** |
| RFQ PDF admin card | ✅ | ✅ | ✅ | ❌ **never seen rendered with a real PDF** |
| Step 7 illustration sharpness | ✅ | ✅ | ✅ | ⚠️ **markup measured on the live page; NOT seen in step 7** |
| Leadership §6.1 | n/a | n/a | n/a | ✅ sent 18:17:47 ET, breadcrumb read |

### Explicitly NOT verified

1. **No RFQ bulk action was ever executed** — Reviewing, Close, Assign to me and Delete are
   confirmed to render, and nothing more. They write to real customer records.
2. **The PDF card has never been seen with a real PDF in it.**
3. **Step 7 was never reached.** The rendering behaviour was measured in a sandbox on the live page
   with identical CSS; the component was never seen in its actual step.
4. **The 30-day reopen gate's UI path is unverified for the *waiting* status** — only the closed path.
5. **No email was opened.** Every mail this session was confirmed by send-path or audit row, never
   by reading an inbox.

---

## 6. OPEN THREADS

### 6.1 — 🔴 The cron exclusion windows in `docs/notifications.md` are STALE

A concurrent session re-timed every cron **after** this session documented them. Current
`vercel.json`:

```
0 22,23 * * *      admin-digest        (+ 0 0 * * *)
0 7,8 * * *        rfq-reminders, ticket-reminders
30 0,1,2 * * 2,4,6 leadership-update
```

The table this session wrote lists 09:00 ET reminders, 16:30 ET digest and 18:00 ET leadership.
**All three are wrong now.** The *rule* still holds — the window opens at the **nominal** time and
runs about an hour — but the times must be recomputed and the table rewritten.

**Next action:** recompute the ET windows from the current `vercel.json` and update the table in
`docs/notifications.md`, and the memory note.

### 6.2 — Step 7 illustration not verified in place

The fix is deployed. Resting footprint should be identical (112/132px) and hover a little sharper.
⚠️ This exact change was **shipped wrong once and reverted** — if the picture looks small, revert
`f5455fb` first and investigate second.

### 6.3 — The RFQ PDF has never been captured from a real submission

Endpoint proven; the browser half has never completed a real run. `RFQ-2026-0014` produced none —
proven via `rate_limits` to be a tab holding the pre-deploy bundle.

**Next action:** hard-reload `/support/rfq`, submit, then check `pdf_path` is non-null and the
signed link opens.

### 6.4 — ⚠️ Leadership schedule may not match its stated intent

The commit that moved it says **"6:30pm Eastern"**; the entries compute to **8:30 / 9:30 / 10:30pm
ET**, and `withinSendWindow` was changed to `20..22` to match — so it is internally consistent but
two hours later than the message describes. The doc comment above the function still argues for
`18..20`. **Not this session's change; worth one look by whoever made it.**

### 6.5 — Blocked / deferred

- **Migration `093`** — unapplied, untracked, standing owner decision. ⛔ Do not re-raise.
- **§8.2 anonymous storage uploads** — still open; this session deliberately did not widen it.
- **Older RFQs have no PDF, permanently.** The bytes only ever existed in the customer's browser.

---

## 7. RESUME CONTEXT

### Read first

1. This file.
2. `docs/handoff/2026-08-26-session-handoff.md` — the **other** session's record for the same day.
3. `docs/notifications.md` — ⚠️ its exclusion-window table is stale, see §6.1.
4. `docs/list-views.md` — the checkbox mechanism and the three fixes that failed.
5. `docs/support-tickets.md` — waiting ladder, owner guard, closing-notes choice.
6. Memory: `deploys-near-cron-time-eat-the-run`, `list-checkbox-in-row-link`,
   `shared-tree-commit-is-not-a-hold`, `supabase-db-push-applies-all-pending`,
   `rfq-pdf-capture`, `ticket-waiting-on-customer`.

### Key paths

```
iat-forms-portal/
  lib/ticket-waiting.ts                 # the 7/13/14-day ladder. Resolves, never closes
  lib/ticket-history.ts                 # closedAt AND waitingSince, both from audit_log
  app/admin/tickets/actions.ts          # owner guard + closing-note guard + share_closing_note
  app/api/rfq/pdf/route.ts              # anonymous, four guards, service-role write
  app/admin/rfq/[id]/page.tsx           # signed 10-min URL; empty card explains itself
  components/admin/bulk-select.tsx      # 🔴 pointer-events off on the input is load-bearing
  components/support/RfqWizard.tsx      # CrispMagnifyImage — max-w-none is load-bearing
  supabase/migrations/094_*.sql         # waiting_on_customer
  supabase/migrations/095_*.sql         # rfq-pdfs bucket + pdf_path
```

### Commands

```bash
# Never npx tsc — it fetches a squatter
node node_modules/typescript/bin/tsc --noEmit

# Stop any dev server BEFORE building (shared .next)
node node_modules/next/dist/bin/next build

# ⛔ Move 093 aside FIRST — db push applies every pending migration
npx supabase migration list --linked
npx supabase db push --linked
```

Trigger a cron by hand — **PowerShell, not Git Bash** (MSYS rewrites the leading slash):

```bash
npx vercel crons run /api/cron/ticket-reminders
```

### Project refs

| Thing | Value |
|---|---|
| Supabase | `dsbuhdjlkgwcghskvdse` (linked, CLI authenticated 2026-08-25) |
| Vercel project | `prj_0xzYnqI81xqgwvHdApqIP9oCkfSb` |
| Vercel team | `team_lrnCHwUYvgaDrPFqg9wGnAxK` |
| New bucket | `rfq-pdfs` — private, 5MB, `application/pdf` |

### Standing rules that bit this session

- **A commit on `main` is deployed-pending-anyone.** Stash, branch, or push deliberately.
- **The deploy exclusion opens at the cron's NOMINAL time**, not at nominal plus the lag.
- **`db push` applies everything pending** — check what else is waiting.
- **Verify against the artifact a person actually touches**, not the one convenient in a script.
- `git add` by explicit path — this tree is shared with concurrent sessions.
