# Deals — Sales Pipeline ("Forecast Pulse")

_Shipped 2026-07-07 (migration `043_deals.sql`). Dashboard + real-board Excel
import shipped 2026-07-10 — the table now holds the sales team's actual
monday.com board (440 deals, ~$91M raw / ~$24M weighted at import)._

`/admin/deals` rebuilds the core of the Monday.com "Sales Forecasting" board
natively in the portal: one `deals` table viewed through six tabs
(Dashboard · **Board** · Table · CRM · Focused · Calendar). It runs alongside
Monday for now — Sales re-exports the board and re-imports it here whenever
they want the portal refreshed — but the goal (agreed 2026-07-21) is **full
replacement**: the portal becomes the source of truth and the importer is
demoted to a recovery tool after the final cutover. See the CRM master plan
(Phase 1 of 6 shipped 2026-07-21: stages + kanban, below).

## The data model

One row per sales deal/opportunity (`deals`, migration 043 — service-role only,
RLS on with no policies, like `equipment`). Columns mirror the Monday board:
`customer`, `assigned_to`, `date_quoted`, `status` (`Won` | `Lost` | **null =
active/open**), `unit_model`, `job_name`, `total_cost`, `confidence` (0–100),
`projected` (free-text timeframe, e.g. "Q4 2026"), `rep`, `rep_contact`,
`notes`, `group_name` (rep team, e.g. MIKE/JACOB/DAVE/MAIN).

**`weighted` is never stored.** It's always `total_cost * (confidence / 100)`,
computed client-side in `lib/deals.ts` (`computeWeighted`) so it can never
drift out of sync — same convention as the Gantt feature's derived values.
`computeSummary` (totals, open/won/lost counts, win rate), `checklistProgress`,
and `hasRecentActivity` live there too, as pure functions consumed via `useMemo`.
`PROJECT_TYPES`, `CHECKLIST_STEPS`, `followUpDateFrom`, and `isRealDate` are here
as well. (The old derived `isFocused` predicate was removed with migration 048 —
Focused is now a hand-picked flag, see below.)

## Pipeline stages & the Board (2026-07-21, migration `061_deal_stages.sql`)

CRM Phase 1: deals graduated from "Won/Lost/null + a checklist" to **named
pipeline stages** — `lead → quoted → follow_up → verbal → won / lost` — driving
a drag-and-drop **Board** tab (kanban, `@hello-pangea/dnd`, already bundled).

**Data model.** `deals` gained `stage` (CHECK-constrained text; keys are the
contract, labels/tones live in `lib/deals.ts STAGES`), `stage_changed_at`
(powers days-in-stage), `expected_close` (a REAL date superseding the free-text
`projected`, which is kept read-only as "Projected (legacy text)"),
`closed_reason` (win/loss reason; quick-picks in `CLOSED_REASONS`), and
`next_step` / `next_step_due` (discipline fields, never a hard gate). New
`deal_stage_history` table logs every transition (`from_stage`, `to_stage`,
`actor`, `note`, `changed_at`) for funnel conversion and days-in-stage
analytics; the migration seeded one row per deal.

**Stage/status invariant.** `status` (`Won`/`Lost`/null) survives as a derived
compatibility shadow — every pre-061 analytic still reads it. The PATCH route
keeps the two in sync in BOTH directions: setting `stage` sets `status`;
setting only `status` derives a stage, and reopening (`status: null`) restores
the deal's **last open stage from history**. Real transitions stamp
`stage_changed_at` and append a history row (`stage_changed_at` itself is
never writable through the API).

**Backfill.** Status + checklist mapped into stages (Won→won, Lost→lost,
award→verbal, follow1/2→follow_up, quote-or-dated→quoted, else lead); on the
live board that produced 407 quoted / 32 lead / 2 won. Guarded by
"history table is empty" so re-running the migration never clobbers hand-set
stages. `expected_close` was backfilled from `projected` by
`scripts/backfill-expected-close.mts` (158 of 162 parseable; the rest left
NULL on purpose).

**The Board tab** (`app/admin/deals/BoardView.tsx`): six columns with weighted-$
headers, cards sorted biggest-first and capped at 40 per column ("Show all"
expands — 400+ deals would drown the DOM), search + rep-group pills mirroring
the Table toolbar, and **Lost collapsed to a narrow drop rail** by default.
Dropping a card onto Won/Lost parks the move behind a **closed-reason prompt**
(the stage doesn't change until confirmed; reasons feed future win/loss
reporting). A failed drag snaps the card back via the optimistic machinery.

