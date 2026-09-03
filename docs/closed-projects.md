# Closed Projects — Dryware "won" mirror, and a prune-safety fix

_Shipped 2026-09-03 (migration `100_closed_projects.sql`, applied via the
Supabase CLI ahead of the code push — see Rollback below for what that means
in practice)._

`/admin/closed-projects` mirrors the "closed projects" feed from **Dryware**
(`dryware.dehumidifiers.com`) — sibling to Performance (`docs/projected-sales.md`),
same first-party system, same `DRYWARE_AUTH_HEADER` credential. Per Danny Popov
(Dryware dev): this endpoint is **won-only** — a project with a DryWare "Lost"
status is never returned here, so a row's mere presence means the deal was won.
Sales opens the page and clicks **Sync now**; the sync also transitions the
matching CRM deal to `stage = 'won'`.

## ⚠️ Also fixes a real bug in the *existing*, already-shipped Performance sync

`materializeDealsFromProjectedSales()` (the function the Performance page's sync
has called since 2026-07-21) prunes — hard-deletes — any `deals` row whose
`dryware_key` is no longer present in the fresh open-projects snapshot. Dryware
stops listing a project once it closes (that's the whole reason "closed" needed
its own endpoint), so **the very next Performance sync after any deal won would
have silently deleted that deal's row** — its stage history, notes, checklist,
everything — instead of marking it won. This was live and real before this
change; it just had no way to be *triggered correctly* (as a transition to won)
until the closed feed existed to supply the "why."

**The fix** (`lib/dryware-deals.ts`, the prune step): before deleting a vanished
`dryware_key`, check whether it's now present in `closed_projects`. If so, skip
— it closed, it didn't disappear. `materializeWonDeals()`
(`lib/dryware-closed-deals.ts`) owns the actual transition to `won`, and runs
before the prune check in every combined sync, so a project is protected from
deletion by the time the guard even asks. Verified end-to-end against live prod
data: 6 real won deals transitioned, then the *unmodified* open-feed materializer
was run for real (422 other deals touched, 0 pruned) — all 6 survived with
`stage` still `'won'`. Re-running the transition twice more confirmed it's a
pure no-op the second time (no duplicate writes, exactly one
`deal_stage_history` row per deal).

A closed project with **no matching deal at all** is inserted directly as a won
deal, rather than skipped. Two real cases produce this: a deal already deleted
by the pre-fix prune bug (recovery), or a sales cycle so short the project was
never seen on the open feed before it closed.

## The source

`GET /api/Reporting/getClosedProjectsForExternalSystem`, same Basic-auth header
as the open feed. Per Danny (confirmed 2026-07-21):

- **Won-only.** Lost projects carry a separate DryWare status and never appear.
- **`closedTotal`, not `quoteTotal`, is authoritative.** A unit can have multiple
  quote revisions; `quoteTotal` reflects whichever was most recently selected
  system-wide, not necessarily the one the closed deal actually used. They can
  legitimately differ — the UI shows both when they do.
- **`projectId` / `unitId` are real, stable upstream ids** (also confirmed added
  to the open feed the same day) — this table's primary key is Dryware's own
  `project_id`, not a generated one.
- Some fields are optional even on a closed project: `estimated_closing_date`
  and `contact` have both been seen absent.

## The data model (migration 100)

Two tables, service-role only (RLS on, no policies), **never wiped** — additive
upsert only, unlike `projected_sales`'s full replace:

- **`closed_projects`** — one row per `project_id`. `quote_total` kept for
  reference; `closed_total` is authoritative. `imported_at` is set **once** on
  first insert and never touched again on a later re-sync — this is exactly what
  Danny asked us to track ("if something does go wrong and we need to re-export
  data, it will be easier to determine a cutoff point"): the oldest
  `imported_at` we're missing tells him where a re-export needs to start.
  Verified against a real double-run: zero drift.
- **`closed_projects_sync`** — freshness/health, same shape as
  `projected_sales_sync`, plus `new_count` (how many of this sync's rows were
  genuinely new) and `total_closed` (a running `SUM` across the *whole* table).

`upsert_closed_projects(p_rows, p_meta)` — the Postgres function — `INSERT …
ON CONFLICT (project_id) DO UPDATE`, with `imported_at` deliberately absent
from the `DO UPDATE SET` list so it's preserved. (First version used a bare
`DELETE FROM projected_sales`-style wipe pattern by habit — caught immediately
by Supabase's `pg_safeupdate` guard, "DELETE requires a WHERE clause," which
doesn't apply here anyway since this table is never wiped.)

## The sync — two entry points, one pipeline

1. **`POST /api/admin/closed-projects/sync`** (this page's own button): fetch →
   derive → `upsert_closed_projects` → `materializeWonDeals`. Does not touch
   `projected_sales` or its prune step.
2. **`POST /api/admin/projected-sales/sync`** (Performance's button) now *also*
   runs step 1's pipeline, best-effort, immediately before its existing deals
   materialization — so a single click on either page keeps the open mirror,
   the closed mirror, and the CRM Board all consistent, in the safe order.

Both closed-projects steps are wrapped best-effort (their own try/catch) so a
Dryware hiccup on either feed never fails the other sync that already
succeeded — same fail-safe posture as the rest of this integration.

## Access

Gated on the existing **`deals`** permission (Sales + admin) via
`requireClosedProjectsAuth` — same trust boundary and audience as Performance,
CRM, Territories and Rep Scorecard, so no new permission to seed.

## Files

- `lib/dryware-closed.ts` — fetch + derive (pure), sibling of `lib/dryware.ts`
- `lib/dryware-closed-deals.ts` — `materializeWonDeals()`
- `lib/dryware-deals.ts` — prune-guard fix (see above)
- `app/api/admin/closed-projects/sync/route.ts`
- `app/api/admin/projected-sales/sync/route.ts` — extended to also drive the closed pipeline
- `app/admin/closed-projects/page.tsx` + `ClosedProjectsClient.tsx`
- `supabase/migrations/100_closed_projects.sql`
- Wiring: `ADMIN_PATH_PERMS` + `requireClosedProjectsAuth` + AdminSidebar (Sales group)

## Rollback — what to do if something needs to change

**This shipped as two separate commits on purpose**, so a future revert never has
to choose between "keep the new feature" and "keep the safety fix":

1. **The prune-guard fix alone** — `lib/dryware-deals.ts` only. Find it with
   `git log --oneline -- lib/dryware-deals.ts`. **Only revert this if you are
   certain no project will ever close while the reverted code is live** —
   reverting it brings back the delete-on-close bug described above verbatim.
   In practice: don't revert this one.
2. **The Closed Projects feature** — everything else (schema client code, both
   routes, the page, nav, docs, changelog). Find it with
   `git log --oneline -- app/admin/closed-projects`. **Safe to revert on its
   own.** The prune guard (commit 1) stays in place and keeps protecting won
   deals even with the feature UI gone — `materializeWonDeals` simply stops
   being called, so newly-won deals sit un-transitioned (still `stage='quoted'`
   or whatever they were) rather than mis-transitioned. Nothing breaks.

**What a code revert does NOT undo — these are real, standing state changes:**

- **Migration 100** (`closed_projects`, `closed_projects_sync`,
  `upsert_closed_projects`) was applied directly to prod via the Supabase CLI,
  separately from the code push. `git revert` has zero effect on it — the
  tables just sit there, harmless, since nothing writes to them without the
  sync route. To actually remove them, run by hand via the CLI:
  `DROP FUNCTION upsert_closed_projects; DROP TABLE closed_projects_sync;
  DROP TABLE closed_projects;` — never part of a commit, always a deliberate,
  separate action.
- **Deals already transitioned to `stage = 'won'`** — 6 real ones from
  verification before ship, plus whatever real Sync clicks add afterward. A
  code revert doesn't touch existing rows. To undo one by hand, it's an
  ordinary deal edit: `UPDATE deals SET stage = '<prior stage>' WHERE id =
  '<id>'` — the prior stage is on record in `deal_stage_history.from_stage`
  (most recent row for that `deal_id`), so nothing has to be guessed.

**If Dryware's data just looks wrong** (a bad field, a stale value): that's
almost never a rollback situation. Both `projected_sales` and `closed_projects`
are fully re-derived from the live feed on every sync, and `closed_projects`
never auto-deletes a row even on a bad sync (upsert only) — so the fix is
"click Sync again" or wait for Dryware to correct their data, not revert code.

## Deferred

- **The acknowledgment endpoint** Danny offered (we send back the `project_id`s
  we've durably recorded; he only re-sends what we haven't acked) — not yet
  specified on his side. Not urgent: the feed still sends everything every time,
  so nothing is lost by waiting.
- **Auto-detecting an actual "Lost" outcome** — out of scope; Dryware's lost
  projects don't come through this endpoint at all today.
