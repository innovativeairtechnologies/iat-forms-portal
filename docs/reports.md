# Reports (`/admin/reports`)

Six reports under one sidebar group, added 2026-08-21. Support Tickets first, then Quote Requests,
Sales Pipeline, Installed Base, Portal Adoption and Engineering (2026-08-26).

## Access

**The `reports` perm, admin-only BY OMISSION.** It is granted to no scoped role in
`DEFAULT_ROLE_PERMS`, so `hasPermission()` returns true only for `admin` and **no
`role_permissions` seed or migration is needed** — the same pattern as `srv` and `sizing`. The
`check-perm-seed` prebuild gate passes precisely *because* nothing is granted. Hand it to a role
from `/admin/permissions` when someone specific needs it; no code change required.

⚠️ **Deliberately NOT reusing `tickets`.** That perm is held live by engineering and
production_manager. Reporting aggregates who closed what and how fast, which is a different question
from working a queue — widening the queue perm to cover it would have been invisible.

**Gated twice.** `ADMIN_PATH_PERMS` maps `/admin/reports` → `reports`, *and* every page re-checks
`can('reports')` then calls `notFound()`. An unmapped `/admin/*` path falls back to `dashboard`,
which all five scoped roles hold, so the second check is what makes a future matcher edit fail
closed instead of exposing everything. `notFound()` rather than a redirect so an unauthorized caller
cannot tell "not allowed" from "not a page". Verified anonymous: all five routes 307.

## Architecture

| File | Role |
|---|---|
| `lib/report-shared.ts` | RANGES, `Bucket`, `median`, `tally`, money formatting. **No server imports.** |
| `components/admin/report-ui.tsx` | `Tile`, `BarRow`, `BarList`, `Section`, `RangeTabs`, `ExportCsvButton` |
| `lib/<name>-report.ts` | one builder per report; server-only, imports `supabase-admin` |
| `app/admin/reports/<name>/` | page (guard + range) + client (presentation) |

🔴 **A client component must never import a VALUE from a builder.** Builders import
`supabase-admin`; importing `RANGES` from one shipped the service-role client to the browser and
killed the page at hydration with `supabaseKey is required` — **past `tsc` and past a green server
render**, so only loading the page caught it. That is why `lib/report-shared.ts` exists. Types are
erased and are safe with `import type`.

**Everything computes server-side.** Clients present and export, nothing more. Ranges push
`?range=` so the URL is shareable and the server rebuilds.

**Medians, not means, throughout.** One record left open over a shutdown drags a mean into
uselessness, and this data is full of those.

**The CSV carries a UTF-8 BOM.** Without it Excel reads the file as the local codepage and mangles
accented company names. ⚠️ Verify it with `arrayBuffer` — `Blob.text()` strips a leading BOM while
decoding, so a text check reports it missing when it is there.

## What each one can and cannot say

### Support Tickets
Close dates come from `audit_log`, not a column — see `docs/support-tickets.md`. Time-to-close uses
the FIRST close so a reopen does not flatter it.

### Quote Requests
⚠️ **No quote-to-order conversion.** Nothing links an `rfq_request` to a deal; requests are re-keyed
into DryWare by hand. A rate guessed from matching company names would be worse than none, so it is
absent by choice. ⚠️ **No map** — the survey stores an elevation and a typed location, not
coordinates.

### Sales Pipeline
🔴 **Reports value and confidence, NOT a stage funnel, and that is a finding rather than a
shortcut.** Checked 2026-08-21: of 479 `deal_stage_history` rows, **402 are `actor: 'dryware-sync'`
seed rows** written when each deal was materialized. The remaining 77 are one person between
21–29 July and nothing since, and they read as trialling — `quoted→follow_up` 23 times,
`follow_up→quoted` 21 times back, plus a `won→verbal` and a `lost→verbal` undo. Every deal currently
sits in `quoted`. A velocity chart off that shows clicking, not selling. `lib/deals.ts` already said
so: *"the closest true read of 'stage' this board has (it forecasts by confidence, not kanban
stages)"*. **If the board starts being used, re-check the actor split and add velocity — the history
is already recording it.**

⚠️ `rep_contact` holds the rep's NAME; `rep` is empty in this data. Reading `rep` gives a report of
blanks. ⚠️ Deals mirror DryWare, which wipes and reloads on sync — a current read, not a ledger.

### Installed Base
Warranty state comes from `lib/equipment.ts`, never re-derived, so this and a unit's own page cannot
disagree. An explicit `warranty_end` wins; otherwise the term counts forward from **ship** date
(not install, despite that column existing), defaulting to 12 months. The range filters SHIP date;
the expiry list ignores it on purpose — a unit shipped three years ago expiring next month is
exactly what you want to see.

### Portal Adoption
⚠️ **Counts PEOPLE, never sign-ins.** `login_events` records sign-ins, not sessions: someone who
signs in once and works all week counts once, someone bounced by an expired session counts twice in
a minute. A sign-in count measures session length as much as use.

🔴 **"Never signed in" joins on `login_events.user_id` → `profiles.id`.** An earlier version matched
`profiles.display_name` against the login *email* and reported **10 of 11 staff as never having
signed in when the true answer was 2** — `display_name` holds a person's name, which never equals an
email address. Caught by re-deriving the number independently, not by reading the code.

Measured against `profiles`, not `employees`: that table is not staff-only (every customer invite
adds a row), so counting there would report customers as staff who never logged in.

### Engineering
_Added 2026-08-26. See `docs/engineering.md` for the section it reports on._

🔴 **Every hours figure is printed next to its COVERAGE.** Target hours are null wherever the
lead-time workbook publishes none, and actual hours are null until somebody logs them. A median over
four of nineteen tasks is a true statement about a small sample, and printed bare it becomes a claim
about the department. The tile strip carries an explicit "Hours coverage: N%" line for that reason.

⚠️ **A task with no due date is EXCLUDED from on-time percentages, not counted as on time.**
Otherwise the cheapest way to improve the number would be to stop setting dates.

⚠️ **`skipped` ("Not required") tasks are excluded from completions.** Marking one was a correct
decision, not a delivery — counting it would make skipping things the cheapest way to raise the score.

**Target vs actual reads targets off each TASK, not off the live playbook.** A task snapshots its
target when it is created, so a step compares against the standard that applied when the job started
rather than one edited afterwards. Ad-hoc tasks (step keys prefixed `custom:`) are excluded from the
per-step table so one-off work cannot distort a standard step's figure.