**The modal** got a stage stepper (chips for the four open stages + Won/Lost
with an inline reason picker + Reopen), the old 5-step checklist demoted to a
collapsed "Process Checklist" accordion (still real data, no longer implies
stage), stage transitions merged into the activity feed, and edit-mode fields
for Expected Close / Next Step / Next Step Due.

**Optimistic-machinery upgrade** (`DealsClient.persist`): the PATCH API now
returns the **full updated row**, and the client folds it into both the
last-known-good map and visible state — gated by a per-deal in-flight counter
so a slow response can never clobber a newer optimistic edit. This is what
lets server-derived fields (synced status, `stage_changed_at`, and later
phases' derived columns) flow back without a refetch.

**Importer.** Fresh rows derive a stage (Won/Lost/quoted/lead); replace-mode
carry-over now also restores `stage` (portal stage wins unless the export says
Won/Lost), `stage_changed_at` (so re-imports don't reset deal-rot ages),
`expected_close`, `closed_reason`, `next_step`, `next_step_due`, and
re-parents `deal_stage_history` rows — same customer+job+group identity as
activity/follow-ups. Any deal that doesn't inherit history gets a fresh seed
row. **Four-places rule** still applies: a new `deals` column must be added to
the `Deal` type, `validate.ts`, the importer's carry-over, and the PATCH route.

## The six views

All views read the same in-memory dataset (single `useState` in
`app/admin/deals/DealsClient.tsx`, hydrated by the server page). Follow-up
reminders are lifted here too so the Calendar tab and the deal modal share one
source of truth. All stay mounted with only one visible, so each keeps its own
filter/sort state when switching tabs. Sortable columns follow the Tickets-queue
pattern.

| View | Question it answers | Notes |
|------|--------------------|-------|
| **Dashboard** | How does the whole book look? | Default tab; see "The Dashboard" below. |
| **Board** | Where does every deal stand? | Kanban by `stage` (2026-07-21) — drag between columns to move a deal; Won/Lost drops prompt for a reason. See "Pipeline stages & the Board" above. |
| **Table** (né Pipeline) | What's the financial forecast? | All deals, default sort `total_cost` desc. Leading **★ star** toggles a deal into Focused. **Rep filter pills** (All / MAIN / JACOB / MIKE / DAVE): "All" shows prominent per-rep bands (initials + count + $ totals); a specific rep filters to just them. Inline Won/Lost/Active status select. Row click opens the detail modal. |
| **CRM** | Who are we selling to? | Default sort `date_quoted` desc, **nulls always last**. Notes truncate at ~70 chars with click-to-expand. Deals with notes + still active get a small emerald "recent activity" flag. |
| **Focused** | What am I working right now? | **Hand-picked** — deals where `focused = true` (starred in Pipeline or the modal). No longer derived. `confidence` / `projected` / `notes` inline-editable (optimistic → PATCH on blur); ★ unstars; row delete lives here too. |
| **Calendar** | What follow-ups are due? | Month grid of `deal_follow_ups` (date-fns, matching `app/admin/schedule/SchedulingCalendar.tsx`). Overdue = rose, due-today = brand green, scheduled = sky, done = muted. Click a day → detail list with mark-done / open-deal / delete. |

"New Deal" (header button) opens a modal; created deals prepend to the shared
dataset so all views update at once.

## Deal detail modal (2026-07-10)

`app/admin/deals/DealDetailModal.tsx` — the "click into a deal" card, matching
the monday.com item view the team is used to, without per-deal pages (440
deals don't need 440 routes). **Open it from any list view**: click a row in
Pipeline or CRM (inline controls stopPropagation), or the ⤢ icon in Focused
(those rows are full of inline inputs, so no row-click there).

- **View mode**: money strip (cost / weighted / confidence), one-click status
  segmented control (same semantics as the Pipeline select), every field with
  icons, an **Updates & notes** panel, created/updated meta, Delete.
- **Add update**: a one-line input that PREPENDS a dated line to `notes`
  ("7.10.26 — got the PO") — the sheet's own convention, so Monday's
  updates-feed habit works with zero schema change and survives re-import
  round-trips.
- **Edit mode** ("Edit deal"): the same fields as the New Deal modal (shared
  styles in `app/admin/deals/form.ts`), Save diffs against the live row and
  PATCHes only changed fields; Cancel discards.
- **Prev/next**: chevrons + ←/→ keys walk an ordered-id snapshot of the view
  it was opened from (its filter/sort at that moment); deals deleted or
  replaced mid-browse silently drop out of the order. Esc closes (cancels
  edit first). Counter shows "N / M".
- Persistence rides DealsClient's existing optimistic machinery (patchLocal →
  persist → revert-on-fail); the modal never calls the API directly.
  Verified end-to-end: optimistic value → 401 (anon) → revert + error banner.

## Deal workflow layer (2026-07-10, migration `047_deal_workflow.sql`)

Matches the deal card the sales team works from (their screenshot): progress,
quick-action logging, a fixed follow-up checklist, and an activity trail —
all inside the detail modal.

- **Follow-up Checklist** — the 5-step sales process (Preliminary Submittal
  Sent → Quote Sent → Initial Follow-Up → 2nd Follow-Up → Job/PO Award).
  Steps live in code (`lib/deals.ts` `CHECKLIST_STEPS`; relabel freely, never
  rename a key); state is `deals.checklist` jsonb, toggled through the normal
  PATCH (full-replace semantics, shape enforced in `validate.ts`). The **Deal
  Progress** bar shows `N/5 completed`.
- **Quick Actions** — Log Call · Send Email · Schedule Meeting · Send
  Proposal. Each opens a one-line composer and writes a `deal_activity` row
  (kind + summary + actor + timestamp); empty summaries get a sensible
  default ("Logged a call").
- **Activity Log** — reverse-chronological trail (max 100 shown) fed by quick
  actions and checklist toggles (auto-entries: "Completed: Quote Sent").
  Routes: `GET`/`POST /api/admin/deals/[id]/activity`, requireDealsAuth.
- **Survives re-imports** — replace-mode import snapshots checklists +
  activity before the wipe and carries them onto the re-imported rows
  matched by customer + job + group (first match wins on true duplicates;
  best-effort — a carry-over failure never fails the import). The import
  preview shows what's at stake before you commit.
- **Pre-migration behavior** — until 047 runs: activity shows a run-the-
  migration hint (GET degrades to `unavailable: true`), checklist toggles
  revert via the standard optimistic-revert path. Nothing crashes.

The **Updates & notes** panel (dated free-text, imported board history) stays
separate from the Activity Log on purpose: notes round-trip with the monday
export; activity is portal-native structured data.

## The Dashboard (default tab, 2026-07-10)

`app/admin/deals/SalesDashboard.tsx` — the sales "command center". **Every
figure is computed live from the deals table**; there are deliberately no
sample numbers, and cards that would need data the board doesn't carry
(quotas, bookings-by-close-date, call/demo activity) don't exist yet rather
than showing invented values. Targets/quotas can join when Sales provides them.

Sections, all derived in `lib/deals.ts` as pure `(deals, now)` functions:

- **Hero** — weighted forecast headline + blended confidence (weighted ÷ raw),
  raw pipeline, open count, won-to-date.
- **KPI row** — raw, weighted, open deals, avg open deal, blended confidence,
  win rate (shows — until deals get marked Won/Lost).
- **Quoting activity** (`monthlyQuoteSeries`) — $ quoted per trailing month
  from `date_quoted`, deal count above each bar.
- **Pipeline by confidence** (`confidenceBands`) — open $ in five bands
  (Long shots 0–19 … Near-certain 80–100), green ramp light→dark.
- **Deals by status** — Won/Open/Lost donut.
- **Pipeline by group** (`groupStats`) — MAIN/JACOB/MIKE/DAVE leaderboard:
  share of expected value, raw, blended confidence, win rate.
- **Projected close** (`projectedBuckets`) — best-effort parse of the
  free-text `projected` column ("Q4 2025", "July 2025", "2028", "7.15.24")
  into quarter/year buckets of expected $; unparseable → Unscheduled/No date.
- **Largest open deals**, a blended-confidence gauge, and **Needs attention**
  (`attentionSignals`): stale quotes (>90 days), big deals at ≤10% confidence,
  $0-value rows, undated rows.

SVG gotcha, learned the hard way: `Math.sin`/`Math.cos` are
implementation-approximated, so Node (SSR) and the browser can differ by one
ulp on computed SVG coordinates → React hydration-mismatch errors. Round any
trig-derived attribute (`.toFixed(2)`) before rendering.

## Focus, follow-ups & project type (2026-07-13, migration `048_deal_focus_followups.sql`)

Four sales-requested additions, all degrading gracefully before 048 is run
(missing columns/table → friendly hints, optimistic edits revert cleanly):

- **Focused is now hand-picked.** `deals.focused` boolean, toggled by the ★ in
  the Pipeline rows and the deal modal header. The Focused tab filters on the
  flag instead of the old derived predicate — so it starts empty and reps curate
  it. Unstar from Focused or Pipeline to remove.
- **Rep separator upgrade.** Pipeline's old group-by-rep toggle is now filter
  pills (`filterPillCx`) + a proper per-rep band (initials chip, count, $ /
  weighted totals) in "All" mode. Flat single-rep list when a pill is picked.
- **Project type** (`deals.project_type`, free text). The New Deal + edit forms
  offer `lib/deals.ts PROJECT_TYPES` as a dropdown (placeholder industry set —
  swap for the real list anytime, the column is free text). Shown as a header
  chip + a field in the modal. Only sent on create when set (keeps New Deal
  working pre-048).
- **Follow-up calendar** (`deal_follow_ups` table). New deals auto-schedule a
  reminder 2 weeks out (`auto_generated=true`); the date is computed in the
  **browser's** timezone and passed to the create route (the server runs UTC).
  The modal's "Schedule Follow-up" adds dated ones; the **Calendar** tab is the
  month view. Bulk imports do NOT auto-generate (would spawn one per row).
  Routes: `POST /api/admin/deals/follow-ups`, `PATCH`/`DELETE
  /api/admin/deals/follow-ups/[id]`; dates validated with `isRealDate` (rejects
  2026-02-31 before Postgres does). Follow-up state is lifted into `DealsClient`
  with optimistic temp-ids; a delete/complete during the insert's in-flight
  window is reconciled once the real row lands (`pendingFollowUp` ref).
- **Re-import carry-over** now also preserves `focused`, `project_type`, and
  follow-ups (matched by customer+job+group, same as checklists/activity), and
  the import preview discloses all of them before a replace.

## Importing the board (Excel)

The board of record is still monday.com; the portal ingests its export.

- **Parser** — `lib/deals-import.ts` (`parseSalesForecastXlsx`), pure, shared
  by the API route and the backfill script so they can't drift. Understands
  the export's group blocks ("MAIN Sales Forecasting" headers), matches
  columns by name (survives reordering), maps 1:1 onto `deals` columns, drops
  the sheet's `Weighted` (always derived), normalizes dates/Won-Lost, and
  emits warnings (blank Total Cost → $0, etc.) instead of failing.
- **API** — `POST /api/admin/deals/import` (multipart `file`, `mode` =
  `replace`|`append`, `commit`). Dry-run first: the modal shows per-group
  counts/$, warnings, and what replace would delete, then commits. Gated by
  `requireDealsAuth` (sales self-service, like the rest of the deals API);
  writes a `deal.import` audit-log entry; returns the fresh board so the
  client swaps state without a refetch (and rebuilds its optimistic-revert
  map — see `applyImported` in `DealsClient`).
- **UI** — "Import from Excel" on the Dashboard tab (drag-drop or browse →
  preview → Replace board (default) / Add on top → import).
- **Backfill script** — `scripts/import-sales-forecast.mts` (`npx tsx …
  <file.xlsx> [--commit]`), same parser, service-role key; used for the
  initial 2026-07-10 load (replaced the 5 migration-043 seed rows).
- **Deps** — SheetJS `xlsx` pinned to the 0.20.3 CDN tarball (the npm-registry
  0.18.5 has unfixed high advisories).
- **⚠ Data hygiene** — real exports contain customer pipeline data and this
  repo is public: `/docs/*.xlsx|xls|csv` is gitignored; never commit an export.

## Access — the first scoped write

- Permission: `deals` in `lib/roles.ts` — granted to `sales` (plus implicit
  `admin`). Path-gated by middleware via `ADMIN_PATH_PERMS`.
- **Writes**: `requireDealsAuth()` in `lib/api-auth.ts` accepts any role with
  the `deals` permission — the first deviation from the "scoped roles are
  view-only" v1 boundary, because inline editing by reps *is* the feature. See
  docs/roles-and-permissions.md for the boundary rules.
- Routes: `POST /api/admin/deals` (create), `PATCH`/`DELETE
  /api/admin/deals/[id]` (field-whitelisted partial patch / delete).

## Migration 043

Creates `deals` + indexes + `updated_at` trigger, enables RLS (no policies),
and seeds the 5 sample deals from the scaffolding prompt — guarded to only seed
an empty table, so reruns don't duplicate. Applied to prod 2026-07-07.

## Deferred (deliberately out of MVP)

- ~~Importing the real spreadsheet~~ — done 2026-07-10 (see "Importing the board").
- Direct monday.com integration (auto-sync instead of manual re-export/import).
- Quotas/targets per rep or group (unlocks attainment views on the Dashboard).
- Lead/contact lifecycle, stage automation, activity timeline.
- `assigned_to` as a real profile-linked picker (free text for now).
- Retiring Monday.
