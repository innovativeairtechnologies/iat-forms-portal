# Deals — Sales Pipeline ("Forecast Pulse")

_Shipped 2026-07-07. Requires migration `043_deals.sql`._

`/admin/deals` rebuilds the core of the Monday.com "Sales Forecasting" board
natively in the portal: one flat `deals` table viewed through three tabs. This
is a **parallel MVP** — it runs alongside Monday until Sales proves it out; the
real historical spreadsheet import is a planned follow-up (test/seed data only
for now).

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

## The three views

All three read the same in-memory dataset (single `useState` in
`app/admin/deals/DealsClient.tsx`, hydrated by the server page). All three stay
mounted with only one visible, so each keeps its own filter/sort state when
switching tabs. Sortable columns follow the Tickets-queue pattern.

| View | Question it answers | Notes |
|------|--------------------|-------|
| **Pipeline** | What's the financial forecast? | All deals, default sort `total_cost` desc. Summary strip (total, weighted, open/won/lost, win rate) recomputes from the current search filter. Optional group-by-rep with per-group subtotals. Inline Won/Lost/Active status select. |
| **CRM** | Who are we selling to? | Default sort `date_quoted` desc, **nulls always last** regardless of direction. Notes truncate at ~70 chars with click-to-expand. Deals with notes + still active get a small emerald "recent activity" flag. |
| **Focused** | What needs attention today? | Open deals where `confidence >= 60` OR `projected` set OR `notes` set. Default sort `weighted` desc. Filter by assignee/group. `confidence` / `projected` / `notes` are inline-editable (edit → optimistic local update → PATCH on blur, the `CustomerPortalCard` pattern); `weighted` recalculates live as confidence changes. Row delete lives here too. |

"New Deal" (header button) opens a modal; created deals prepend to the shared
dataset so all three views update at once.

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

- Importing the real spreadsheet (owner: Jacob — hand off once views approved).
- Lead/contact lifecycle, stage automation, activity timeline.
- `assigned_to` as a real profile-linked picker (free text for now).
- Retiring Monday.
