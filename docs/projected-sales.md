# Projected Sales — Dryware reporting mirror

_Shipped 2026-07-20 (migration `059_projected_sales.sql`). The portal's first
live outbound API integration._

`/admin/projected-sales` mirrors the "projected sales by project" report from
**Dryware** (`dryware.dehumidifiers.com`), a first-party IAT system. Sales opens
the page and clicks **Sync now**; the server pulls the latest snapshot, cleans
it, and stores it locally so the page is fast, survives Dryware being down, and
holds the data between syncs. Read-only — the portal never writes back to Dryware.

## The source

`GET /api/Reporting/getProjectedSalesByProjectForExternalSystem`, HTTP Basic auth.
The credential is the full `Authorization` header value, stored **only** in the
`DRYWARE_AUTH_HEADER` env var (`.env.local` for local dev + Vercel for prod) and
read server-side in `lib/dryware.ts` — never in code, never client-exposed.

Each source record is one project: `user` (salesperson), `company`,
`projectCustomer`, `projectName`, `dateCreated`, `contact`, `projectTypes`,
`confidenceLevel` (percent), `estimatedClosingDate`, and a nested `units[]` array
(`unitName`, `modelNumber`, `quoteTotal`) — 1–5 units per project.

### ⚠️ The feed returns every row twice

As of launch the endpoint returns each project **duplicated** (190 rows → 95
unique; the raw dollar total is exactly 2× the real one) — the signature of a
JOIN fan-out in the Dryware reporting query. **Flagged to the Dryware dev.** We
handle it defensively: `dedupeAndDeriveProjectedSales` in `lib/dryware.ts`
collapses byte-identical rows on ingest, so the page shows each project once.
Safe either way — if the upstream bug is fixed, dedupe is a no-op; if two rows
ever legitimately differ, both survive. The UI shows both counts ("95 projects ·
from 190 source rows") so the duplication stays visible until it's fixed upstream.

## The data model (migration 059)

Two tables, service-role only (RLS on, no policies — like `deals` / `gantt_charts`):

- **`projected_sales`** — one row per unique project. Source fields plus derived
  `unit_count`, `quote_total` (sum of `units[].quoteTotal`), and `weighted_total`
  (`quote_total × confidence/100`). Dates parsed to real `date` columns; `units`
  kept as `jsonb`. No stable id upstream, so `id` is ours (bigint identity).
- **`projected_sales_sync`** — a single row (freshness + health): `last_synced_at`
  (success only), `source_count` / `unique_count`, totals, `duration_ms`,
  `status`, `error`, `synced_by`. Drives the "Synced 2m ago" line and the failure
  banner.

## The sync

`POST /api/admin/projected-sales/sync` (gated by `requireProjectedSalesAuth`):
fetch → dedupe → derive → write. On **success** it calls the
`replace_projected_sales(p_rows, p_meta)` Postgres function, which wipes and
reloads `projected_sales` **and** updates the sync log in **one transaction** — a
concurrent reader never sees a half-empty table. On **failure** (Dryware down,
timeout, bad response) it records the error on the sync log **without touching the
data**, so the last good snapshot stays on screen. The route hands the fresh rows
back to the client so the page updates without a refetch. Every sync is
audit-logged (`projected_sales.sync`).

Typical round-trip is ~1–2s (small JSON payload), so the button is a quick
spinner, not a wait.

## Access

Gated on the existing **`deals`** permission (Sales + admin) — see
`ADMIN_PATH_PERMS` in `lib/roles.ts` and `requireProjectedSalesAuth` in
`lib/api-auth.ts`. Deliberately reuses `deals` (same sales-pipeline audience) so
there's no new permission to seed (the `check-perm-seed` prebuild gate stays
happy); splitting it onto a dedicated `projected_sales` perm later is a one-line
change in both spots.

## Files

- `lib/dryware.ts` — fetch wrapper + dedupe/derive (pure, testable)
- `app/api/admin/projected-sales/sync/route.ts` — the sync endpoint
- `app/admin/projected-sales/page.tsx` + `ProjectedSalesClient.tsx` — the page
- `supabase/migrations/059_projected_sales.sql` — tables + `replace_projected_sales`
- Wiring: `ADMIN_PATH_PERMS` + `requireProjectedSalesAuth` + AdminSidebar (Sales group)

## Deferred

- **Scheduled ~6am auto-sync** — manual "Sync now" only for v1. The clean path is
  Supabase **pg_cron** (unlimited schedules, sidesteps the 2-cron Vercel tier): a
  nightly job that calls the same fetch/dedupe/replace path. Add when Sales wants
  morning-fresh data without clicking.
- **Realtime multi-viewer refresh** — a second viewer sees new data on their next
  load, not live. Supabase Realtime could push it; not worth it for a daily glance.
