# Deals — Sales Pipeline ("Forecast Pulse")

_Shipped 2026-07-07 (migration `043_deals.sql`). Dashboard + real-board Excel
import shipped 2026-07-10 — the table now holds the sales team's actual
monday.com board (440 deals, ~$91M raw / ~$24M weighted at import)._

`/admin/deals` rebuilds the core of the Monday.com "Sales Forecasting" board
natively in the portal: one flat `deals` table viewed through four tabs
(Dashboard · Pipeline · CRM · Focused). It runs alongside Monday for now —
Sales re-exports the board and re-imports it here whenever they want the
portal refreshed; a direct Monday integration is a someday-maybe follow-up.

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
`computeSummary` (totals, open/won/lost counts, win rate), `isFocused`, and
`hasRecentActivity` live there too, as pure functions consumed via `useMemo`.

## The four views

All views read the same in-memory dataset (single `useState` in
`app/admin/deals/DealsClient.tsx`, hydrated by the server page). All stay
mounted with only one visible, so each keeps its own filter/sort state when
switching tabs. Sortable columns follow the Tickets-queue pattern.

| View | Question it answers | Notes |
|------|--------------------|-------|
| **Dashboard** | How does the whole book look? | Default tab; see "The Dashboard" below. |
| **Pipeline** | What's the financial forecast? | All deals, default sort `total_cost` desc. Summary strip (total, weighted, open/won/lost, win rate) recomputes from the current search filter. Optional group-by-rep with per-group subtotals. Inline Won/Lost/Active status select. |
| **CRM** | Who are we selling to? | Default sort `date_quoted` desc, **nulls always last** regardless of direction. Notes truncate at ~70 chars with click-to-expand. Deals with notes + still active get a small emerald "recent activity" flag. |
| **Focused** | What needs attention today? | Open deals where `confidence >= 60` OR `projected` set OR `notes` set. Default sort `weighted` desc. Filter by assignee/group. `confidence` / `projected` / `notes` are inline-editable (edit → optimistic local update → PATCH on blur, the `CustomerPortalCard` pattern); `weighted` recalculates live as confidence changes. Row delete lives here too. |

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
