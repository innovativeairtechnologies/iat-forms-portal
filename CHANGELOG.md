# Changelog

Notable changes to the IAT Forms Portal, newest first. Dates are deploy dates.

## 2026-07-22 — Hardening pass 2: access-control fixes, shared AI client, plainer Gantt copy, backups

**Security fixes.** `/tools/*` now bounces customers to `/customer` (a customer session could open the
internal US Rotors pricing calculator). `updateTicket` writes an explicit field whitelist
(status/priority/owner_id/resolved_reason) instead of forwarding the whole client object. The employee
detail page redirects customer ids to `/admin/customers`, and the role-change API refuses customer
targets — together they close a path that coerced a customer into a staff role and could lock them out
of their portal. `GET /api/employees` (an unused route) now requires a non-customer role — it had handed
the staff name/email/phone roster to any signed-in session. `scripts/check-perm-seed.mjs` hardened to
catch schema-qualified INSERTs, block-comment INSERTs, and DELETE/TRUNCATE/UPDATE.

**Shared Anthropic client.** All 10 server-side AI call sites now import one `lib/anthropic.ts` instead
of each constructing an identical client (behavior unchanged; model/tokens/system stay per-call).

**Gantt wording.** Plainer P80 copy on the print sheet, confidence panel, and editor — quote the
"80% confident by" date, never the middle plan date, and confirm with the project lead before committing
to a customer. Advisory only (the feature is already admin-only).

**Backups.** New `scripts/backup-db.mjs` (off-Supabase logical dump to a gitignored `backups/`) plus
`docs/backup-restore.md` covering the restore test and enabling Supabase managed backups + PITR.

## 2026-07-22 — Hardening: centralized email senders, US Rotors order-API guard

**Email senders centralized** (`lib/email-from.ts`). Every Resend sender now reads from a single
`EMAIL_FROM` map that defaults to the shared `onboarding@resend.dev` sandbox and flips to the real
`dehumidifiers.com` addresses purely by env var — no code deploy — once the domain is verified. Set
`RESEND_FROM_SUPPORT` (support/ticket/troubleshooting mail), `RESEND_FROM_PORTAL` (portal/system
mail; the legacy `RESEND_FROM` is still honored as its fallback), and `RESEND_FROM_FORMS` (form
notifications) in Vercel when the domain is live. Ticket notifications also gained an optional
`SUPPORT_NOTIFICATION_EMAIL` (comma-separated) CC list so the support desk / PM can be added without
a code change. Behavior is unchanged until those vars are set.

**US Rotors order API hardened.** `POST /api/us-rotors/orders` previously gated only on "is someone
logged in," so any authenticated principal — including an external customer calling the API directly
— could insert an order even though the feature's nav is hidden and the GET/PATCH handlers already
role-gate. The POST now uses the same `requireUsRotorsActor()` guard (rejects anonymous and
`customer` roles); the employee order form is unaffected.

Docs: README company name corrected to Innovative Air Technologies.

## 2026-07-21 — Sales pivot: DryWare is the source of truth; Deals→CRM, Projected Sales→Performance

The sales pipeline stops being a monday.com spreadsheet mirror and becomes a **materialized view
of the DryWare "projected sales" feed** (migration `063_deal_dryware_key.sql`). On every DryWare
sync the `deals` table is refreshed from the feed (`lib/dryware-deals.ts`): DryWare owns the facts
(customer, $, confidence, close date, salesperson, unit models), the portal preserves the workflow
overlay (stage, ★ focus, follow-ups, notes) across syncs keyed by a stable
`project_customer|project_name` key, and projects that drop off the feed are pruned. So one "Sync
now" click on Performance refreshes the CRM Board, Focused, Calendar, **and** the `/admin` dashboard
at once. The 441 stale spreadsheet deals were backed up and deleted; the current feed materialized
to ~335 deals ($55.6M / $12M weighted across 5 reps).

Nav + structure: **Deals → CRM**, **Projected Sales → Performance**. The CRM view is now just
**Board / Focused / Calendar** — the in-CRM Dashboard tab (redundant with the `/admin` command
center, which now shows the DryWare-fed numbers), the Table tab, and the Companies tab were removed.
New Deal reverts to a plain customer field for the occasional off-DryWare deal (dryware_key NULL,
never touched by sync). The Phase-2 companies/contacts layer is dormant (tables + API kept, UI
removed). Write-up: `docs/deals.md` (top).

## 2026-07-21 — CRM Phase 2: companies & contacts, human-gated backfill, monday cutover tooling

The relational account model (migration `062_crm_companies.sql`): new **`companies`** (unique
normalized name as the dupe guard, kind, optional link to the support-portal customers row) and
**`contacts`** tables, with `deals.company_id`/`primary_contact_id` FKs. `deals.customer` survives
as a derived display cache — linking rewrites it to the company name, renames cascade — so every
existing view and analytic is untouched.

The old CRM tab is now **Companies**: account roster with deal/contact rollups, a per-company
drawer (fields, contacts, linked deals, merge, delete), and the **"Review & link"** panel — a
two-phase backfill that clusters the 441 free-text customer strings (177 clusters via the new
conservative normalizer in `lib/crm-normalize.ts`; branch offices like "H&H Nashville" are
*suggested*, never auto-merged) for human review before anything is written. Commit links deals,
moves parenthetical hints into empty job names, seeds contacts from rep_contact, and is idempotent +
audit-logged. The same panel is the standing tool for future unlinked deals.

New Deal's customer field is now a company combobox and the server exact-matches or auto-creates a
prospect, so **every new deal lands linked**. The deal modal gained a Company & Contact section
(link/change company, primary contact picker, quick-add contact). The xlsx importer's carry-over
identity now normalizes company names (canonical renames would otherwise break every re-import),
carries the new FKs, and auto-links remaining rows by exact match only. All routes ship under the
existing `deals` permission via a new `requireCrmAuth` guard — no new permission seed.

**Cutover to retire monday.com** (runbook in `docs/deals.md`): final export → replace-import →
Review & link → hand-link portal customers. The review pass needs a human — nothing merges without
approval.

## 2026-07-21 — CRM Phase 1: real pipeline stages + drag-and-drop Board

First phase of the CRM master plan (portal replaces monday.com as the sales source of truth).
Deals now carry **named pipeline stages** — `lead → quoted → follow_up → verbal → won/lost`
(migration `061_deal_stages.sql`, applied via Supabase CLI) — with a **`deal_stage_history`**
table logging every transition for future funnel/conversion analytics. Existing 441 deals were
backfilled from status + checklist (407 quoted / 32 lead / 2 won) and each seeded one history row.
`status` (Won/Lost/null) survives as a synced compatibility shadow so every existing analytic is
untouched; reopening a closed deal restores its last open stage from history.

New **Board tab** on `/admin/deals`: a Quiet-Precision kanban (`@hello-pangea/dnd`, already in the
bundle — no new deps) with weighted-$ column headers, biggest-deals-first cards capped at 40 per
column, search + rep pills, Lost collapsed to a drop rail, and a **closed-reason prompt** on
Won/Lost drops (reasons stored in the new `closed_reason` column for win/loss reporting). The deal
modal gained a stage stepper + inline reason picker, the 5-step checklist demoted to a collapsed
"Process Checklist" accordion, stage history merged into the activity feed, and new fields:
**`expected_close`** (real date — backfilled from the free-text `projected` for 158 of 162 deals by
`scripts/backfill-expected-close.mts`), **`next_step`** and **`next_step_due`**.

Under the hood: the deals PATCH API now returns the full updated row and `DealsClient.persist()`
folds it into the optimistic state behind a per-deal in-flight counter — fixing a latent drift where
server-derived fields never reached the client. The xlsx importer derives stages on fresh rows and
its replace-mode carry-over now preserves stage, stage age, the new columns, and re-parents stage
history. Write-up: `docs/deals.md` ("Pipeline stages & the Board").

## 2026-07-21 — Sales dashboard: a dedicated command center for the Sales role

Sales profiles now land on a purpose-built dashboard at `/admin` instead of the generic
`DepartmentDashboard` — the **first department separated out** (admin, engineering and the other
scoped roles keep their current dashboards until each gets its own). It's a **one-screen command
center** (no page scroll on desktop; relaxes into a scrollable stack below `lg`): six KPIs across
the top, then a 4×3 grid — rep leaderboard, deals-by-status and pipeline-by-industry donuts,
a pipeline-by-confidence funnel, **largest open deals**, a quoting-activity trend, forecast
projections (run rate / best / commit), recently won, and derived needs-attention.

Everything is live from the `deals` table via `lib/deals.ts` (new `industryStats` +
`salesProjections` helpers). The three things the board can't feed yet — a sales goal/quota line
and lead/meeting activity — show an honest *"not tracked yet"* state rather than invented numbers.
New shared, **server-safe** chart primitives in `components/dashboards/sales-charts.tsx`
(`SalesDashboardView` composes them; hand-rolled SVG/CSS, no chart library). The dashboards adopt a
measured amount of color — colored KPI chips + multi-hue category donuts — drawn only from the
sanctioned Tone palette, a scoped and documented departure from DESIGN.md's one-accent rule (§2.4
carve-out). Write-up: `docs/dashboards.md`. Commit `08328b8`; prod alias `iatportal.vercel.app`
verified.

## 2026-07-21 — Company Home redesign: the "Lobby"

Rebuilt `/home` from the single-screen bento into a warm, scrolling **lobby** that matches the
shipped dashboard chrome (`/admin`, `/employee/profile`) instead of standing apart from it: a
`zinc-50` canvas with a soft ambient emerald glow, an **emerald→teal gradient greeting hero** with
quick-link buttons, a **company at-a-glance KPI row** (Teammates · Days incident-free · Open roles ·
Next holiday), and equal-height white `rounded-xl` cards for News (featured lead + list), This Week
(holiday + events + who's-out), Our People, Milestones, Open Positions (+ referral), the weekly Core
Value, and the Suggestion box. One emerald accent, used warmly; full light/dark.

No data or routing changes — every card is still live from Supabase with the same "CMS with sensible
defaults" fallbacks. Two small data additions: a live active-staff **`headcount`** (Teammates KPI)
and an editable **`SAFETY.since`** date in `lib/home-content.ts` that drives the auto-incrementing
"days incident-free" counter. The whole design lives in one file — `app/home/HomeContent.tsx`.
Write-up: `docs/company-home.md`.

*Follow-up (same day):* the footer fun-fact chip now **wraps** to show the whole fact instead of
truncating with an ellipsis (`FunFact.tsx`), and was retoned to the zinc/emerald footer.

## 2026-07-20 — Internal Apps: Gas Burner Selection Guide + "Tools" renamed

Added the **Gas Burner Selection Guide** (`public/tools/burner-selection-guide.html`) to the
internal-app launcher. It sizes the AH-MA gas burner length, plenum height, profile-plate gap, and
gas pressure-tap differential from the desiccant wheel and reactivation duty on a job's flow diagram
(with an optional drag-and-drop OCR auto-fill from the flow diagram), and exports a submittal-ready
PDF. Registered as one entry in `lib/tools.ts` (the single source of truth), so it appears in both
`/admin/tools` and the employee launcher (`/employee/resources/tools`); it carries the "New" badge,
which moved off the older Duct Traverse entry.

Renamed the launcher from **"Tools & Apps"** to **"Internal Apps"** everywhere it's user-facing —
admin sidebar, employee sidebar, both page headers, the ⌘K command palette, and the permissions-matrix
label — so it's no longer confused with **Tool Crib** (the warehouse tool check-out registry), which
sat one word away in the permissions matrix. The route (`/admin/tools`, `/tools/*`) and the `tools`
permission are unchanged, so no middleware or seed changes were needed.

## 2026-07-20 — Projected Sales: live sync from the Dryware reporting API

New `/admin/projected-sales` page mirrors the "projected sales by project" feed from the external
**Dryware** system (`dryware.dehumidifiers.com`) — the portal's first live *outbound* API
integration. Sales opens the page and clicks **Sync now**; the server GETs the feed (HTTP Basic auth
via the `DRYWARE_AUTH_HEADER` env var — server-only, never in code), de-duplicates it, and mirrors it
into a new `projected_sales` table (migration `059`). The page reads from that table, so data loads
instantly, persists between syncs, and survives Dryware being down; a one-row `projected_sales_sync`
log drives the "last synced" line. The swap is **atomic** (a Postgres function replaces the whole
table in one transaction) and **fail-safe** (a failed fetch never wipes the last good snapshot). Every
sync is audit-logged. Gated on the existing **`deals`** permission — Sales + admin, no new permission
to seed.

The Dryware endpoint currently returns every project row **twice** (a JOIN fan-out on their side;
flagged to their dev); we collapse byte-identical rows on ingest, so the page shows each project once
and surfaces both counts ("95 projects · from 190 source rows") rather than hiding it. Verified
end-to-end against the live endpoint before ship (190→95 rows, ~$18.9M quoted / ~$5.7M weighted, ~1s
round-trip). Full write-up: `docs/projected-sales.md`. Deferred: a scheduled ~6am auto-sync (via
Supabase pg_cron) — manual "Sync now" only for v1.

## 2026-07-20 — Company Home: real core values, one featured per week

The Core Values tile now carries all nine of IAT's actual core values (from
dehumidifiers.com/core-values) and features **one per week** — "Core Value of the Week."
It auto-rotates each Monday (Eastern), holds steady all week, and cycles through all nine
(`coreValueOfWeek()` in `lib/home-content.ts`). A manual "pin one for the week" override
(admin picks it, it stays) is a planned follow-up.

## 2026-07-20 — Company Home: single-screen bento dashboard

Redesigned Company Home from a scrolling stack of cards into a **single-screen bento dashboard** —
on desktop it pins to the viewport and never scrolls the page; the two content-heavy tiles (news,
open positions) scroll inside themselves so nothing is lost. A gradient header band carries the
greeting, the "did you know" fun-fact chip, and an Email-IT shortcut; below it a 3×2 grid of tiles,
each with a soft-wash tone accent (news = sky, calendar = violet, positions = emerald, birthdays =
amber, people = brand, values = rose, suggestions = violet). New Employee + Employee Spotlight are
merged into one "Our People" tile; small touches — a time-of-day greeting emoji, a next-holiday
countdown, a one-time fade-up entrance (reduced-motion aware). Both shells pin the grid to the
viewport per-shell (the employee shell subtracts its 56px top bar), since the shells themselves are
built to body-scroll. Below `lg` it relaxes into a normal stacked, scrollable column. Full write-up:
`docs/company-home.md`.

## 2026-07-20 — Company Home: shared intranet landing inside the portal

The SharePoint intranet homepage is rebuilt inside the portal (Quiet Precision design) — company
news, a calendar, birthdays & anniversaries, newest hire, who's out, open roles, and a suggestion
box. **Every internal role now lands here first after login** (`landingForRole`, replacing the old
direct-to-workspace redirect); customers are unaffected and still land on `/customer`. It renders
**inside the portal shell** — the sidebar is present with "Company Home" the active tab — so it's a
per-shell route (`/admin/home` for admin-surface roles, `/employee/home` for base employees), and
the rest of the workspace (Dashboard, Tickets, …) is one sidebar click away.

Content is "CMS with defaults": cards read live from `announcements`, `company_events`,
`job_openings`, `employee_spotlights`, and `employees.birthday` (migration
`058_company_home.sql`), falling back to typed defaults in `lib/home-content.ts` whenever a
table is empty — `/home` is never blank. People-derived cards (anniversaries, newest hire,
who's-out) read existing `employees`/`time_off_requests` data, nothing new. Authors manage
content at `/admin/home-content` (System → Company Home, new `home_content` perm, grantable to
scoped roles from `/admin/permissions`). Full write-up: `docs/company-home.md`.

Both the DB migration and its RLS follow-up patch were verified live before this deploy — see
the entry below.

## 2026-07-20 — Supabase CLI set up; closed customer-read gap on company-home content

The Supabase CLI is now installed (`iat-forms-portal` devDependency), linked to the live
`iat-forms` project, and its migration history repaired to match the 58 migrations already
applied by hand — future migrations can go through `supabase db push` instead of the manual SQL
editor. See `docs/company-home.md` for CLI usage notes.

While verifying migration state against the live DB, confirmed `058_company_home.sql` had in
fact already run (contrary to stale notes saying otherwise) but its known RLS security patch
had not: `announcements`, `company_events`, `job_openings`, and `employee_spotlights` still
granted `authenticated` SELECT, letting a logged-in *customer* session read internal-only
content directly via PostgREST. Ran the documented `DROP POLICY` statements to close it — RLS
stays enabled, app reads are unaffected (they go through the service-role client). Full
write-up: `docs/company-home.md`.

## 2026-07-17 — Production Board: first-class projects under each department

**Needs migration `056_production_projects.sql` run before deploy** (the board and
`/admin/production` query `production_projects` and 500 without it). Extends the board shipped
earlier today. Full write-up: `docs/production-board.md`.

A department now **contains projects**. Until now "project" was a free-text label on a task,
grouped at render time; now it's a real `production_projects` row with a name, free-text
`type`, `detail`, a `status` (active/complete), and a display-only `people` list ("who's on
this build"). Tasks gain `project_id` (NULL = a department-wide **standing duty**, the new
tell for `isStanding` — the old `project` text is deprecated) and an optional `phase` ("Day 1",
"Framing") that sub-groups a project's tasks.

The point: **two builds can share a task list yet track separately.** One department QR shows
standing duties first, then each active project as its own section with its own progress;
`/board/<token>?project=<id>` focuses one. The headline feature is a **Duplicate** button —
copies a project and its task list (titles/details/phases/cadence/priority carry over;
status, done-state, due dates and assignees reset for a fresh build), since most builds start
from a near-identical checklist.

Connected people are **display-only by product decision** — they tag who's on a build but do
NOT narrow the assignee picker, which stays the whole department roster.

`production_projects` is RLS-on / no-policies (service-role only) like every board table — an
anon read policy would expose project rows and, joined, the department tokens. The public
check-off route now also refuses a task whose project is complete/archived, so a stale board
link can't tick off a finished build's work. Cross-department writes are still re-proved
against the token's department.

Demo re-seeded (`scripts/seed-production-board-demo.mjs`) into the two-project scenario:
**Acme Unit A** (dated) and **Beta Unit B** (a fresh duplicate) under Production, both running
the 6-day build phased Day 1–6, plus two standing duties and a starter roster. 21 logic
assertions cover the new project/phase grouping; `groupByPhase`/`buildBoard` are the shared
source both surfaces read.

## 2026-07-17 — Form builder: a WYSIWYG "Form view" for editing long forms

Editing a 100–200-field form as one flat stack of identical rows was brutal, so the builder
(`/admin/forms/*/edit`) gets a second view, toggled in the toolbar: **Form view** (new default)
and **List** (the original flat editor, kept unchanged as a fallback). Both write the *identical*
save payload — no schema change, no migration.

**Form view** groups fields into collapsible **sections** (split on Section Header fields), with a
left **outline** to jump around long forms and per-section counts. Each field renders as a WYSIWYG
preview of its real control and is edited inline. Drag reorders within *and across* sections;
sections move as a block. Forms over ~40 fields open collapsed so the overview comes first.

Two real wins over the old right-hand panel:

- **Conditional logic is visible and editable in place.** Every conditional field wears a badge
  (`Heat Type = Electric`), controllers show a "drives N" badge, and the value picker is a chip
  multi-select that finally exposes the **"any of"** capability `show_when_value` always supported
  (pipe-separated `Electric|Natural Gas`) but the old single-`<select>` UI hid.
- **Live warnings for the two label-keyed traps** the model is prone to (see
  `docs/form-conditional-fields.md`): **duplicate field labels** (answers collapse into one and lose
  data) and **dangling/stale `show_when_field`** — the condition that *erases* instead of gating, the
  same failure mode that hid 22 Performance Review questions for ~5 weeks. Neither was caught before.

New code is isolated to the builder: `components/admin/FormCanvas.tsx`,
`components/admin/form-builder-shared.ts`, and the toggle in `components/admin/FormBuilder.tsx`
(also retokened to the DESIGN.md semantic tokens). Verified by mounting the real builder against a
multi-section form seeded with duplicate + dangling conditions before shipping.

## 2026-07-17 — Production Board: a no-login, per-department shop checklist

**Needs migration `055_production_board.sql` run before deploy** (the board and
`/admin/production` both 500 without the tables). Full write-up: `docs/production-board.md`.

A checklist the floor opens by **scanning a QR code — no portal login**. Departments
(Production / Fabrication / Electrical, seeded but editable) each get their own board at
`/board/<token>`; the manager runs them from `/admin/production` behind the new
`production_board` perm.

**Public the same way `/support` is** — `middleware.ts`'s `matcher` is an allowlist and
`/board` isn't on it. Nothing else makes it public, and nothing else protects it: **the URL
token is the credential**, and the name recorded against a check-off is typed on the floor
and unverified. That's the accepted trade for a floor with no accounts, and it sets the rule
for content — **shop work only, nothing you wouldn't pin to the break-room wall.**

The token is 43 chars / 244 bits, minted by the DB (`prod_board_token()`), never sent to the
client, and rotatable from the QR modal (which kills every printed label for that board).
The tables are RLS-on/no-policies — **service-role only, deliberately**: an `anon` read policy
on `production_departments` would expose it over PostgREST, and one request with the
publishable key would dump **every token at once**. Added `noindex` + `Referrer-Policy:
no-referrer` on `/board/:path*` — this app has no `robots.txt` at all, and unguessable
isn't unindexed.

**Standing duties and job work share one table**; `project IS NULL` is the only difference.
Free text on both `project` and `assignee` because there is **no deals → equipment → shop
link in this schema** to FK to, and `employees` holds no floor staff (12 rows, 4 of them
customers, 7 with a null department) — so the roster is its own table of names, not accounts.

**Recurring tasks reset without a cron:** `done_on` stores the *shop-local* date
(`America/New_York`) and a daily task counts as done only while that's today. Keying it on
UTC would have reset the board at 8pm local, mid-second-shift. One implementation —
`effectiveDone()` in `lib/production.ts` — 41 assertions cover it.

`board-check` is rate-limited at 240/10min rather than the house 5–10 for public writes:
the whole shop shares one NAT IP, so the house default would lock the floor out by 9am.
`rateLimit` fails open anyway and is not the control here.

Perm named `production_board`, **not** `production` — that's already a StaffRole (the base
floor tier); same collision class as `tools` vs `tool_crib`. Registered in all five places,
including the `role_permissions` INSERT in `055` that actually grants it.

## 2026-07-16 — Performance Review: 22 department questions were unfillable for ~5 weeks

**Data fix, no code change** — `node scripts/add-perf-review-department-field.mjs --commit`
(dry-run by default, idempotent). Applied to `performance-review-form` and the inactive
`perf-new` copy.

`scripts/update-performance-review.mjs` (2026-06) gated 22 department-specific rating +
explanation fields on a controlling field labeled `Department` — **which never existed on
the form.** The form was hand-built in the builder, so there was no seed to add one to, and
nothing in 314 commits ever created it. `isFieldVisible` reads `answers['Department']`,
which was therefore `undefined` forever, so **all 22 questions were permanently hidden and
nobody could fill them in.** The gate didn't gate; it erased.

Why nobody caught it: **the print views looked correct**, because they fabricate the
controlling answer — `app/print/forms/[id]/page.tsx` reconstructs the department list from
the distinct `show_when_value`s when the controlling field is missing, and
`BlankFormPrint.tsx:145` injects `{ [controllingLabel]: dept }` as a synthetic answer. The
blank questionnaire printed fine while the live form showed nothing.

It was a regression, and it's dated: the **2026-07-07 submission answered two of the
now-hidden fields** (`Office: Accuracy and organization…` = "Superstar"). Before the gating,
every department's questions showed to everyone and the reviewer filled in the relevant
ones — which is also why that submission carries no `Department` key.

**The fix** adds the missing required `select` labeled exactly `Department` at the end of
*Employee Information* (sort_order 3, beside Employee Name / Review Date), shifting the rest
down. Options are **not a free choice** — they're dictated by the form's own questions:
`Office, Engineering, Sales, Marketing, Production, Management`, the distinct
`show_when_value`s on the 22 fields. The script asserts coverage both ways (exits non-zero
if a gated field awaits a value the select doesn't offer; warns if an option has no
questions), which is precisely the guard whose absence caused this.

Verified against the live rows through the real `visibleFields`: all 22 fields reachable,
each by exactly one department, zero cross-department leakage — and confirmed on prod
(picking a department grows the form 11 → 12 steps and reveals only that department's
questions).

Noted, not fixed: three other portal forms each use a **different** department list
(Shipping/Receiving, Administration, Quality Control, IT & Facilities), and
`employees.department` is unset for 9 of 12 people. The perf review has no questions for
those departments — a content gap for Jacob, not something to invent.

## 2026-07-16 — IDP Pre/Post Test Report rebuilt from the live JotForm (18 → 253 fields)

The portal's copy had drifted badly: 18 flat fields, no sections, while the live JotForm
(`232424923646155`) had grown to **230 fields across 21 sections with 19 conditional
rules**. Rebuilt via `scripts/update-idp-test-report.mjs` (dry-run by default, `--commit`
to apply). The form now renders as a **30-step wizard** (32+ once branches open); the two
existing submissions are untouched — they carry no FK to `form_fields`.

Three things the portal's form model couldn't take verbatim, and what was done:

- **Duplicate labels are data loss, not cosmetics.** Answers are keyed by field *label*
  (`lib/forms.ts`), and the JotForm reuses labels heavily — `Notes` ×12, `FLA` ×5,
  `Control Type` ×4. Ported as-is, React Motor Notes would overwrite Air Flows Notes. Every
  label is now section-qualified (`React Motor Notes`, `Pre Heat FLA`). The rebuild script
  asserts label uniqueness, that no condition points at a missing field, and that each
  gated value actually exists on its controlling field — it exits non-zero otherwise.
- **`show_when_value` now accepts several values**, pipe-separated (`Electric|Natural Gas`),
  for the three React Heat fields JotForm shows under both. Single values behave exactly as
  before; no migration (the column is already `text`).
- **`control_matrix` has no portal equivalent.** The PXR controller table (4 rows × 9 cols)
  is flattened to 4 sections × 9 fields, gated on `Controller Type = PXR`.

Fixed while porting (both were accidents in the JotForm, confirmed with Jacob):

- **React Heat `Notes` was gated to `Hot Water` only** — techs running Electric, Natural Gas
  or Steam had nowhere to write React Heat notes.
- **Controllers `Notes` + `Photos` were gated to PXR/Carel only** — Automation Direct,
  Siemens and Allen Bradley units couldn't attach controller photos at all.
- **`Current inlet steam pressure?` had no condition** and showed on every unit, including
  electric ones. Now gated to `Heat Type = Steam` with the rest of its block.
- Form description said IDP = "Industrial Desiccant Products"; it's **Integrated
  Dehumidification Package** (per `scripts/kb-reference/iat-unit-nomenclature.md`).

Two engine fixes this shook out, both benefiting every form:

- **Conditions now resolve up the whole chain.** IDP has real 2-level cascades
  (`Heat Type → Amps? → the no-amps checklist`). Previously a stale answer to a
  now-hidden controlling field stranded its dependants on screen — answer Electric/No,
  switch to Steam, and the no-amps checklist stayed. Cycle-guarded.
- **`groupFieldsIntoSteps` rendered a literal `"null (Cont.)"`** as the section label when
  fields before the first section header spilled past one step. Latent for any such form;
  IDP was the first big enough to trigger it.

Section headers can now carry a **description** (reusing `placeholder`), shown under the
step title and editable in the form builder — this is what carries JotForm's React Heat and
Pre-Cooling Coil explanatory blurbs across.

## 2026-07-16 — Ticket notes follow the `tickets` perm; note authorship recorded

`sales`/`engineering`/`production_manager` could reassign a ticket but **401'd posting a
note** on it. `requireTicketAccess()` — the single boundary behind all four dual-auth
ticket routes — now resolves a third caller, `staff` (holds `tickets`, read live from the
matrix). `admin` is tried **before** `staff`: admins hold every perm, so the other order
would downgrade them into the internal-only branch and cost them customer replies.

- **Internal notes only for scoped roles.** Forced `visibility='internal'` server-side,
  ignoring the client — the same mechanism that forces a customer's note public/customer.
  The "Reply to customer" toggle is hidden for them, but that's honesty, not the control.
  Replying to a customer under IAT's name stays an admin act. Note DELETE stays admin-only.
- **Attachments too** — upload/download/preview. They could previously see an attachment's
  name and size in a note but 401 opening it.
- **Reading internal notes was already open** to any `tickets` holder (the page
  server-renders them via `supabaseAdmin`, ungated), so nothing new is disclosed here.
- **Authorship (migration `054`, pending).** `ticket_notes` recorded only `author_type` —
  every staff note was an anonymous "admin". Adds `author_id` (FK `auth.users`, not
  `employees`) + snapshotted `author_name`, resolved from the session, never the body.
  No backfill: older notes stay unattributed rather than get a guessed author.
- **Closed in passing:** notes are read with `select('*')`, so `author_name` would have
  shipped **staff names to customers**. The GET strips `author_*` for customers and the
  customer ticket page now lists columns explicitly.

⚠️ `054` is additive and **nothing breaks without it** — the insert falls back to saving
notes unattributed. That fallback keys on `PGRST204` **and** `42703`: PostgREST returns
`PGRST204` for an *insert* with a missing column (`42703` is what a *select* returns), and
handling only the latter would have 500'd every note save until the migration ran.

Verified: `tsc --noEmit` + `next build` green; read-only live-DB checks confirmed the
customer column list is valid and leaks no author identity, `054` is not yet applied, and
the real error codes. Probes left zero rows in prod.

## 2026-07-16 — Tickets follow the `tickets` perm; last `is_admin` readers removed

⚠️ **Two findings that invert the earlier write-ups.** (1) The `is_admin` drift everything
called hypothetical is **already live in prod**: `jacob.younker@dehumidifiers.com` (Jacob's
own admin account) and `jacob@dehumidifiers.com` both have `profiles.role = 'admin'` with
`is_admin = false` — promoted by hand in the Supabase dashboard, which skips both writers.
It runs **fail-closed** (zero rows are `is_admin = true` with a non-admin role), so nobody
ever gained access; two real admins were **denied** — silently missing admin digests and
every new-ticket/PTO notification, and unassignable on tickets. The code below fixes them
with no migration. (2) `is_admin` does **not** have zero authorization readers — the RLS
policies still gate on it (see the ⚠️ below). Migration **`053` (pending)** resyncs the
column for those policies' sake.

The ticket-owner picker listed `is_admin = true` staff only, so **only full admins could
own a ticket** — even though `sales`, `engineering` and `production_manager` hold the
`tickets` perm, are let onto the ticket page by middleware, and work the queue daily.
Behind it sat a second bug: `updateTicket` gated on the strict full-admin
`getAdminUser()`, so those roles saw a status/priority/owner form that **always failed on
save**. Both now follow the `tickets` perm, read from the live matrix:

- **`getEmployeesWithPerm(perm)`** (`lib/staff.ts`) builds the picker — "everyone who can
  work this ticket", moved by `/admin/permissions` with no deploy. Fails **closed**
  (empty list), the deliberate inverse of `getCustomerIds()` next to it. Customers and
  profile-less rows are excluded by holding no permission, so no extra filter is needed.
- **`getTicketsActor()`** (`lib/admin-auth.ts`) guards the write — the **second scoped
  write exception** after Deals, and the server-action counterpart to the matrix-backed
  route guards in `lib/api-auth.ts`. Audit logging unchanged.
- **`getAdminRecipients()`** (`lib/staff.ts`) re-sources admin notification email (daily
  digest, `/api/tickets`, `/api/requests`) from `profiles.role = 'admin'`, so a demoted
  admin stops receiving it immediately. It **throws** on an unreadable `profiles` table;
  the two routes catch and fall back to `ADMIN_NOTIFICATION_EMAIL` rather than 500 a
  request whose row is already committed.

Also fixed: `/api/tickets` and `/api/requests` never filtered `is_active`, so
**deactivated admins were still being emailed**; and an owner who no longer qualified had
no matching `<option>`, making an owned ticket render as unassigned (the current owner is
now always kept in the list).

⚠️ **`employees.is_admin` is kept, and the RLS policies are why.** No application code
reads it now, but migrations `001`/`007`/`022` gate `employees`, `time_off_requests`,
`accrual_log` and `us_rotors_orders` policies on it — real access decisions at the DB
layer, mostly dormant only because the server uses the service-role key. Postgres refuses
to drop a column its policies depend on, so rewriting them to join `profiles.role` is a
tracked follow-up. Ticket **notes** stay admin-only (`requireTicketAccess`, the shared
dual-auth boundary) — a scoped role can reassign a ticket but still 401s posting a note;
widening that needs its own decision.

Verified: `tsc --noEmit` + `next build` green; picker/write predicates exercised against
the real `lib/roles.ts` across 13 roles × 5 matrices (150/150), negative-tested by
replaying the old admin-only predicate (reproduces the bug, 24 failures). Read-only live
DB check against the real matrix: picker **4 → 7** (loses nobody), admin mail **4 → 6**,
**0** customers listed despite 4 customer rows in `employees`. No code depends on `053`.

## 2026-07-15 — Admin sidebar color + cool-graphite dark mode

Gave the admin left nav a color identity and retoned dark mode:
- **Light mode:** the sidebar rail is now **deep pine** (a desaturated, warmed brand-green
  950) instead of the plain warm canvas — a dark rail on the light canvas, so the green
  active-row indicator and status pills finally pop. Brand green stays a pure accent (active
  row + 2px left indicator), never a background fill.
- **Dark mode:** the whole dark theme was retoned from the old **warm near-black** to a
  subtle **cool graphite** (blue-slate) surface ladder — canvas, cards, table header bands,
  chips, hairlines, and the nav rail all share one cool family, so dark mode reads as a
  single deliberate surface. In dark mode the rail joins the graphite family (no green
  field); green remains an accent only.
- New semantic tokens: a `--sidebar-*` family (pine in light, graphite in dark) in
  `globals.css` + `tailwind.config.ts`; documented in DESIGN.md §2.2. Light mode `:root`
  content tokens are unchanged. Scope: `iat-forms-portal` admin shell only — the other
  sub-apps still carry the previous dark palette and will be rolled over separately.

## 2026-07-15 — US Rotors calculator: link out to the Desiccant Simulator

Added a **"Desiccant Simulator" tab** to the pricing calculator's tab nav (right-aligned,
external-link icon) that opens the companion sizing tool at **calculator.usrotors.com** in
a new tab — `window.open(…, 'noopener')`, so it doesn't disturb the current view.

## 2026-07-15 — US Rotors 3D: two-sided casing + process/reactivation zone shading

Bossman tweaks to the 3D model:
- The **aluminum casing look is now on both faces** — the "+" cross, center hub, and
  diagonal corner gussets mirror onto the back, so front and back read identically.
- The **wheel face is shaded by airflow zone** (always on, independent of the "Show
  airflow" toggle): the top-right quadrant = **reactivation (red)**, the other three =
  **process (blue)**, rendered as stationary semi-transparent sectors over the spinning
  media so the spokes still read through. The reactivation arrow + legend key are red to match.
- The **airflow arrows are now bold 3D arrows** (thick cylinder shaft + big cone head)
  instead of thin ArrowHelper lines (which WebGL can't thicken), so they read clearly.

## 2026-07-15 — US Rotors 3D model: photo-accurate rotor + cassette

Reworked the calculator's 3D viewer to match IAT's real desiccant cassettes (from
reference photos of a shipped unit), per bossman:
- **Dark charcoal honeycomb media with thin radial spokes** (was a tan wheel), a bright
  **aluminum rim band**, and a **brushed-aluminum square cassette frame that hugs the
  wheel** — square face plates with a round bore, the structural **"+" cross** meeting at
  a **center hub**, **diagonal corner gussets**, box side walls, and a simplified
  **perimeter drive chain**.
- **Reflective metal** via image-based lighting (three `RoomEnvironment` + PMREM) so the
  aluminum reads shiny, not flat.
- **Airflow arrows are now a subtle "Show airflow" toggle** (off by default, cassette
  only) so the model matches the bare unit; the process/reactivation/purge legend follows
  the toggle.
- Still fully parametric and live off the PO inputs (diameter / depth / product-type drive
  the model and the price together); rotor-only shows the bare spoked wheel. Verified the
  render against the photos before ship.

## 2026-07-15 — Support page focus, /forms retired, live 3D US Rotors model

Batch of misc fixes (Jacob).

**Support (`/support`)**
- **Redesigned into a single "do this" landing page.** One live action — Start a
  support request → `/support/equipment-support` — as a big primary card, with a hero
  headline, three reassurance points, an operational-status strip, and a quiet "coming
  soon" note. Rebuilt on the Quiet-Precision semantic tokens (warm canvas, hairline
  cards, brand green only on the one CTA + focus rings; dark mode auto-themes).
- **Removed the customer-facing "Check ticket status" links** from the support landing
  (header + hero) and the "Track this ticket's status" link on the ticket success screen
  (kept only for logged-in customers, as "View this in my portal"). The `/support/status`
  lookup route stays in place, just unlinked. **Emails left unchanged** (per Jacob).
- **Removed the "Request portal access" CTA** from the end of the equipment support
  ticket — the form is now purely: submit a ticket, our team is notified.

**Public forms directory retired**
- **Deleted the public `/forms` index** (and its now-orphaned `FormsPortal` /
  `FormsBrowser` components). Individual forms still live at `/forms/[slug]`.
- The **"All Forms" / "Back to forms"** buttons now **go back to the page you came from**
  (`router.back()`, with a public `/support` fallback when there's no history — never `/`,
  which would bounce an anonymous filler to `/login`) via a new shared `BackLink`. The
  always-visible top-of-form control is labeled **Exit** (distinct from the step-nav "Back").
  The `PublicHeader` logo is now a static brand mark (was → `/forms`). Smoke test updated.

**US Rotors Pricing Calculator — live 3D model**
- Added an **interactive 3D viewer** to `public/tools/us-rotors-pricing-calculator.html`
  that updates live with the purchase-order inputs: a desiccant **rotor** (parametric
  diameter/depth, hub bore, honeycomb face) and, when "Rotor + Cassette" is selected, the
  rotor inside a **sheet-metal cassette** with process / reactivation / (optional) purge
  **airflow arrows**. Diameter is normalized on-screen; depth stays proportional; stainless
  → metallic finish, segmented → segment lines; the wheel spins. Drag to orbit, scroll to zoom.
- Built in vanilla Three.js (CDN import map, mirroring the `/customer/srv` parametric
  approach); driven by a single `update3D(lastCalc)` call at the end of `recalc()`, so the
  model and the price move together. Degrades gracefully (pricing untouched) if the CDN is
  unreachable. `next build` green; live updates verified across size / depth / type / options.

## 2026-07-14 — Annual Review print sheet: rating words restored + total is /48 (12 questions)

Two corrections to the numeric Annual Review sheet, per Jacob:

- **Superstar / Rockstar / Star / Needs Development are back on the back-page
  Performance Scale** (shown as the numeral + word + description), and the scale
  caption / Development-Plan note reference the words again. The 1–4 numbered
  scoring on every row stays.
- **Total is now `/ 48`, not `/ 80`.** Only the **12 review questions** (Sections
  1–3) count toward the score (12 × 4). The **8 Core Values are no longer scored
  into the total** — they keep their 4/3/2/1 rating for feedback, with a note that
  reads "rated for feedback, not counted in the score." The Total-Score label reads
  "sum of the 12 review questions — Sections 1–3."

Static markup only, no migration. Both sheets still fit one page each (landscape
front 702px / back 706px; portrait front 895px / back 815px), verified by rendering
the real markup. `next build` green.

## 2026-07-14 — Annual Review print sheet: 1–4 point score (no more star-picking)

Reworked the bespoke blank Annual Review print sheet (`app/print/annual-review/page.tsx`)
from a pick-a-rating-word form into a numeric point rubric. No migration; static markup only.

- **Rows are now scored 4/3/2/1.** The four rating columns (Sections 1–3 and the
  8 Core Values) show numbered bubbles **④③②①** to circle; the column headers
  are the numerals **4 3 2 1** (green→red) instead of the old trophy/star/bars icons.
- **Back-page scale is numeric** — the Performance Scale cards show the numeral over its
  plain description; the Superstar/Rockstar/Star/Needs-Development **wording is removed
  entirely** (numbers + descriptions only, everywhere on the sheet).
- **Total instead of a pick.** The old "Overall Performance Rating (Select One)" pill
  row is replaced by a **Total Score ___ / 80** tally (20 scored items × 4). The
  scale caption reads "4 = highest, 1 = lowest"; the Development-Plan note reads
  "for any area scored 1."
- **Coaching-note lines** added to Sections 1–3 (5 / 4 / 3 lines, one per question)
  filling the box beside each grid.
- **Still one landscape page each** (front ≈702px / back ≈706px vs ~758px usable),
  verified by rendering the real markup. Portrait toggle + Download-PDF unchanged.
  `next build` green.

## 2026-07-14 — Mobile audit: no sideways-scrolling lists, headers un-hidden, org chart toolbar

Portal-wide mobile sweep (no migration). Three classes of fix:

- **Page headers no longer start behind the fixed mobile top bar.** The admin
  and employee shells rendered an `h-14` spacer as a *flex-row* sibling, so it
  never pushed content down; the spacer is gone and the content column now
  carries `pt-14 md:pt-0` (`app/admin/layout.tsx`, `AdminSidebar.tsx`,
  `EmployeeShell.tsx`).
- **Every admin list now fits the phone viewport — no left-right scroll.**
  `TableScroll` only enforces its min-width floor from `sm` up, and each list's
  grid template is responsive: phones get a reduced column set (identity +
  status/key metric + age, audit-log style), the full grid returns at `sm+`,
  and column headers hide on phones. Rows stay clickable into their detail
  page/modal, which carries the rest of the data. Converted: Submissions,
  Tickets, Forms, Equipment, Gantt, Customers, Presentations, PTO/Sick
  requests (Approve/Deny wrap onto their own line — no detail page there),
  Employees, Accrual (balances keep their header labels), Troubleshooting,
  US Rotors. Deals Pipeline/CRM/Focused keep the top 2–3 metrics per row
  (customer/cost/status · customer/quoted/status · customer/weighted/open) and
  the Pipeline summary strip shows only Total Value + Weighted on phones.
  Bulk-select, kebab menus, and inline-edit fields are desktop-only
  (`SelectBox` gained a `className` passthrough for this).
- **Forms page was fully broken on phones** — 572px of fixed grid tracks inside
  an `overflow-hidden` card crushed the `1.7fr` name column to zero width,
  leaving just category/toggle/count. Phones now get name / toggle / Edit, and
  the tabs+status-pills header row stacks instead of squeezing.
- **Org chart:** the chart toolbar (title, Chart/List toggle, Edit/Erase, zoom
  cluster) wraps on phones instead of crushing into one 56px row, and the page
  wrapper dropped its hard `h-screen` (it overflowed by the top bar's 56px and
  clipped the canvas bottom).

Pattern notes in `docs/mobile.md`. `next build` green; Playwright smoke suite
9/9 passed; all new responsive utilities verified present in the compiled CSS.
Visual spot-check on a phone still recommended (admin pages are auth-gated, so
the sweep was verified structurally, not eyeballed page-by-page).

## 2026-07-13 — Deals: hand-picked Focused (★), follow-up calendar, rep bands, project type (migration 048)

Four sales-requested changes to `/admin/deals`, plus a new **Calendar** tab
(now five views: Dashboard · Pipeline · CRM · Focused · Calendar).

- **Focused is now a hand-picked list.** A ★ in the Pipeline rows (and the deal
  modal header) toggles `deals.focused`; the Focused tab filters on the flag
  instead of the old derived "confidence≥60 OR projected OR notes" predicate —
  so it clears itself on switchover and reps curate what they're working.
- **Follow-up calendar.** New deals auto-schedule a reminder 2 weeks out
  (Monday-parity automation; date computed in the browser's timezone so it
  doesn't drift on the UTC server). A "Schedule Follow-up" button in the deal
  modal adds dated ones; the Calendar tab is the month grid (overdue = rose,
  due-today = brand green, scheduled = sky, done = muted), with mark-done /
  open-deal / delete. Bulk imports deliberately don't auto-generate.
- **Rep separator cleanup.** Pipeline's group-by-rep toggle → filter pills
  (All / MAIN / JACOB / MIKE / DAVE) + a proper per-rep band (initials, count,
  $ + weighted totals) in "All" mode.
- **Project type dropdown** on the New Deal + edit forms (industry field,
  placeholder set in `lib/deals.ts PROJECT_TYPES`, swappable), shown as a modal
  header chip + field.
- **Migration `048_deal_focus_followups.sql`** (run in the Supabase SQL editor):
  `deals.focused`, `deals.project_type`, `deal_follow_ups` table (RLS on, no
  policies — service-role, same posture as deals). Everything degrades before
  it runs (friendly hints, clean optimistic reverts). Re-import carry-over now
  also preserves focused/project_type/follow-ups (matched by customer+job+group)
  and the import preview discloses them.

Adversarially reviewed (multi-agent) before ship; 12 confirmed findings fixed —
notably the replace-import wiping focused/project_type, New Deal breaking
pre-048, a follow-up temp-id delete/complete race, invalid-date 500s, and design
drift (RepBand gradient, New Deal modal shell, calendar tone/green). `tsc` +
`next build` green; rendering + graceful-degradation verified in-browser. Files:
`supabase/migrations/048_deal_focus_followups.sql` (new),
`app/api/admin/deals/follow-ups/route.ts` + `[id]/route.ts` (new),
`app/admin/deals/CalendarView.tsx` (new), `DealsClient.tsx`, `PipelineView.tsx`,
`FocusedView.tsx`, `DealDetailModal.tsx`, `SalesDashboard.tsx`,
`app/api/admin/deals/route.ts` + `[id]/route.ts` + `validate.ts` + `import/route.ts`,
`lib/deals.ts`, `lib/supabase.ts`, `docs/deals.md`.

## 2026-07-13 — Security: force Next's bundled postcss to ≥ 8.5.10 (Dependabot #26)

Dependabot alert #26 (GHSA-qx2v-qp2m-jg93 / CVE-2026-41305, moderate) flagged
the postcss copy that Next pins for itself at
`node_modules/next/node_modules/postcss` — 8.4.31, vulnerable to XSS via an
unescaped `</style>` in its stringifier output when that output is embedded
into an HTML `<style>` block. Not actually exploitable here (Next only
stringifies our own trusted Tailwind/global CSS at build time — no
attacker-controlled CSS enters that pipeline), but the real fix is cheap.
Waiting on Next wasn't viable: every 15.5.x (including the final backport
release, 15.5.20) pins 8.4.31, and even Next 16.2.10 stable still does — only
the 16.3 canary has moved to 8.5.10.

- New npm **`overrides`** entry (scoped to `next` only) forces its postcss to
  `^8.5.10`; it dedupes onto the root postcss 8.5.16, leaving a **single**
  postcss copy in the entire lockfile.
- npm quirk worth remembering: changing `overrides` does **not** invalidate an
  existing lockfile entry — `npm install`, `npm dedupe`, and
  `npm update postcss` (npm 11.13) all left the stale nested 8.4.31 in place,
  merely flagging it `invalid`. Fixed by deleting the nested entry from
  `package-lock.json` plus the directory, then re-running `npm install`.
- Drop the override once we're on a Next release whose own pin is ≥ 8.5.10
  (16.3+).

No code changes, no migration. Verified: `npm ci` from the updated lockfile
green (`npm audit`: 0 vulnerabilities); `next build` green; Playwright smoke
suite 9/9 against a local `next start` prod server. Files: `package.json`,
`package-lock.json`.

## 2026-07-10 — SRV batch: required failure photos, My Requests, admin per-section view

Fixes to the interactive Start-Up Readiness Verification (`/customer/srv`) and
its admin review, per Jacob:

- **Required failure photo, per item.** Marking any checklist item **Fail** now
  reveals an inline "Photo of this issue required" capture tile directly under
  that item (only on fail); it gates section completion and is validated
  server-side. Stored in `submissions.data` under `<item label> — Failure photo`
  keys (deliberately not in `form_fields`) and rendered inline under the failed
  item on the admin detail page. Note: photo-restricted sites can't submit an SRV
  containing a failure; and these photos appear in the admin web view but not the
  PDF/print export.
- **Electrical "Recorded readings" removed.** The L1–L2 … L3–G voltage inputs are
  gone from the Electrical Power section — in code (`lib/srv.ts`) and in the
  live, admin-edited `srv_config` row (`scripts/strip-electrical-readings.mjs`,
  backup gitignored). The gas section keeps its readings.
- **SRV now appears in the customer "My Requests" list** (matched on the
  `_customer_id` stamp; superseded revisions folded out). A returned SRV links
  back to `/customer/srv?resume=<id>` to fix flagged items.
- **Admin detail: one collapsible card per section.** The former single "More
  responses" accordion is now a card per form section, each with a **red
  fail-count badge** so failures are visible without expanding. (Applies to all
  forms; the badge only shows where a form has "Fail" answers.)
- **Empathetic intro** added atop the SRV intro stage.

## 2026-07-10 — Dependency refresh: Dependabot PR #25 (15 minor/patch bumps)

Merged the Dependabot minor-and-patch group. Notables: `@anthropic-ai/sdk`
0.104.2 → 0.110.0 (all Jerry/AI routes use plain `messages.create`; the
0.105–0.110 releases are additive — new model IDs and managed-agents/beta
surfaces we don't call), `@supabase/supabase-js` 2.108.2 → 2.110.2, tiptap
3.26.0 → 3.27.3, Next 15.5.19 → 15.5.20 (patch), and **three 0.170.0 →
0.185.1** (+ matching `@types/three`) — the widest jump; audited both three
consumers (`components/customer/srv/UnitScene.tsx`,
`components/admin/ReactorSun.tsx`): they touch only stable core APIs
(Vector3, Mesh, ShaderMaterial, AdditiveBlending, BackSide), and the pinned
r3f 9.6.1 / drei 10.7.7 support three 0.18x. Also react-hook-form 7.81,
postal-mime 2.7.5, autoprefixer 10.5.2, postcss 8.5.16, eslint-config-next
15.5.20. One new (unused) transitive optional dep, `@dimforge/rapier3d-compat`,
arrives with three's physics addon.

No code changes, no migration. Verified: `npm ci` + `next build` green on
the merged tree; Playwright smoke suite 9/9 against a local `next start`
prod server; Vercel preview deploy READY pre-merge. Files: `package.json`,
`package-lock.json`.

## 2026-07-10 — Deal workflow: follow-up checklist, quick actions & activity log (migration 047)

The deal detail modal now matches the deal card the sales team works from
(per their screenshot): **Deal Progress** (`N/5 completed` bar), **Quick
Actions** (Log Call / Send Email / Schedule Meeting / Send Proposal — each
opens a one-line composer and writes an activity entry), the fixed 5-step
**Follow-up Checklist** (Preliminary Submittal Sent → Quote Sent → Initial
Follow-Up → 2nd Follow-Up → Job/PO Award; toggles persist per deal and log
auto-entries), and a reverse-chronological **Activity Log** with actor +
relative time.

- **Migration `047_deal_workflow.sql`** (run in the Supabase SQL editor):
  `deals.checklist` jsonb + `deal_activity` table (RLS on, no policies,
  service-role only — same posture as deals). Until it runs, the modal shows
  a run-the-migration hint and checklist toggles revert cleanly — nothing
  crashes.
- Checklist rides the normal deals PATCH (`checklist` whitelisted;
  full-replace semantics, step keys + booleans enforced in validate.ts);
  activity via new `GET`/`POST /api/admin/deals/[id]/activity`
  (requireDealsAuth, actor from the session).
- **Replace-imports keep workflow data**: the importer snapshots checklists +
  activity before the wipe and carries them onto re-imported rows matched by
  customer + job + group; the import preview shows what's at stake first.
- Step KEYS are the storage contract (`lib/deals.ts CHECKLIST_STEPS`) —
  relabel steps freely without a migration.

Verified in-browser pre-migration (sections render with real deals, composer
opens, optimistic check → revert + banner on rejected persist, zero console
errors); `next build` green. Files: `supabase/migrations/047_deal_workflow.sql`
(new), `app/api/admin/deals/[id]/activity/route.ts` (new),
`app/admin/deals/DealDetailModal.tsx`, `app/admin/deals/SalesDashboard.tsx`,
`app/api/admin/deals/import/route.ts`, `app/api/admin/deals/validate.ts`,
`app/api/admin/deals/[id]/route.ts`, `lib/deals.ts`, `lib/supabase.ts`,
`docs/deals.md`.

## 2026-07-10 — Deal detail modal: click into any deal (Monday-style item card)

`/admin/deals` deals now open in a center modal from every list view — the
monday.com "View" habit, without per-deal pages. Click a row in **Pipeline**
or **CRM**, or the ⤢ icon in **Focused** (those rows keep their inline edits).

- View mode: money strip (cost/weighted/confidence), one-click Active/Won/Lost
  segmented status, all fields, an **Updates & notes** panel with a dated
  "Add update" composer (prepends "7.10.26 — …" lines to `notes`, the sheet's
  own convention — no schema change, survives re-imports), created/updated
  meta, Delete.
- "Edit deal" flips the card to the same form as New Deal (shared field styles
  in `app/admin/deals/form.ts`); Save PATCHes only the changed fields, Cancel
  discards.
- Prev/next chevrons + ←/→ keys page through the opening view's current
  filter/sort order ("14 / 440"); Esc closes. Deleted deals drop out of the
  browse order silently.
- Persistence rides the existing optimistic patchLocal → persist →
  revert-on-fail machinery — verified end-to-end in-browser (optimistic value,
  forced 401, revert + error banner, plus modal open/navigate/edit/cancel
  across all three tabs). `formatDateOnly` promoted to `lib/utils` (CRM's
  local copy removed).

No migration; `next build` green. Files: `app/admin/deals/DealDetailModal.tsx`
(new), `DealsClient.tsx`, `PipelineView.tsx`, `CRMView.tsx`, `FocusedView.tsx`,
`form.ts` (new), `lib/utils.ts`, `docs/deals.md`.

## 2026-07-10 — Sales Dashboard + monday.com board import (the real numbers are in)

`/admin/deals` grew a **Dashboard** tab (now the default) and a real Excel
importer, and the deals table now holds the sales team's actual forecasting
board — **440 deals, ~$91.3M raw / ~$23.6M weighted** — replacing the 5
migration-043 demo seeds.

- **Dashboard** (`app/admin/deals/SalesDashboard.tsx`): weighted-forecast hero
  with blended confidence, KPI row, $-quoted-per-month activity chart,
  pipeline-by-confidence funnel, Won/Open/Lost donut, group leaderboard
  (share of expected value), projected-close buckets parsed from the board's
  free-text `projected` column, largest open deals, a blended-confidence
  gauge, and derived "Needs attention" signals (stale >90-day quotes, big
  deals at ≤10% confidence, $0-value rows, undated rows). Every figure is
  computed live from the deals table — no sample numbers anywhere; cards that
  need data the board doesn't carry (quotas, activity counters) wait until
  Sales provides it. Quiet Precision throughout.
- **Importer**: `lib/deals-import.ts` parses the monday.com export's group
  blocks and maps columns by name; `POST /api/admin/deals/import` does
  dry-run preview → commit with Replace-board (default) or Add-on-top modes,
  `requireDealsAuth`-gated + audit-logged (`deal.import`); the Dashboard's
  "Import from Excel" modal shows per-group counts/$ and row warnings before
  writing. `scripts/import-sales-forecast.mts` (npx tsx) is the same-parser
  backfill path used for the initial load — per-group totals verified to the
  dollar against the sheet's own summary rows.
- **Deps/safety**: SheetJS pinned to the fixed 0.20.3 CDN tarball (npm's
  0.18.5 carries unfixed high advisories); `/docs/*.xlsx|xls|csv` gitignored
  so real pipeline exports can never land in this public repo; SVG trig
  coordinates rounded to dodge a Node-vs-browser `Math.sin` ulp
  hydration mismatch.

`next build` green; dashboard verified in-browser against the live import
(totals, funnel, buckets, attention signals) with zero console errors. Files:
`app/admin/deals/SalesDashboard.tsx`, `app/admin/deals/DealsClient.tsx`,
`app/api/admin/deals/import/route.ts`, `lib/deals-import.ts`, `lib/deals.ts`,
`lib/utils.ts`, `scripts/import-sales-forecast.mts`, `docs/deals.md`.

## 2026-07-09 — Annual Review print sheet: wider coaching notes, no core-values footer, + a portrait option

Follow-up tweaks to the bespoke `/print/annual-review` sheet:

- **Rating columns pulled left, coaching notes widened.** Each review section's
  ratings now sit in a fixed column right after the criteria text instead of being
  pushed to the far right, so the coaching-notes box grows from 212px → ~458px
  (landscape) — far more writing room. (`.sec .body` → `flex:none` + a fixed `.grid`
  first column of 340px; `.coach` → `flex:1`.)
- **Removed the core-values footer band** from the back (second) page.
- **Portrait option.** A Landscape/Portrait toggle in the on-screen top bar
  (`?orientation=portrait`, hidden in print) swaps the `@page` size and merges in a
  new `PORTRAIT_STYLE` — core values reflow 4-up and the fit-to-page compaction is
  relaxed since portrait has ~998px of vertical room. The "Download PDF" button + the
  printed page size follow the selection.

Both orientations verified to fit one sheet per page at 100% (measured on the actual
markup): landscape front 722px / back 671px (≤758px); portrait front 914px / back
781px (≤998px); no wrapped text, no overflow. `next build` green. Files:
`app/print/annual-review/page.tsx`, `docs/form-print-pdf.md`.

## 2026-07-09 — Annual Review print sheet: content edits + fits one landscape sheet per page

Requested edits to the bespoke `/print/annual-review` sheet (blank branded Annual
Review, front/back landscape):

- Removed the person icons from **Employee Name** and **Reviewer**.
- Added **"Follows IAT safety protocols"** to *Results & Execution* and **"Attendance
  and punctuality"** to *Teamwork & Communication*.
- Renamed the lowest rating **Performer → Needs Development** (performance-scale card,
  Overall Performance Rating pill, and the Development Plan note "(if rating is Needs
  Development)").
- **Development Goal → Development Goals** in the Overall Summary.
- Dropped **"Work with Excellence"** from the **Colossians 3:23** core value.

**Pagination fix for reliable duplex printing.** The sheet already ran taller than one
landscape Letter page at 100% (front ~946px / back ~849px vs ~758px usable) — so each
page spilled onto a second physical sheet unless the print dialog was set to "Fit to
page," which broke the front/back pairing. Added a **fit-to-page compaction** override
block to `STYLE` (tighter section padding, 1px rating-circle row gaps, smaller
header/title/core-value icons). Each sheet now measures **front ≈722px / back ≈719px**,
under the ~758px budget with ~⅜in headroom, so it prints as clean front/back at 100%
(flip on short edge). Content unchanged; verified by rendering the actual markup at the
print box model (front + back screenshots). `next build` green. File:
`app/print/annual-review/page.tsx` (+ `docs/form-print-pdf.md`).

## 2026-07-09 — Admin nav: "Employee Forms" merged into "Forms"

Removed the standalone **Employee Forms** item from the admin sidebar (Employees
section). It was redundant — `/admin/forms` already opens & fills any form via the ↗
preview arrow, so a second fill-gallery tab wasn't needed. The nav item is now
`hidden: true` in `AdminSidebar.tsx` (comment left explaining the merge), and the ⌘K
command-palette entry was delisted with its search keywords (`jotform / fill / submit /
resources / library`) folded into the **Forms** entry so search still lands there.
**Kept intact:** the `/admin/employee-forms` route, the `employee_forms`
role/permission, and the shared `EmployeeFormsView` — which still powers the
employee-facing `/employee/resources`. Re-enable the nav item by removing `hidden:
true`. No route/data/migration change. `tsc --noEmit` + `next build` green. Files:
`components/admin/AdminSidebar.tsx`, `components/admin/CommandPalette.tsx`.

Alongside it, a read-only forms audit (57 forms): 52 open via the ↗ arrow; the 5 that
show "This form is not available" are all **paused on purpose** (Annual Time Request &
Sick Time Form → replaced by the dedicated PTO/Sick request system; Annual Review
`[perf-new]` → throwaway test copy; Copy of Customer Satisfaction Survey → duplicate;
Customer Order Form → old/superseded) — left as-is per Jacob. No duplicate slugs, no
empty forms.

## 2026-07-09 — Gantt: sales onboarding (guided PDF + hover tooltips)

Sales loved the Gantt tool but couldn't drive it, so two **onboarding-only** layers
landed (no scheduling logic, data model, or migration touched):

- **Guided tutorial PDF** — a 12-page, branded, plain-English field guide for Sales
  at [docs/guides/gantt-sales-guide.pdf](docs/guides/gantt-sales-guide.pdf) (source
  `gantt-sales-guide.html`, regen `node docs/guides/render.mjs`). Covers the
  forecast-not-a-promise idea, a 60-second version, every control, which date to
  quote (P80), a customer do/don't script, and a pin-up quick-reference card.
- **Hoverable "?" reminders in the tool** — a shared `InfoTip` (CSS-only, keyboard-
  accessible, hidden in print) on the three top stats, the anchor, Baseline, the
  What-if row, Start date, and the Confidence / Assumptions / Tasks headers, plus a
  one-hover summary on the Gantt list page. Non-technical copy, accuracy-checked
  against `lib/gantt.ts`.

Copy went through a 4-lens review (accuracy vs. source, plain-language, coverage,
and a "software-shy sales rep" persona); the persona fixes — "which green box do I
read," "how do I set the anchor," "can I break it / there's no undo," "clicking a
what-if is safe," and "who owns the quoted date" — are baked into both deliverables.
The in-tool tooltips shipped to prod; the PDF guide lives in `docs/guides/`
(repo-only, not app-served). See [docs/gantt.md](docs/gantt.md).

## 2026-07-08 — Annual Review: dedicated branded print sheet

A fixed, branded two-page (front/back, **landscape**) print sheet for the Annual
Review at `/print/annual-review`. Front: logo letterhead, three review sections
(Results & Execution, Teamwork & Communication, Continuous Improvement) and the
eight IAT core values, each rated Superstar / Rockstar / Star / Performer with a
coaching-notes area. Back: the performance-scale legend, overall summary
(strength / opportunity / development goal), overall rating, employee comments,
a development plan, signatures, and a core-values footer.

Unlike the generic `/print/forms/[id]` view this is **not** field-driven — it's a
one-off branded layout (static markup, inline SVG icons, logo from `/public`).
The Annual Review form's "Download PDF" button (slug `perf-new`) now opens it;
every other form keeps the generic blank print. Admin-gated. See
[docs/form-print-pdf.md](docs/form-print-pdf.md).

## 2026-07-08 — Jerry's Brain v3: the reactor core is now a real plasma sun

The CSS-gradient wheel at the heart of `/admin/knowledge` is replaced with a
**real-time shader plasma sun** (Jacob's Doc-Ock reference, IAT edition) —
`components/admin/ReactorSun.tsx`, react-three-fiber (already a dependency via
the SRV 3D scene), no new packages. Custom GLSL: domain-warped noise for molten
convection, a roiling displaced silhouette, deep-teal → emerald → white-gold
heat ramp with crackle filaments, fresnel rim + additive corona. While Jerry
reads a document it visibly **boils harder and brighter** ("FEED ME" mode); an
absorb **blooms it white** for a beat. Loads client-side with the old CSS wheel
as the loading/WebGL fallback; honors `prefers-reduced-motion`. Verified via a
throwaway local shader harness: zero GLSL compile errors, idle/feed/flash states
confirmed visually.

## 2026-07-08 — Jerry's Brain v2: scrub preview gate + immersive reactor

Same-day follow-up to Jerry's Brain (below), on Jacob's direction. Two changes:

- **Scrub preview — nothing enters the pool without approval.** Feeding a file is
  now two phases: `POST /api/admin/kb/analyze` transcribes it (Claude, scans
  included) and returns a **scrub report** — competitor names (authoritative
  local check + the model flagging other HVAC brands), emails, phone numbers,
  customer-company and person names, plus a one-line summary — without writing
  anything. A **review card** shows the findings (competitors struck-through as
  "removed automatically"; PII as amber flags), lets the admin pick *Staff only*
  vs *Customer-facing* right there (warning if customer-facing + flagged names),
  then Approve sends the transcript to `POST /api/admin/kb/ingest` (now the
  commit phase) or Discard throws it away. The unconditional competitor scrub at
  chunk time is unchanged — the preview is a human gate on top. Verified live: a
  planted test doc's competitor name, customer, person, email, and phone were all
  flagged, and the committed text was confirmed competitor-free.
- **The reactor became the page.** The desiccant wheel now sits alone mid-screen —
  bigger, tilting toward the mouse (3D parallax), ambient emerald motes drifting
  across the scene, charging while it reads, pulsing on absorb, still growing
  with the pool. The explainer ("how this works"), live activity, stats, and the
  full document inventory moved to a collapsible **"Jerry's knowledge" panel
  pinned top-right**. Honors `prefers-reduced-motion`.

## 2026-07-08 — "Jerry's Brain": drag-and-drop documents into the knowledge base

A page where staff **feed documents straight into Jerry's knowledge** — the
Doc-Ock reactor the bossman described: drop a doc on the machine and Jerry learns
it. `/admin/knowledge` (admin-only) shows an animated **desiccant-wheel reactor**
that grows a hair with every passage learned, IAT-emerald motes orbiting, an
"absorb" pulse when a doc lands — plus the live list of everything in the pool.
Full docs: `docs/kb-rag-assistant.md`.

- **How it works** (reuses the Submittal-scanner pattern — no local binaries):
  signed upload URL → the file goes **straight to a private `kb-uploads` bucket** →
  the ingest route reads it back and has **Claude transcribe it** (vision-based, so
  **scanned/image docs work too** — this is why the CLI's `pdftotext` path couldn't
  run serverless) → chunk + competitor-scrub (`lib/kb-chunking.mjs`, shared with the
  CLI) → insert into the same `kb_documents`/`kb_chunks` pool Jerry retrieves from.
  Jerry can cite it in the very next answer.
- **Per-upload visibility toggle:** *Staff only* (default — internal Jerry only) vs
  *Customer-facing* (the customer assistant too). Delete = Jerry forgets it (chunks
  cascade).
- **No migration, no manual setup.** The `kb-uploads` bucket was provisioned
  programmatically (private). Verified end-to-end on the live pool: a doc was
  uploaded → transcribed → chunked → retrieved by the internal assistant, and
  confirmed hidden from the customer pool.
- The CLI `scripts/ingest-kb-docs.mjs` stays the bulk loader for the doc folder;
  this page is for ad-hoc additions. New nav item "Jerry's Brain" + `knowledge`
  permission (admin-only).

## 2026-07-08 — Internal Jerry: attach a photo/PDF to diagnose

The **internal** Jerrys — the standalone `/admin/jerry` page and the per-ticket
assistant — now let a staff member **attach a photo or PDF for Jerry to look
at and help diagnose** (a controller fault code, a nameplate, a wiring panel, a
submittal, a PO), the "like ChatGPT" flow. `claude-sonnet-4-6` is vision-capable,
so the file rides along on the same call alongside the retrieved manual excerpts
and (on a ticket) that unit's record. Full docs: `docs/kb-rag-assistant.md`.

- **Internal-only by construction.** Only `JerryWidget` callers passing
  `allowAttachments` show the upload UI, and only the two admin routes read
  attachments — the customer assistant ignores them.
- **UI:** paperclip / drag-drop / paste in the shared `JerryWidget`. Images are
  **downscaled in the browser** (long edge ≤ 1568px, JPEG) to stay under Vercel's
  ~4.5MB body cap and cost less; PDFs pass through (≤ 4MB). 4 files/turn, ~3.8MB
  total. Attachments persist in history so follow-ups keep the image in context.
- **Server (`lib/assistant-attachments.ts`):** re-validates media type / size /
  count and builds the Anthropic vision content (document/image blocks then text);
  the system prompt has Jerry read visible model/serial/error text, cross-check the
  ticket's equipment, and treat attachments as reference-only (never instructions).
- **No new deps, model, storage, or migration.** Verified end-to-end against the
  live model — a synthesized unit photo was read back correctly (model, serial,
  error code) with a diagnostic checklist.

## 2026-07-08 — Blank form print: branded letterhead + tidier header

Follow-up to the print/PDF redesign below. The blank-form print header now leads
with the IAT logo (a proper letterhead), and drops the generic, review-specific
"Employee / Reviewer / Date" band that was hard-coded onto every form's print —
forms capture identity via their own fields instead. Consecutive short
single-line fields (e.g. a name + a date) now pair two-per-row rather than each
taking a full line. Print-code only (`app/print/forms/[id]/BlankFormPrint.tsx`);
a form's own `description` still prints when set.

## 2026-07-08 — Blank forms print far shorter + a "Download PDF" button

The blank-form print view (`/print/forms/[id]`) — the fill-by-hand / save-as-PDF
version of any form — was redesigned to print much shorter, and the form editor
now surfaces it as a clear **Download PDF** button instead of a small "Print"
icon. No form's questions, options, scale, or data changed — this is purely how a
*blank* form renders on paper. See [docs/form-print-pdf.md](docs/form-print-pdf.md).

- **Rating matrix**: a run of 2+ choice questions sharing the same options (e.g.
  every Superstar/Rockstar/Star/Performer rating on the Performance Review) now
  prints as one table — the scale printed once as a repeating column header, one
  row per question — instead of relisting the four options under all ~26
  questions. Each rating keeps its own comment line, folded in from its
  "— Brief Explanation" box.
- **Untouched**: one-off choice questions and every other form render exactly as
  before (the matrix only groups 2+ questions sharing a scale); the conditional
  controller (e.g. `Department`) is never matrixed.
- **Result**: the Performance Review prints in ~2 pages (individual contributor)
  / ~3 (manager), down from ~7 / ~9.
- **Files**: `app/print/forms/[id]/BlankFormPrint.tsx` (layout),
  `components/admin/FormBuilder.tsx` (the toolbar "Download PDF" button).

## 2026-07-07 — Admin list views: one shared "Forms-style" design language

Every admin list now speaks the same visual language — the clean, professional
look of the Forms page, applied portal-wide. New shared primitives in
`components/admin/list.tsx` (documented in `docs/design-language.md`); no
migration, presentation-only.

- **New primitives**: `ListPageHeader` (small-caps overline + bold title + light
  count + right-aligned actions, with tabs/filters in the header band),
  `IdentityCell` (the signature bold-title-over-muted-subtitle row identity, with
  `icon`/`leading`/`mono` slots), and shared `tabCx`/`tabCountCx`/`filterPillCx`
  styles so underline tabs and status pills look identical everywhere. The
  shared `ROW` is now airier (`min-h-[52px]`).
- **Converted** (header + stacked identity + simplified columns): Tickets,
  Submissions, Equipment, Customers, Employees, Deals (all three views),
  Employee Forms, PTO/Sick queues, Presentations, Gantt, Audit/Logins, Accrual,
  and the hidden Troubleshooting + US Rotors queues. Each row leads with a bold
  primary line over a muted secondary line; redundant columns (IDs, a rep, a
  category) fold into that subtitle, and low-value columns were dropped so each
  list reads as identity + a few meaningful columns + real actions rather than a
  spreadsheet. All behavior (sorting, bulk-select, filters, modals, links,
  permissions) is unchanged.
- Because `EmployeeFormsView` is shared, the employee-facing `/employee/resources`
  list inherits the same look — consistent by design.

## 2026-07-07 — Jerry: IAT unit-nomenclature internal reference

The **internal Jerry** (the standalone `/admin/jerry` page and the per-ticket
assistant) can now decode any IAT model or serial number. Added a curated
internal reference — **"IAT Unit Nomenclature (2022)"** — to the KB pool from the
2022 nomenclature sheet plus the current product lineup provided by leadership:
the model-number breakdown (nominal CFM, system type `R`/`D`/`B`/`AHU`,
reactivation `E`/`S`/`G`/`HW`, `HC` high-capacity, `/IDP` integrated package,
actual-CFM suffix), the serial-number format (year of sale + perpetual sequence),
and the Compact / Rotor / IDP model lists with worked IDP examples.

- **Internal-only** (`is_internal=true`) — surfaces for the two staff-facing
  Jerrys (`includeInternal: true`), never for the customer assistant. Verified:
  it's the top hit on decode questions for internal, and absent from the customer
  pool.
- **New "curated reference docs" ingest path.** IAT-authored references now live
  as committed Markdown in `scripts/kb-reference/` (unlike the gitignored
  third-party `ocr-cache/`, since this is IAT's own content) and ingest into the
  same pool via `node scripts/ingest-kb-docs.mjs --curated` (also folded into
  `--all`). Data-only — no migration, no app change (the internal routes already
  retrieve with `includeInternal: true`). Full docs: `docs/kb-rag-assistant.md`.

## 2026-07-07 — Deals: sales pipeline MVP ("Forecast Pulse"), the first scoped write

The Monday.com Sales Forecasting board rebuilt natively at `/admin/deals` — a
parallel MVP that runs alongside Monday until Sales proves it out. Requires
migration `043_deals.sql` (applied to prod 2026-07-07 before deploy). Full
docs: `docs/deals.md`.

- **One `deals` table, three tabs.** Pipeline (financial forecast: summary
  strip with total/weighted/win-rate, group-by-rep subtotals, inline
  Won/Lost/Active status), CRM (relationship view: rep + contact + quoted date,
  click-to-expand notes, recent-activity flag), Focused (action list: open
  deals with confidence ≥ 60 / a timeline / notes, inline-editable
  confidence/projected/notes that persist on blur). All three stay mounted so
  each keeps its own filter/sort state across tab switches; sortable columns
  follow the Tickets-queue pattern. New Deal modal + row delete round out CRUD.
- **`weighted` is derived, never stored** — always
  `total_cost × (confidence / 100)`, computed in `lib/deals.ts`
  (`computeWeighted`/`computeSummary`, pure functions via `useMemo`), same
  convention as Gantt's derived values.
- **First scoped write for a non-admin role.** New `deals` permission granted
  to `sales`; its API routes (`app/api/admin/deals`) gate on a new
  `requireDealsAuth()` (`lib/api-auth.ts`) accepting any role with the `deals`
  permission — a deliberate, narrow exception to the "scoped roles are
  view-only" v1 boundary (inline editing by reps *is* the feature). Documented
  in `docs/roles-and-permissions.md`; every other write API still gates on the
  strict admin-only guard.
- Also: `formatCurrency` added to `lib/utils.ts` (first shared currency
  helper), `DEAL_STATUS` tone map in `components/admin/list.tsx`, nav/⌘K/
  department-dashboard wiring.
- **Pre-ship review fixes** (multi-agent review, 18 confirmed findings → 6
  deduped fixes): full field validation on both API routes via a shared
  sanitizer (`app/api/admin/deals/validate.ts` — `total_cost` bounds,
  integer-rounded confidence, null-safe customer check, date format, clean
  400s instead of raw Postgres 500s; PATCH now 404s on a stale/deleted id);
  `date_quoted` formatted as a local calendar date (bare-`date` columns parsed
  UTC render a day early in US timezones); Focused rows stay mounted while an
  inline input has focus (editing confidence below 60 used to unmount the row
  before blur, silently dropping the save); failed/network-dropped saves now
  roll back to the last-known-server value instead of leaving phantom numbers
  in the totals (and the New Deal modal can't wedge in "Creating…");
  expanded CRM notes grow the row instead of painting over rows below;
  grouped-Pipeline corner/divider styling and CRM first-click sort direction
  (A→Z, blanks always last) corrected.

## 2026-07-07 — Form UX: reviewee name in the fill-modal header + field-settings follows the field

Two form editing/filling niceties. No migration.

- **Fill modal header shows who the form is about.** When an "Employee Name" (or
  "Full Name" / "Name") is entered, the `StepFormModal` header reads e.g.
  **"Performance Review Form — Jacob Younker"**, updating live as it's typed. Uses the
  same helper as the draft label, so the header and the "Continue where you left off"
  entry stay consistent. (`components/StepFormModal.tsx`)
- **Form builder: the "Field Settings" panel sticks to the top of the viewport.** Editing a
  field near the bottom of a long form no longer leaves the editor stranded off-screen — the
  right-column settings panel stays pinned at the top of the visible area as you scroll.
  Degrades to the previous top-anchored behavior if a measurement is unavailable (so it's
  never worse than before). (`components/admin/FormBuilder.tsx`)

## 2026-07-06 — Department dashboards, a standalone Jerry page, "View as" fix, mobile pass

A batch of admin-surface fixes and features.

### Added
- **Department dashboards.** Every scoped role (sales/hr/marketing/engineering/
  production_manager) now has `dashboard` in its permission list, so `/admin`
  is a real landing page for them (`homeForRole` sends anyone with `dashboard`
  to `/admin`) instead of redirecting to their first permitted section.
  `app/admin/page.tsx` branches: `admin` still renders the unchanged executive
  dashboard; every scoped role renders the new
  `components/admin/DepartmentDashboard.tsx` — real Supabase counts + a short
  recent-activity list scoped to what that role can see, plus a "Quick Links"
  grid generated from `ADMIN_SECTIONS` filtered by `hasPermission` (stays in
  sync automatically as sections/permissions change). No migration.
- **Jerry gets a standalone, full-page "GPT style" chat** at `/admin/jerry` —
  any admin-surface role can use it (new `jerry` permission, granted to every
  scoped role) to ask internal questions or just try Jerry out. Backed by a new
  general-purpose route (`app/api/admin/assistant/route.ts`, same RAG pipeline
  as the ticket assistant with `includeInternal: true`, gated by the loose
  `getAdminSurfaceUser()` rather than the strict `getAdminUser()`) — deliberately
  separate from the per-ticket Jerry, which stays grounded in one ticket's
  equipment/problem context. `components/shared/JerryWidget.tsx` gained a
  `fullHeight` prop so the same widget renders as either the compact sidebar
  card or a full chat surface with the composer pinned to the bottom. Added to
  `AdminSidebar` (right after Dashboard) and the command palette.
- **A soft, static gradient-orb background** behind the `/admin` executive
  dashboard's content — two large, very-transparent blurred emerald/sky circles
  via a negative-z-index layer, no motion (calm-design convention).

### Fixed
- **The new gradient-orb background wasn't actually visible.** The orb layer sits
  at `-z-10` inside the `/admin` scroll container, but that container has an
  opaque `bg-zinc-50`/`#0a0a0b` fill and was `position: relative` with no
  `z-index`, so it never formed its own stacking context — per the CSS painting
  order the negative-z layer dropped *behind* the container's own background and
  was painted over (the classic "negative z-index child disappears behind the
  parent background" trap). Added `isolate` (`isolation: isolate`) so the
  container owns the stacking context — the negative-z orb now paints over its
  own background and under the content — and nudged the dark-mode opacities up so
  the intended very-transparent glow actually reads (`app/admin/page.tsx`).
- **"View as [role]" dropdown was clipped after 2-3 options.** Root cause: the
  sidebar `<aside>` is `overflow-hidden` (for its rounded/sticky layout), which
  clipped the absolutely-positioned dropdown once it extended past the
  sidebar's own box — not a missing scrollbar. Rebuilt as a `document.body`
  portal with `position: fixed`, measured from the button's own bounding rect,
  so it always escapes ancestor clipping regardless of viewport height
  (`components/admin/ViewAs.tsx`).
- **Removed the `/admin/reset` Data Reset panel** (page, API route,
  `lib/reset-targets.ts`, nav entry, the now-unused `system` permission, and its
  docs section) per request — it was a pre-launch cleanup tool, not something
  meant to stick around.
- **Submissions detail page restyled to match the ticket detail's rhythm.**
  Short answers now render as compact label/value rows (a new shared `Field`
  component in `components/admin/detail-ui.tsx`, also adopted by
  `TicketDetailClient` to drop its own duplicate copy) instead of one
  label-above-value block per field; only the first form section is open by
  default, and every section after that folds into one collapsed "More
  responses" `<details>` accordion — so a long, multi-section form no longer
  reads as one endless scroll. Signatures, file/image values, and long free
  text (>90 chars) still get their own full-width block.
- **Mobile pass on the admin surface.** Added a `TableScroll` wrapper
  (`components/admin/list.tsx`) around the 6 shared-primitive tables
  (Submissions, Tickets, Equipment, Customers, Employees, Troubleshooting) so a
  table with more fixed-width columns than a phone screen scrolls horizontally
  instead of squeezing every column illegible-thin. Reduced fixed `px-8`/`p-8`
  page padding to responsive (`px-4 sm:px-8` etc.) across essentially every
  admin page shell, and added `flex-wrap` to a few header rows that packed a
  title + action button on one line.

`tsc --noEmit` and `next build` both green (all routes registered, including
the new `/admin/jerry`). Auth-gated throughout — no login session was
available to click through interactively this pass, so this was verified by
type-check + production build + careful manual review rather than a logged-in
screenshot; a real click-through (especially the department dashboards,
Jerry's new page, and the mobile table scrolling) is still worth a human pass.

## 2026-07-02 — Multi-select bulk delete across every admin list

Checkbox multi-select + a bulk **Delete** in every list view, for fast cleanup.

### Added
- Multi-select on Submissions, Tickets, Equipment, Employees, Customers, and the
  PTO/Sick time-off queue (checkbox per row + select-all + a floating action bar).
  Submissions & Tickets already had multi-select for status changes — Delete was
  added to their bars (and the misleading "Discard", which only cleared the
  selection, is now "Clear").
- One generic admin-only, audit-logged endpoint (`/api/admin/bulk-delete`) behind
  a two-step confirm. Reuses the per-record safety: account deletes free the email,
  the employees bulk-delete skips your own account, ticket/submission deletes clear
  child notes first, and partial outcomes (skipped/failed) are surfaced.

### Hardened (adversarial review)
- Selection is cleared whenever the visible set changes (filter, tab, search, sort,
  or pagination), so a bulk delete can never act on rows the admin has scrolled or
  filtered out of view.

## 2026-07-02 — Gantt v2.1 "Living Schedule": task status, actuals, computed health

Phase 3 of the Gantt plan: the chart stays honest **during execution**, not just
at planning time. No migration — status lives inside the `tasks` jsonb.

### Added
- **Per-task status** (not started / underway / done) in the task table. Marking
  a task done records its actual end date (seeded from the plan, editable) and
  **pins the chain to reality**: all lanes collapse to the actual, downstream
  reflows, the task's risks leave the Monte Carlo, and the ship window narrows
  as work completes. Done bars render muted with "✓ done <date>".
- **Anchor arrival as fact** — once the long-lead task is done, the drag pill and
  slider are replaced by an "arrived <date>" note; the callout switches from
  "if items arrive by" to "items arrived".
- **Computed health vs baseline** — per task: ≤0.5 wks on-track (silent, calm),
  ≤2 at-risk (amber), >2 slipped (rose), shown as "+X wks vs baseline" in the
  chart labels and print. The "conditional formatting" leadership pictured,
  derived from data instead of hand-painted.
- Progress readouts: "N of M steps complete" in the callout and printed sheet.

### Hardened (adversarial review — 12 findings, all fixed pre-merge)
- **Actuals are absolute dates, not week-offsets.** A completion date is a recorded
  fact; storing it relative to `start_date` (as the first cut did) meant editing the
  chart's start silently rewrote every recorded actual — the exact failure mode
  baselines were made absolute to avoid. `actualEnd` is now a `YYYY-MM-DD` and only
  its axis position depends on `start_date`.
- **Health is plan-vs-plan.** Per-task health now computes on the what-if-stripped
  layout, so firing a scenario chip no longer paints rows "+N wks vs baseline" while
  the variance stat reads "on plan" (and the printed sheet no longer self-contradicts).
- **"Done" seeds from the plan, not the what-if.** Marking a task done takes its
  actual from the fired-risk-stripped layout, so a hypothetical delay can't be baked
  into recorded fact.
- **Duplicate is a clean new plan** — it now strips completion status/actuals too (it
  already reset what-if flags and dropped the baseline), so a copy isn't born
  pre-completed and locked to the source project's history.
- What-if banner / chips / legend / print now count only live (non-done) tasks' fired
  risks — a done task's risks are history and were already excluded by the engines.
- Done label shows the recorded actual date (matching the table) even when the bar
  clamps to the chain; clamped done bars keep a visible sliver.
- Math script grown to 51 assertions (adds: start-edit can't move a recorded actual;
  fired what-if moves layout but not health; late done task reads slipped) — all
  green; tsc + production build pass.

## 2026-07-02 — Per-record delete (individual submissions, tickets, employees, …)

Complements the bulk Data Reset with surgical, one-at-a-time deletion for cleanup.

### Added
- A reusable **Delete** control (two-step confirm) on each record's detail page —
  submissions, tickets, equipment, customers, employees — plus a per-row delete in
  the PTO/Sick time-off queue. Each has its own admin-only, audit-logged `DELETE`
  endpoint.
- Employee and customer deletes remove the Supabase auth login (frees the email for
  re-invite), matching the Data Reset behavior. Employee delete is distinct from
  Deactivate (which stays for offboarding real staff) and refuses to delete your
  own account (the button is also hidden on your own page).
- Ticket/submission deletes remove child notes first so a record with notes can't
  fail on a foreign key.

### Hardened (adversarial review)
- Employee delete only falls back to a direct row-delete on a genuine "user not
  found"; any other auth-API error returns 500 without deleting the row, so a
  transient failure can't orphan the login and leave the email occupied.
- Customer delete removes the company row before the (irreversible) login deletes,
  so a failure leaves the record intact for a clean retry instead of a half-deleted
  "can't log in but still listed" state.

## 2026-07-02 — Roles & permissions, "View as" preview, and Data Reset panel

Go-live prep: replaces the coarse admin/employee split with seven staff roles and
adds an admin-only tool to wipe test data cleanly before launch. Full write-up in
`docs/roles-and-permissions.md`. **Requires migration `042_roles_permissions.sql`.**

### Added
- **Granular staff roles** — `admin, sales, hr, marketing, engineering,
  production_manager, production` (plus external `customer`). The base employee
  tier is renamed to `production`. Each role sees only its permitted admin tabs;
  the permission matrix lives in `lib/roles.ts` (the single source of truth,
  imported by the edge middleware, server, and client alike).
- **Two-layer access control** — the sidebar filters nav by permission AND the
  middleware page-gates scoped roles, so a hidden tab can't be reached by typing
  its URL. Any unmapped `/admin` route fails closed to admin-only.
- **"View as [role]"** — an admin-only sidebar control that previews the portal as
  any role would see it, with zero effect on the admin's real access (client-only).
- **Data Reset panel** (`/admin/reset`, admin-only) — per-dataset bulk delete
  (submissions, tickets, equipment, customers, PTO, sick, employees) behind a
  type-`DELETE` confirm. Account deletes remove the Supabase auth user so the
  email is immediately reusable; the employees wipe preserves all admins.

### Changed
- Role is assignable when inviting an employee and on the employee detail page.
- Login, the root router, and the auth callback each route a user to the correct
  home for their role via the shared `homeForRole()` helper.

### Fixed / hardened (from an adversarial preflight review)
- Removed a legacy `is_admin`→role sync from `/api/employees/[id]` that wrote the
  now-retired `employee` value unchecked — it could have left a demoted admin with
  full access. All role changes flow through the validated role endpoint.
- Migration 042 keeps `employee` as a deprecated transitional CHECK value so the
  old app can't error during the deploy window, and swaps `time_off_requests.
  reviewed_by` to `ON DELETE SET NULL` so the employees wipe can't be silently
  blocked by a foreign key.
- The reset tool now surfaces per-account delete failures and the customers-delete
  error instead of swallowing them.

### Migration
- **042_roles_permissions.sql** (required) — widens the `profiles.role` CHECK,
  migrates existing `employee` rows to `production`, repoints the signup trigger,
  and fixes the `reviewed_by` foreign key.

## 2026-07-02 — Gantt v2 "Honest Schedules": windows, baselines, risk rules, Monte Carlo

Answers leadership's critique of the Gantt tool ("deceptive and deep, with a ton
of nuances and conditional IF-THEN statements") with the mechanisms real
scheduling tools use (LiquidPlanner ranged estimates, MS Project baselines,
Primavera-style P50/P80/P90, RiskyProject probabilistic branching). The chart is
now a **forecast instrument**, not a promise. Full write-up in `docs/gantt.md`.

### Changed
- **Ship windows everywhere** — list cards, editor stats, callout, and print show
  "best – worst" (plan date secondary); the single ship date is gone. Bars draw a
  faded extension to their own worst case; milestones get accumulated
  best–worst whiskers instead of false-precision diamonds.
- **Scenario toggle retired** — it was itself a false-precision machine (click
  "Best case", screenshot it). The always-on window + P80 replaces it; the DB
  column stays for compat.
- **Failure toggle generalized** into per-task **risk rules** `{prob %,
  delayMin–delayMax, note}` — several per task, edited inline in the task table.
  Each risk is a what-if chip; "firing" it cascades the schedule, persists, and
  is loudly labeled on screen + print. Legacy `failure`/`reset_weeks` migrate
  lazily onto the anchor task (`normalizeChart()`); columns deprecated.

### Added
- **Baselines** — freeze the computed schedule as absolute dates (audit-logged);
  ghost bars under live bars; variance chips (emerald/amber/rose); what-ifs
  excluded from variance (plan vs plan).
- **Monte Carlo confidence** — 5,000 seeded client-side simulations (triangular
  durations, Bernoulli risks) → P50/P80/P90 ship dates + histogram + per-risk
  impact ("fires in 25% of runs, avg +7.8 wks"). Copy teaches the discipline:
  commit externally to P80.
- **Assumptions register** — editable, prints with the chart.
- **Print-designed sheet** — window headline, what-if banner, baseline variance
  table, risk register, assumptions, "Forecast, not a commitment" footer.
- Editor split into render-only components (`GanttChartView`, `TaskTable`,
  `ConfidencePanel`, `AssumptionsCard`, `PrintSheet`, `ui`); drag logic unchanged
  and spread-preserving (dragging the anchor keeps a user-entered range).

### Deploy / notes
- Run `041_gantt_ranges_risks.sql` in the Supabase SQL editor **before**
  deploying (autosave writes the new `baseline`/`assumptions` columns).
- Math verified by a 31-check sanity script: legacy charts compute identical
  dates through the new code; MC is deterministic, ordered (P50≤P80≤P90), and
  bounded by the analytic window; histogram binning capped for wide spreads.
- Pre-prod adversarial review (4 dimensions, each finding independently
  verified) caught + fixed 6 issues before ship: cleared start-date stranding
  every autosave; a deleted migrated risk reappearing on reload; the
  duplicate-during-debounce race; the 60-task silent cap; duplicate dropping a
  legacy contingency; and (found in passing) the debounced autosave logging a
  baseline audit event on every keystroke (baseline set/clear is now its own
  audit-logged action, out of the autosave path).

## 2026-07-01 — Gantt / Project Timelines: internal tool for customer project schedules

A new admin-only **Gantt** tab (`/admin/gantt`) for building and tracking customer
project schedules as interactive Gantt charts. Sales asked for a schedule on a
specific customer build; rather than a throwaway file that can't save, it's a
persistent, shareable portal tab. A timeline is a finish-to-start chain with one
**anchor** task (the long-lead / critical-path driver) whose arrival date drives
everything downstream — drag it (or the slider) and the whole tail re-cascades. A
**test-failure** toggle models the schedule reset (replacement long-lead parts,
`reset_weeks`), and ranged durations feed a Best/Likely/Worst scenario toggle.
Full write-up in `docs/gantt.md`.

### Added
- **`gantt_charts`** table (migration `040_gantt_charts.sql`) — one row per
  timeline; tasks stored inline as jsonb. Service-role only (RLS on, no policies).
- **`lib/gantt.ts`** — shared types + pure scheduling math (`layout`, `effDur`) +
  Auckland/blank templates; server-safe, so list and editor compute identical dates.
- **`lib/gantt-data.ts`** + **`app/admin/gantt/actions.ts`** — admin-gated,
  audit-logged reads and mutations (`create`/`update`/`duplicate`/`delete`).
- **`/admin/gantt`** list (cards, est-ship, new-from-Auckland-template) and
  **`/admin/gantt/[id]`** editor (draggable arrival anchor, scenario toggle,
  failure sim, editable task table, live stats, Print/PDF). Edits autosave.
- **Gantt** nav item in the `AdminSidebar` "IAT" section.

### Deploy / notes
- Run `040_gantt_charts.sql` in the Supabase SQL editor **before** deploying.
- Access is admin-only for now; Sales gets in via a temporary `admin` role.
  Role-based permissions (Sales sees Gantt, not PTO/Time Off) are still to come.
- Leadership flagged that a simple Gantt oversimplifies these projects' branching/
  conditional schedules; kept visible to demo. Pausing later = add `hidden: true`
  to the nav item (code, routes, and migration 040 all stay).

## 2026-07-01 — Portal-wide "calming" pass: subtracted visual noise on every surface

The portal — the `/admin` dashboard especially — had started to feel "in your
face." A density review across all nine surfaces found the bones (layout,
spacing, type, the shared card/list kit) were sound; the crowding came from
**decoration without meaning**: accent color used ornamentally (rainbow KPI
icons, six-color palettes, non-semantic rank-bar hues), the same fact rendered
two or three times (status/priority, streak/XP, stacked hero glows), and
animation that never rested (Jerry's idle orb, an alarm-red pulsing badge, an
infinite "Live" pulse, and a fake "⋯" affordance that did nothing). This pass
subtracts that noise everywhere while preserving every piece of information and
all behavior. Principles captured in `docs/design-language.md`.

### Changed
- **Shared DNA** — `AdminSidebar` nav count badges: solid saturated fills → soft
  tinted chips; `list.tsx` `StatusPill`: single soft fill (no border) +
  `semibold`; `PortalHero`: two glow blobs → one. Calms every portal at once.
- **Admin dashboard** (`app/admin/page.tsx`, `ExecutiveBriefing.tsx`) — one
  emerald focal point (flattened the Briefing, single hero glow), removed the
  non-functional `MoreHorizontal` "⋯" from KPI tiles, sparklines only on
  delta-bearing KPIs, Top-Forms/Top-Submitters rank bars recolored to emerald,
  secondary rail cards flattened, section rhythm `space-y-4`→`6`.
- **Customer + Jerry** (`CustomerDashboard.tsx`, `globals.css`) — Jerry's orb is
  calm at idle (one gentle breathe); the spin/orbit/twinkle now run only behind
  `.is-thinking` while he's answering. Cyan removed (pure emerald). Dropped
  redundant counters and muted request pills. Winding-road tracker untouched.
- **Ticket detail** (`TicketDetailClient.tsx`) — Problem Description promoted to
  the top; six read-only intake echoes folded into one collapsed "Intake details"
  disclosure (11 cards → ~5); duplicate status/priority pills removed from the top bar.
- **Support** (`app/support/page.tsx`, `status/StatusClient.tsx`) — alarm-red
  "Start here" badge → quiet emerald; five "coming soon" ghost cards → one-line
  note; static status dot; trimmed the run-on hero subtitle; softened
  secondary-card shadows.
- **Learn** (`app/learn/page.tsx`, `me/page.tsx`, `BadgeIcon.tsx`) — removed the
  duplicate dashboard stat strip; unified the four stat-tile hues to emerald;
  locked badges preview 4 behind "show all"; softened earned-badge tiers.
- **Employee** (`profile/page.tsx`, `EmployeeFormsView.tsx`, `OrgDirectory.tsx`) —
  unified KPI icon color; folded Quick Actions into the hero; muted the amber
  drafts panel; capped directory interest chips at 2 + "+N".

Sibling landing (`iat-home`) and ticketing (`iat-ticketing`) repos got matching
micro-fixes (one-shot "Live" pulse, tag trim; collapsed "coming soon" cards,
lighter review rows). No data, props, or behavior removed — visual noise only.
`tsc` + `next build` green. No migration. — J.Y. + Claude


The "Scan a Submittal PDF" tool in `NewCustomerWizard` sent the file as base64
directly in the POST body to `/api/admin/customers/extract-submittal`. Vercel
caps serverless function request bodies at ~4.5MB, so any Submittal whose
base64 exceeded that — roughly anything over ~3MB raw — was rejected by the
platform itself *before the route ever ran*, regardless of the route's own
(much higher) size check. The browser just got a non-JSON response back,
which surfaced as a generic "Could not read that file." A previous fix had
raised the route's own limit from 6MB to ~11MB, which didn't help — that
ceiling was never the actual constraint. Reported via a 7.1MB real Submittal.

### Fixed
- **`components/admin/NewCustomerWizard.tsx`** — the scan handler now uploads
  the file directly to Supabase Storage via a signed upload URL (new `POST
  /api/admin/customers/submittal-upload`, mirrors the existing
  ticket-attachments pattern) instead of embedding it in the function body.
- **`app/api/admin/customers/extract-submittal/route.ts`** — now accepts a
  Storage `path` instead of inline base64; downloads the file server-side
  (an outbound fetch, not subject to the inbound body-size limit) before
  handing it to Claude, and deletes it right after extraction (best-effort;
  it's not needed afterward and may contain customer PII).
- **New private bucket `admin-submittals`** (migration `035`, 20MB limit —
  comfortably above real-world Submittals, well under Claude's per-file cap).

`tsc` + `next build` green. Requires migration `035` before the fixed upload
path works; degrades to the same "could not read" error if deployed first
(no crash). — J.Y. + Claude

## 2026-07-01 — Self-serve "Request portal access" from support tickets

Customers no longer need a portal account forced on them just to check a
ticket, but can now opt in to one from a ticket they've already submitted —
gated by admin approval, not auto-created.

### Added
- **`RequestAccountCta`** (`components/support/RequestAccountCta.tsx`) — a
  shared CTA on the ticket success screen and the `/support/status` lookup
  result. Re-proves ownership via the same ticket-number + email match the
  status lookup already uses (`POST /api/tickets/request-account`); suppressed
  for already-logged-in portal customers, and shows "already linked" /
  "pending" states instead of re-submitting.
- **`customer_portal_requests`** table (migration `034`) — a pending queue,
  not an auto-created account. Snapshots the requester's details off the
  ticket (not client input) and carries a `suggested_customer_id` signal
  (set when the ticket's equipment serial is already linked to an existing
  customer) so the approving admin can spot a likely second-contact case
  instead of creating a duplicate company.
- **`/admin/customers` → Requests tab** (`CustomerRequestsQueue.tsx`) — pending
  count badge, each row linking back to the originating ticket. **Approve**
  opens `NewCustomerWizard` pre-filled from the request (now accepts an
  `initial` prop + a "attach to this company instead" toggle); **Deny** closes
  the request with an optional reason, no email sent.
- **`tickets.customer_id`** (migration `034`) — approving a request stamps it
  on the triggering ticket and backfills any other historical ticket from the
  same email, additive to `POST /api/admin/customers/invite`
  (`link_ticket_id` / `link_request_id`). Both `/customer` and
  `/admin/customers/[id]` now match tickets on `customer_id OR email OR
  serial` instead of email/serial only.

### Changed
- Confirmation email (`lib/resend-tickets.ts`) gained one line pointing back
  to the status page, where the CTA lives once ownership is re-proven — no
  new link, no email address in a URL.

Migration `034` applied to the DB before deploy. `tsc` + `next build` green.
End-to-end verified live in-browser up through ticket submission + the CTA
render/click; the approve/deny loop needs a post-migration pass. — J.Y. + Claude

## 2026-06-30 — OCR'd the image-only PDFs into Jerry's pool (+9 docs)

16 of the 80 source PDFs are image-only/scanned (no text layer), so they'd always
WARN-and-skip on ingest. They're now folded in via OCR — **no software install**, just
Claude PDF-vision and the existing `ANTHROPIC_API_KEY`.

### Added
- **`scripts/ocr-image-pdfs.mjs`** — transcribes each image-only PDF with Claude
  PDF-vision into a local sidecar `scripts/ocr-cache/<file>.txt` (page-delimited).
  Idempotent (cache-skips); `--force` / `--docs=` to re-run one.
- **`readOcrSidecar()` in the ingest script** — when a PDF extracts to 0 chunks, the
  ingest falls back to its OCR sidecar, so `--all` folds the scanned docs in.

### Changed
- **9 OCR'd docs ingested** (clean vendor-named titles + categories): Maxitrol Selectra
  94 gas valve, Belimo LF24-MFT-S, Belimo TF120, Fasco D215 motor, Fasco approval
  drawing, Control Products HS-70-O/HS-70-D sensor, Phasetronics EZ1 SCR, DRI rotor
  spec, NEMA Premium motor guide. Pool **58 → 67 docs (61 customer-facing), ~3,228
  chunks**. Verified each retrieves + cites correctly through Jerry's real path.
- **5 excluded** via `SKIP_DOCS` — 2 GE HumiTrac scans (already covered by
  `GEH2-D-TT2`/`GEH-S-TT3`/`DP4A`); `MMSQPL` + `Terms Certifigroup-MET Labs` (IAT
  internal business forms — an insurance questionnaire and a pricing quote, not product
  docs); and `ZWN030X6D Cond Unit Manual` (OCR revealed it's the **same Heatcraft
  H-IM-CU condensing-unit manual** already in the pool as `H-IM-CU-0808.pdf` — caught by
  verifying retrieval, the "ZWN…" filename is just an order number).
- **`scripts/ocr-cache/` is gitignored** — this repo is **public**, so full third-party
  manual text + the internal-form transcriptions stay out of git; the text lives only in
  the RLS-locked KB DB after ingest (same posture as the rest of the pool). Also
  gitignored `scripts/_*.mjs` (throwaway dev harnesses).

The OCR'd text is competitor-scrubbed at ingest like everything else. Data is already
live in the DB (ingest is data-only). The big 9 MB `ZWN030X6D` scan needed splitting into
page-batches to OCR (single-call timed out); once transcribed it proved to be a dup (see
above), so it was removed and excluded. `tsc` + `next build` green; no migration.

## 2026-06-30 — Jerry never names a competitor (Munters scrub, 3 layers)

IAT leadership's rule: a **competitor's name must never reach a customer through Jerry**
— not in an answer, not in a cited document's title, nowhere. Munters is the only
competitor in the corpus (component suppliers like Omron/Vaisala/Belimo are kept — those
names are useful and expected).

### Added
- **`lib/competitors.mjs`** — single source of truth (plain `.mjs` so the Node ingest
  script and the TS API route share it). `scrubCompetitors()` neutralizes every brand
  reference, even glued into a URL/email/compound word (`www.MuntersAmerica.com`,
  `info@muntersnv.be`); guarantee: `hasCompetitor()` is false afterward. One-line to add
  the next competitor.

### Changed
- **Ingest** (`scripts/ingest-kb-docs.mjs`) — chunk content is scrubbed before storage
  (so the `tsv` can't even index the brand), and citation titles are de-branded:
  Munters handbook → **"Dehumidification Guide"**, M120 → **"M120 Desiccant Dehumidifier"**.
- **Assistant** (`app/api/customer/assistant/route.ts`) — excerpts + source titles are
  scrubbed before the model sees them; a system-prompt rule forbids naming any competitor
  **and** revealing a referenced doc's publisher/author/address/provenance; the final
  reply is run through `scrubCompetitors()` as a net.
- **Document policy** — the 228-page competitor-authored handbook is held
  **`is_internal=true`** (its front matter leaked the publisher's address/editor — an
  indirect identifier a prompt can't fully launder out of 228 pages). De-branded and
  available to a future employee assistant; re-enable for customers by removing it from
  `INTERNAL_DOCS`. M120 stays customer-facing, de-branded. Customer-facing pool now 52
  docs (6 of 58 internal).

Data already re-ingested against the live DB (pool is Munters-free). **Verification:** a
node harness replays Jerry's real answer path; 31 adversarial probes (direct, oblique,
jailbreak, authority, translation/OCR tricks, footer/metadata extraction, "Swedish
company") were judged by an independent 2-judge panel — **0 direct or indirect leaks**;
supplier controls (Belimo/Vaisala/Omron) still answer correctly. `tsc` + `next build`
green. No migration. Auth-gated — verified via build + node harness, not a logged-in
screenshot.

## 2026-06-30 — Admin: "Employee Forms" sidebar item + unfinished-draft badge

Makes an admin's in-progress form drafts easy to find (the `/admin/employee-forms`
fill library — which carries the "Continue where you left off" resume list — had no
sidebar link, only ⌘K). Now there's a clear entry point with an at-a-glance count of
unfinished work.

### Added
- **"Employee Forms" nav item** in the admin sidebar (Employees section, beside the
  "Forms" *manager*) → `/admin/employee-forms`.
- **Amber draft-count badge** on it — the number of the signed-in admin's in-progress
  drafts (`lib/drafts.ts#getUserFormDraftCount`, wired through the admin layout like the
  other sidebar counts). Matches the amber "Continue where you left off" theme. Lets a
  reviewer doing a batch of reviews see at a glance they have unfinished ones to resume.

Distinct from **Forms** (`/admin/forms`, the builder/manager) and **Submissions**
(`/admin/submissions`, the review queue of completed forms). No migration.

## 2026-06-30 — Save & resume forms across devices (account drafts)

Stop a form mid-fill and pick it up later on any device. Built for performance
reviews — a manager can have several in progress at once and resume any of them.
**Requires migration `033_form_drafts.sql`**; degrades gracefully until it's run
(no crash — drafts are simply inert).

### Added
- **`form_drafts` table (migration 033)** — per-user drafts, multiple per form,
  service-role only.
- **`/api/drafts`** (GET list / PUT upsert / DELETE) — the user is resolved from the
  session, so a user only ever touches their own drafts.
- **Cross-device autosave** — logged-in portal fills autosave to the user's account
  (debounced); the form header shows a "Saved" cue.
- **"Continue where you left off"** on the Employee Forms tab — lists in-progress
  forms (with who/when) to **Resume** or **Discard**; the draft is cleared on submit.
- Anon public-link fills (`/forms/[slug]` while signed out) keep a same-device
  localStorage autosave as a fallback.

### Changed
- **`StepFormModal`** is now dual-mode — account drafts (cross-device) for the
  logged-in portal, localStorage otherwise — with a resume banner + "Start over".
  See `docs/form-drafts.md`.

## 2026-06-30 — Jerry is now the founder's bobblehead

Swapped the formal headshot avatar for the fun full-body **bobblehead** caricature:
- **Idle hero** ("Hi, I'm Jerry") = the standing bobblehead with a soft emerald aura + ground
  shadow, gently bobbing/floating (new `JerryFigure`).
- **Header + inline** = the **abstract emerald orb** (`Orb`) — Jacob preferred just the orb (no cropped face) in the small spots; only the hero is the bobblehead.
- Source 1024px PNG optimized to a **32 KB `public/jerry-bobble.webp`** (via `sharp`); removed the
  old `jerry.avif`. Also fixed a sizing bug where the avatar `<img>` used `inset` without explicit
  width/height (replaced elements fall back to intrinsic size → the orb avatar was oversized) — now
  a sized, `overflow:hidden` wrapper. `components/customer/CustomerDashboard.tsx`, `app/globals.css`.

## 2026-06-30 — Roadmap revised: gentler flowing road + clickable milestones

The "windier" serpentine shipped earlier today read as too plain/boring, so the customer
build/ship roadmap is reworked to the **gentler flowing curve** with the dashed **center-line
("road") markings back**, a thicker road, and up to **5 stops on a single row** when they fit.
Each stop is now **clickable**, opening a panel with the milestone's status / date / notes and a
**"Documents — coming soon"** section. (The real per-milestone document store + admin upload is the
separate follow-up build.) `Tracker` in `components/customer/CustomerDashboard.tsx`.

## 2026-06-30 — Jerry wears the founder's face + a windier build/ship roadmap

- **Jerry's avatar (#4).** The orb now carries a portrait of the company founder Jerry is named
  for — his photo as the orb's core, with the halo, spinning ring, and orbiting sparks kept and a
  gentle float on the idle hero (the "calm" treatment). `public/jerry.avif`; `Orb` in
  `components/customer/CustomerDashboard.tsx`; `.jerry-face` in `app/globals.css`.
- **Windier roadmap (#5).** The customer build/ship tracker is redrawn as one smooth, meandering
  curve (Catmull-Rom; stops alternately rise and dip) with the racetrack lane-markings removed —
  calmer and curvier. **Visual only** for now; the click-a-milestone-for-documents idea is a
  separate later build (needs per-milestone document storage). `Tracker` in `CustomerDashboard.tsx`.

## 2026-06-30 — Contact Us by department + Jerry reads from the top of long answers

Customer-portal feedback round (bossman review).

- **Contact Us → departments.** The customer "Contact Us" card now asks the customer to pick a
  **department** (Sales / Customer Service / Engineering / Billing) instead of listing staff names.
  Messages route to **iatsupport@dehumidifiers.com** for now, with the department in the subject
  (`[Department] Portal message — Company`) and body so they can be split to per-department inboxes
  later. Department is validated server-side. (`components/customer/CustomerDashboard.tsx`,
  `app/api/customer/contact/route.ts`, `lib/resend-customer.ts`.)
- **Jerry — long-answer scrolling.** When Jerry's answer lands it now scrolls to the **top of that
  answer** instead of the bottom (long replies used to dump you at the very end), and the panel is
  taller (max-h 340→460, min-h 268→340). (`components/customer/CustomerDashboard.tsx`.)

## 2026-06-29 — Print views: per-department form preview + submission printout

Two browser-native print views for the Performance Review (and any conditional form) — the ops
director can **Print** or **Save as PDF**, and both honor the `show_when` department conditions.
Code-only; no migration, no env vars.

### Added
- **`/print/forms/[id]`** — pick a department → preview **only that department's questions** as a
  blank questionnaire (universal sections + that department's gated questions) before sending to
  team leads. Linked from the form-builder toolbar (next to Tally). Works for any conditional form;
  non-conditional forms just print the whole form.
- **`/print/submissions/[id]`** — a clean printout of a completed submission showing only the fields
  that applied to that person's department, to hand to the employee. Linked from the submission
  detail (next to Download PDF).
- Standalone `/print/*` routes (no admin chrome → clean output), self-gated with `getAdminUser()`;
  shared `components/PrintFrame` + `PrintButton`; reuses `lib/forms.ts` visibility so the printout
  matches the live form. `tsc` + `next build` clean.

## 2026-06-29 — Jerry refinements (light-first, serif voice, tuned orb, real name) + KB pool to 58 docs

Follow-up polish after scaling Jerry's KB pool to the full documentation folder.

- **KB pool** — ran `ingest-kb-docs.mjs --all` (now **58 docs / ~3,164 chunks** after pruning 6
  duplicate source files via a new `SKIP_DOCS` set). Recovered `PXR3.pdf` (NUL-byte fix in
  `cleanText`), sealed a customer-PII doc (`References.pdf` → internal), and added vendor-named
  citation titles. See `docs/kb-rag-assistant.md`.
- **Light-first customer portal** — the customer portal now defaults to **light** for a browser
  that has never chosen a theme (scoped effect in `CustomerDashboard`; admin/employee keep the
  global `system` default; a customer who toggles to dark is still respected).
- ~~Jerry's serif "voice"~~ — tried a serif for his greeting + answers; **reverted same day**
  (didn't read well), so the answers stay in the portal's sans.
- **Tuned orb** — calmer/slower idle breathing + halo, a richer core/ring gradient, and a gentle
  floating drift on the large idle hero orb (`app/globals.css`; still honors `prefers-reduced-motion`).
- **Real name in the prompt** — the assistant's system prompt now introduces itself as **Jerry**
  (was "the IAT Assistant") so it answers to its name (`app/api/customer/assistant/route.ts`).

## 2026-06-29 — Customer assistant becomes "Jerry" + light/dark toggle

Reskinned the customer-portal AI assistant from a chat-bubble bot into **Jerry** — an animated
"presence" (a breathing emerald orb that spins up while it reads the docs), with typeset answers
and cited "receipts" (document + page) instead of speech bubbles. Same RAG underneath — only the
experience changed.

- **Jerry** (`components/customer/CustomerDashboard.tsx`; orb styles in `app/globals.css`) — idle
  hero with a large orb + greeting, a persistent orb in the header that energizes while loading,
  answers as clean text with source chips, an "Ask Jerry…" composer. Honors `prefers-reduced-motion`.
- **Light/dark toggle** — the existing `ThemeToggle` (Sun/Moon) is now surfaced in the customer-portal
  header. The portal already supported dark mode via Tailwind; it just wasn't exposed to customers.
  Built light-first.

## 2026-06-29 — Customer AI Assistant: documentation RAG with citations

The customer-portal **IAT Assistant** can now answer from IAT's documentation. PDFs are ingested
into a searchable pool; the assistant retrieves the most relevant excerpts, answers **grounded only
in them**, and **cites the source (document + page)** as chips under each answer — or says it's not
in the documentation and routes to support. It never guesses product specifics. **Lean POC: Postgres
full-text search only** — no new vendor, no embeddings key (semantic vectors are the planned upgrade).

- **Data (migration `030_kb_rag.sql`)** — `kb_documents` + `kb_chunks` (generated `tsvector` + GIN
  index), both service-role only; a `match_kb_chunks()` SQL function ranks chunks **TF-IDF-style** so
  a rare, distinctive term (`humidistat`, `e5cn`, `overcurrent`) outweighs a common one (`set`,
  `alarm`) and the document that actually covers the question wins.
- **Ingest** — `scripts/ingest-kb-docs.mjs` extracts each PDF **per page** (page numbers preserved
  for citations) with `pdftotext`, chunks it, and inserts via the service role; idempotent per file,
  internal/company docs flagged `is_internal` (hidden from customers). POC pool: **10 docs, ~2,114
  chunks**. (`A1094 Manual.pdf` is image-only/scanned — excluded pending OCR.)
- **Retrieval layer** — `lib/kb-rag.ts` (`retrieveChunks` + helpers) is reusable (an internal
  assistant can reuse it with `includeInternal: true`) and **degrades to no-op** until the pool exists.
- **Assistant** (`app/api/customer/assistant/route.ts`) injects the excerpts, cites doc+page by exact
  label, and returns the cited sources; `components/customer/CustomerDashboard.tsx` shows them as chips.
- Docs: **docs/kb-rag-assistant.md**. Deploy: apply `030_kb_rag.sql`, then run the ingest script. No new env vars.
- **Follow-up (same day):** widened the retrieval window **6 → 10 chunks** — a specific answer page can
  rank just outside the top few when it doesn't repeat the product name (e.g. the Omron E5CN "Current
  Value Exceeds" error table, p.230, which never says "E5CN"). Semantic (vector) search remains the
  durable fix for deep-manual needles.

## 2026-06-26 — Forms round 4: review tweaks, equipment-form dropdowns/photos, new ticket numbers, roadmap tracker

A batch of form changes plus two redesigns.

- **Performance Review** — removed the **Employee Signature** field (supervisor signature kept;
  existing submissions keep whatever they captured). Each individual submission page
  (`/admin/submissions/[id]`) now shows a **per-review ratings tally** — the Superstar / Rockstar /
  Star / Performer counts for that one person — complementing the form-wide tally page. It renders
  only when a submission has answers on that scale, so the other forms are unaffected.
- **Equipment Support form** — the sample-label photo is larger / more prominent; the **pre- and
  post-cooling "type"** fields are now **dropdowns** (Chilled water coil, DX, Glycol, Evaporative,
  City/well water, Cooling tower water) with an **"Other…"** free-text fallback; the **Wheel & Seals**
  step shows **reference-photo placeholders** for the desiccant wheel and seals (drop the real images
  into `public/support/` and set `src` on the two `<ReferencePhoto>` calls).
- **Ticket numbers** — new format **`IAT-YYYY-NNNN`** (e.g. `IAT-2026-0042`), sequential per year,
  replacing the old `TKT-<timestamp>-<random>`. Generated atomically in the DB (`next_ticket_number`
  RPC + `ticket_counters` table, **migration 029**) so simultaneous tickets can't collide, and seeded
  above any existing numbers. The route falls back to a timestamp-based number if the RPC is absent.
- **Customer build/ship tracker** — rebuilt from a vertical stepper into a **winding-road roadmap**:
  milestone "stops" along a road that snakes through the card, with a truck parked at the current
  stop. Same stages and in-order logic — a visual redesign (`components/customer/CustomerDashboard.tsx`).

## 2026-06-26 — Submittal reader: larger PDF limit

Raised the "New from Submittal" PDF size cap (`extract-submittal`) from ~4MB to **~11MB** — the old
limit was rejecting Submittals the platform itself accepts. The forwarded base64 stays well under
Claude's ~32MB request cap. (For PDFs beyond that, the next step would be routing the upload through
Supabase Storage instead of the request body.)

## 2026-06-26 — Admin nav: "Forms" link to the form builder

Replaced the admin sidebar's **Employee Forms** item (`/admin/employee-forms`) with a **Forms** link
to the admin form builder/manager at **`/admin/forms`**. The `/admin/employee-forms` page still
resolves by URL (now nav-orphaned).

## 2026-06-26 — Form engine: conditional fields + ratings tally (Performance Review)

Two new form-builder capabilities, both **additive** — a field with no condition behaves exactly as
before, so the other ~40 forms are unaffected.

- **Conditional fields** — a field can show only when another field has a given value (builder field
  settings → **"Show only when…"**). The multi-step renderer (`StepFormModal`), the embed renderer
  (`FormRenderer`), and the server-side submit validation (`/api/submit`) all respect it: hidden
  fields aren't required and their values are dropped from the submission; empty sections collapse to
  no step. Schema: `form_fields.show_when_field` / `show_when_value` (**migration 028**). Visibility
  logic lives in `lib/forms.ts` (`isFieldVisible` / `visibleFields` / `stripHiddenAnswers`).
- **Ratings tally** — **`/admin/forms/[id]/tally`** (linked from the builder toolbar) counts how many
  **Superstar / Rockstar / Star / Performer** each employee received across all rating questions in
  their reviews, grouped by the "Employee Name" field — for reviews and bonuses.

**Performance Review form** data changes ship via `scripts/update-performance-review.mjs` (run after
migration 028; dry-run by default, `--commit` to apply, idempotent): removes 5 first-page/doc fields
(position title, supervisor, review period, position description + doc), swaps the rating scale to
**Superstar / Rockstar / Star / Performer** (drops Performance Gap, adds Superstar), and gates the
**Department-Specific** questions by **Department** (Engineering questions only show for Engineering,
etc.). The general competencies, Safety/Initiative/Growth, Summary & Goals, and Signatures stay
universal.

## 2026-06-25 — Hotfix 2: the real fix for the `/customer ↔ /login` loop (unlinked customer logins)

The cookie fix below was correct hardening but **not** the root cause. The loop's real driver: the
`/customer` page server-redirected to `/login` whenever `getCustomerUser()` returned null — which
happens for a customer login **not linked to a company** (`profiles.customer_id` is null; the FK is
`ON DELETE SET NULL`, so deleting a `customers` row orphans its logins). Middleware sees `role=customer`,
lets `/customer` through and bounces `/login` → `/customer`, so the page's redirect looped forever.
Fix: `/customer` now renders a client `CustomerSessionError` that **signs out locally** (clears the
session) then routes to `/login` — no server redirect, so the loop is impossible. Find orphaned
logins to clean up: `SELECT id FROM profiles WHERE role='customer' AND customer_id IS NULL;`

## 2026-06-25 — Hotfix: production auth redirect loop (`/customer ↔ /login`)

A logged-in customer whose session token needed refreshing could hit an infinite `/customer ↔
/login` redirect loop (ERR_TOO_MANY_REDIRECTS) on the live domain. Cause: `middleware.ts` returned
redirects without carrying over the refreshed Supabase auth cookies that `getUser()` sets, so the
refreshed session was dropped on each redirect and the auth gate oscillated (logged-in → `/customer`,
unresolved → `/login`, forever). Fix: a `redirectTo()` helper copies `supabaseResponse`'s cookies
onto every redirect (the documented Supabase SSR pattern). Also: the root router (`app/page.tsx`)
now sends customers to `/customer` (was `/employee/profile`). Latent middleware bug — surfaced by an
aging customer session on prod, not by a specific feature change. Code-only; no migration.

## 2026-06-25 — Status lookup: prefill + request picker for signed-in customers

`/support/status` is now session-aware (like the support form). A logged-in customer gets their
**email prefilled** and a **"Your requests"** quick-picker — one tap looks up any of their own
tickets / checklists (matched by their account email, so the lookup always verifies). Anonymous
visitors get the unchanged public lookup — `/support/status` is **not** gated. Split into a server
`page.tsx` + `StatusClient.tsx`; `getStatusCustomerContext` in `lib/support-context.ts`. No migration.

## 2026-06-25 — Support form: prefill for signed-in customers (public form stays open)

When a logged-in portal customer opens the support form (`/support/equipment-support`) it now
prefills their account email + contact details and shows a **"Your account & equipment"** card —
pick a unit to fill in its serial / model / voltage (auto-filled when they have a single unit);
everything stays editable. The page is **session-aware**, so **anonymous, non-portal customers see
the exact same public form** — `/support` is not gated. Prefilling the exact serial also makes the
resulting ticket auto-link to the right equipment record. New `lib/support-context.ts`
(`getSupportCustomerContext`); the support page renders per-request. Code-only; no migration.

## 2026-06-25 — Admin tracker: one-click canned notes

The Build & Shipping tracker editor (admin equipment detail) now offers 2–3 customer-facing
**note presets per stage** (one click fills the note) alongside the existing free-text note — so
staff don't write an update from scratch for every unit. Presets live in `lib/customer.ts`
(`notePresetsFor`), with a generic fallback for custom stages. Code-only; no migration.

## 2026-06-25 — Customer portal: live IAT Assistant (read-only)

The dashboard's "IAT Assistant" placeholder is now a working chat. Code-only; **no migration**.

- `POST /api/customer/assistant` (Anthropic `claude-sonnet-4-6`) answers grounded in the logged-in
  customer's equipment (serials, warranty, build/ship milestones) + IAT's published KB, assembled
  server-side. **Read-only** — it can't open tickets or change anything, is told to route actionable
  requests to Submit a request / Contact Us, and won't invent serials, dates, or status.
- Right-rail chat panel with suggestion chips, a typing indicator, and a "can make mistakes" note.
- Uses the existing `ANTHROPIC_API_KEY` (same as the Submittal reader) — no new env vars.

## 2026-06-25 — Customer portal: unit photos, Contact Us + message form

Dashboard build-out (stacked on the admin front door below). Code-only; **no migration**.

- **Unit photos** — admin uploads build & QC photos on `/admin/equipment/[id]` (new uploader
  `components/admin/EquipmentPhotos.tsx`; browser → Supabase Storage `ticket-photos` bucket, then
  PATCH `equipment.photo_urls`). They render as an expandable lightbox gallery on the customer
  dashboard.
- **Contact Us** card on the customer dashboard — the IAT team roster (Kacy Orr, Crystal Hill,
  Jacob Reagan, James Pope) plus a small **message form**. Submissions email
  `jacob.younker@dehumidifiers.com` via Resend (`POST /api/customer/contact`,
  `sendCustomerContactEmail`); the sender's company / contact / email are attached server-side.

## 2026-06-25 — Customer portal: admin front door (Customers section + Submittal wizard)

A **customer-first** way to provision portal access, alongside the existing equipment-first
"Invite to portal" card. Code-only; **no migration**.

- New **Customers** entry in the admin nav + **`/admin/customers`** list (search, Active/Inactive
  filters, unit counts) and a **`/admin/customers/[id]`** detail page (linked units, contact details).
- **New Customer wizard** (`components/admin/NewCustomerWizard.tsx`): scan a Submittal → review the
  pulled **customer + unit** fields → one click creates the `customers` row, the login, the
  `equipment` row, seeds the build/ship tracker, and emails the temp-password invite — all through
  the existing `POST /api/admin/customers/invite` (which already accepted a full `equipment` object).
- The same wizard is the equipment list's **"New from Submittal"** button, so there's a single
  create-from-Submittal path (Submittal PDF + manual entry only — no DW integration).
- **Resend invite** (`POST /api/admin/customers/[id]/resend-invite`) resets the temp password,
  re-sends the email, and re-activates the account; **Remove from portal**
  (`POST /api/admin/customers/[id]/remove`) deletes the login and marks the customer inactive
  (equipment + history kept). Both audited.
- `genTempPassword` extracted to `lib/temp-password.ts` (shared by invite + resend).

## 2026-06-25 — Legacy troubleshooting intakes migrated into Tickets

The retired Troubleshooting Checklist's intakes (`troubleshooting_intakes`) now live in the
unified **Tickets** queue. Each row was copied into `tickets` keeping its original `TSC-…`
reference as the ticket number — so the origin is obvious in the queue and the move is
**idempotent** (a `TSC-` ref already in tickets is skipped) and **reversible**
(`DELETE FROM tickets WHERE ticket_number LIKE 'TSC-%'`). Dates and status are preserved
(`new→open`, `reviewed→in_progress`, `closed→closed`); the checklist-only diagnostics
(onset, wheel/seals, external factors, …) map 1:1 thanks to migration 027.

All 6 rows were internal **test** submissions (J.Y. + Kacy, Jun 23–24), moved at the user's
request; the source `troubleshooting_intakes` table is left intact as a backup (retire it in a
later cleanup). Data-only — ran against the live DB via the service role, no code deploy.
Script: `scripts/migrate-troubleshooting-to-tickets.mjs` (dry-run by default; `--commit` to write).

## 2026-06-24 — Portal cleanup batch: nav trim, milestone ordering, customer simplification, org-chart list, sectioned submissions

A pass across all four portals (admin, customer, employee, support). Code-only; no migrations.

### Admin
- Hid the **US Rotors** nav (kept for future use behind a `hidden` flag) and **deleted the
  one-item Actions** section (New Form is still in ⌘K and at `/admin/forms`).
- **Troubleshooting** folded into **Tickets** — the two customer forms now feed one pipeline;
  legacy `troubleshooting_intakes` remain reachable at `/admin/troubleshooting` by URL.
- **Equipment list** PM column shows the full year (`Jun 26, 2027`) instead of `Jun 26, 27`.
- **Build & Shipping tracker** enforces **in-order** milestones (client blocks the change with
  an inline error; the milestones API re-validates and returns 409) and was redesigned with a
  stepper + breathing room. Equipment detail `<main>` got `space-y-4` so its cards stop butting
  together.
- **`/admin/org-chart`** gained the same **Chart / List toggle** the employee directory has
  (extracted to a shared `components/org-chart/OrgDirectory.tsx`).
- **Submission detail** now renders a **card per form section** (grouped by `section_header`)
  instead of one endless "Responses" list — mirrors the ticket detail.

### Customer
- Removed the redundant **"Support & resources"** card grid: the single support form
  ("Submit a request") and "Check status" live in the hero, and the Knowledge Base lives in the
  right rail (was 2 KB blocks + 2 form cards). Reflects the merged support form; spacing tightened
  toward a single-screen layout.

### Employee
- Hid the **US Rotors** nav section and the dashboard "US Rotors order" quick-action (kept for future).

### Support
- Removed the **US Rotors** brand option from the equipment support form (IAT-only now).

### Responsive
- Form grids that were a fixed two columns (cramped on phones / narrow laptops) now stack to
  one column below `sm` — the customer support form (`EquipmentTicketForm`) and the admin
  equipment & employee detail forms. (Best-effort pass; the dashboard KPIs already ship a
  separate mobile layout, and the detail two-column breakpoints stay `xl` because the admin
  sidebar takes 240px.)

## 2026-06-24 — Hardening: gate `/tools/*`, fix the inert router-cache config, add a smoke suite

Shipped the two genuinely-new fixes that had been stranded (done on a branch, never
deployed) on `chore/cleanup-hardening`. Cherry-picked to `main`; that branch's duplicate
Employee-Forms and support-rebrand commits were dropped (already live) and the branch deleted.

### Security
- **Gated `/tools/*.html` behind authentication** (security item 8.3). The internal static
  calculators (order-status card, voltage scaling, US Rotors pricing) were public by URL;
  `middleware.ts` now redirects anonymous visitors to `/login`, and any signed-in employee or
  admin may use them. Added `/tools/:path*` to the middleware matcher.

### Fixed
- **The admin Router-Cache setting was silently inert in production.** `staleTimes` had been
  moved to the **top level** of `next.config.js` during the 14→15 upgrade on the belief it had
  gone stable — but in Next 15 it's still `experimental.staleTimes`, so a top-level key is
  ignored (confirmed against the installed config schema and the build's "Experiments" banner).
  Moved it back under `experimental`, so `staleTimes.dynamic: 0` takes effect again (pairs with
  `RefreshOnNavigate`). Also set `outputFileTracingRoot: __dirname` so Next stops walking up to
  the stray repo-root `package-lock.json` when inferring the workspace root.
- **Troubleshooting CS-alert email** now links the live `/admin/troubleshooting` queue instead
  of the stale "a dedicated admin view is coming in Phase 2" copy.

### Added
- **Playwright smoke suite** (`e2e/smoke.spec.ts`, `playwright.config.ts`, `npm run test:e2e`):
  non-mutating checks that public entry points load, anonymous auth boundaries redirect, and the
  new `/tools/*` gate holds. Read-only by design (the dev server talks to prod Supabase).

### Removed
- **Dead code:** the legacy `/admin/test` design-preview dashboard (503 lines) and the no-op
  `/api/admin/auth` stub (login is client-side Supabase now). Nothing referenced either.

## 2026-06-24 — Employee Forms tab added to `/admin`

The "Employee Forms" library (the JotForms brought into the portal) is now available
in the admin portal as well, not just `/employee`. Admins are also employees — this
lets them fill out and submit the same forms (PTO, etc.) without leaving `/admin`.
Code-only change; no migration, no env vars.

### Added
- **`/admin/employee-forms`** — the same fillable forms library employees see: active
  forms grouped by category, category tabs, rows open the `StepFormModal` to submit.
  Distinct from `/admin/forms`, which remains the form *builder/manager* (create, edit,
  QR, embed, toggle active, approval).
- **"Employee Forms" sidebar item** under the admin **Employees** section, plus a matching
  ⌘K command-palette entry.

### Changed
- Promoted the employee `ResourcesFormsView` to a shared `components/EmployeeFormsView.tsx`
  so `/employee/resources` and `/admin/employee-forms` render from one component (added an
  optional `eyebrow` prop; employee output unchanged). No behavior change for employees.

## 2026-06-24 — Customer Portal (Phase 1) — external customer logins

A customer-facing portal at `/customer`. A company that has bought units from IAT
gets a login to track their equipment, build & shipping status, warranty, and
support — branded to IAT. Provisioned by staff from the equipment record, optionally
by scanning a Submittal PDF. Requires migration `026_customer_portal.sql`.

### Added
- **New `customer` role** (`profiles.role`) + `profiles.customer_id`. New tables
  `customers` (one per company) and `equipment_milestones` (staff-updated build→ship
  timeline); `equipment.customer_id` links units to a customer. All service-role only —
  `/customer` reads run server-side scoped to the session's customer, so the browser
  never queries those tables and customers can't see each other's data.
- **`/customer` dashboard** — unit cards (serial / model / warranty), a build & shipping
  tracker, KB + start-up guide, the existing support forms, and "My Requests" (their
  tickets + troubleshooting intakes, now behind a real login). IAT Assistant panel is a
  Phase-3 placeholder.
- **Admin "Customer Portal" card** on `/admin/equipment/[id]`: invite a customer (creates
  the login, links the unit, seeds the tracker, emails a set-password link) + a build &
  shipping milestone editor. Invite can **scan a Submittal PDF** (Claude document
  extraction) to pre-fill company/contact.
- New routes: `POST /api/admin/customers/invite`, `POST /api/admin/customers/extract-submittal`,
  `POST|PATCH /api/admin/equipment/[id]/milestones`; new `/customer/welcome` set-password page.
- Helpers: `lib/customer.ts` (milestone model), `lib/customer-auth.ts` (`getCustomerUser`),
  `lib/resend-customer.ts` (welcome email).

### Changed
- **`middleware.ts`** resolves the session role once and routes the `customer` role to
  `/customer` (and keeps customers out of `/admin`, `/employee`, `/learn`).
  Existing admin/employee routing preserved; `/login` and `/auth/callback` are role-aware.

### Deploy notes
- Run `supabase/migrations/026_customer_portal.sql` (applied 2026-06-24).
- Add `${APP_URL}/auth/callback` to Supabase Auth → URL allowlist (set-password redirect).
- Customer email sends from `onboarding@resend.dev` until a Resend domain is verified; the
  invite dialog shows a copyable set-password link as a fallback. No new env vars. `tsc` clean.

## 2026-06-15 — List-view fixes: kebab clipping + forms column alignment

### Fixed
- **Kebab menu options clipped** on the top rows of Submissions & Tickets — the shared
  `BODY_BOX` had `overflow-hidden` that clipped the vertically-centered dropdown. Removed it;
  rows now self-round their outer corners (`rowCx` → `first:rounded-t-xl last:rounded-b-xl`).
  Shared-kit fix, so it covers Equipment & Employees lists too.
- **Forms list column misalignment** (header labels vs row Status/Subs/Actions) in the flat
  category view — header and rows are separate grids and the template ended in `auto`, which
  sized differently in each. Actions column is now a fixed `232px` so both grids align.

## 2026-06-15 — Detail pages redesigned to the dashboard language

`/admin/submissions/[id]` and `/admin/tickets/[id]` now match the operations
dashboard (zinc surfaces, rounded-xl cards, emerald accents, sticky breadcrumb).

### Changed
- **Submissions detail is now two-column** (was a single scroll-heavy column): a main
  **Responses** card + a sticky right rail with a **Details** summary and **Internal Notes**.
  `section_header` fields render as subheading bands; answered/total count in the header.
- **Tickets detail** restyled to the same language — every section is a titled icon card;
  back button → breadcrumb. Structure and all behavior unchanged.
- New `components/admin/detail-ui.tsx` (`DetailShell`, `DetailTopBar`, `Card`, `CardHead`,
  `MetaRow`) shared by both pages so they stay consistent. Restyled `SubmissionStatus`,
  `SubmissionNotes`, and the PDF-download button to the emerald/zinc palette.

No behavior changes (status picker, PDF, notes, ticket save + resolution-reason gate,
attachment upload all preserved). `tsc` clean.

## 2026-06-15 — Fix: audit log wasn't capturing status changes / form creation

Resolving submissions and creating forms produced no audit entries — those paths
bypassed the instrumented API routes.

### Fixed
- **Server actions weren't logged.** Submission status (`updateSubmissionStatus`) and
  ticket status (`updateTicket`) are Next server actions writing straight to Supabase;
  they now call `logAudit` (`submission.status` / `ticket.status`, only on a real
  transition).
- **Form create/activate/pause weren't logged.** Added `form.create` to `POST /api/forms`
  and `form.activate` / `form.pause` to the `is_active` branch of `PUT /api/forms/[id]`
  (logged only when the active state actually flips).
- Verified the `audit_log` write path was healthy via a live insert/read/delete self-test;
  the table was empty only because nothing had hit a logged path.

### Changed (security)
- `updateSubmissionStatus` and `updateTicket` had **no explicit admin guard** (service-role
  writes relying on middleware alone). Both now call `getAdminUser()` and refuse non-admins.

### Added
- Audit viewer: **Tickets** filter + icons/colors for the new action types; dashboard
  "Admin Activity" dot colors extended to tickets.

## 2026-06-15 — Audit coverage + dashboard Admin Activity feed

Follow-on to the audit log shipped the same day.

### Added
- **Six more audited actions** (10 total): `submission.status`, `employee.invite`,
  `employee.deactivate`, `employee.reactivate`, `accrual.adjust`, `accrual.run` — each with
  before→after metadata.
- **Grouped prefix filters** on `/admin/audit` (Forms / Employees / Accrual) + per-action
  icons and colors for the new types.
- **"Admin Activity" card** in the dashboard right rail — 6 most recent audit entries, read
  in the dashboard server query (degrades to empty if the table is missing).

### Changed
- `/api/submissions/[id]`, `/api/employees/invite`, `/api/employees/[id]`, and
  `/api/admin/run-accrual` now resolve the acting admin via `getAdminUser()` (was a boolean
  `isAdminAuthenticated()` check) so audit entries name who acted. Same admin-only gate.

## 2026-06-15 — Admin: Executive Briefing, Command Palette, Audit Log

Three upgrades to make the admin portal feel like a finished product.

### Added
- **AI Executive Briefing** (`/admin`) — a card where Claude writes a short plain-English
  read of the operation from live metrics. `app/admin/ExecutiveBriefing.tsx` (client) +
  `app/api/admin/briefing/route.ts` (gathers metrics, calls `claude-sonnet-4-6`, **caches
  in-module for 1 hour**; `?refresh=1` bypasses). Never called inline — the dashboard is
  `force-dynamic`, so the card fetches after mount.
- **Command palette** — press **⌘K / Ctrl+K** anywhere in the admin. `components/admin/CommandPalette.tsx`
  (mounted in `app/admin/layout.tsx`): static destinations + actions, plus live search of
  forms/employees/tickets via `app/api/admin/search/route.ts`. Full keyboard nav. A ⌘K chip
  in the dashboard search box opens it (`commandk:open` window event).
- **Audit log** — append-only `audit_log` table (`supabase/migrations/020_audit_log.sql`,
  RLS on / service-role only) + `lib/audit.ts` `logAudit()` (best-effort, never throws),
  wired into the role-change, form-approve, form-delete, and time-off-review routes. Viewer
  at `/admin/audit` with action filters; new **System** section in the sidebar.

### Operational notes
- **Run migration `020_audit_log.sql`** in the Supabase SQL editor (done 2026-06-15).
- The role route now uses `getAdminUser()` (was `requireAdminAuth()`) to capture the acting
  admin — same admin-only gate, returns 403 for non-admins.
- `ANTHROPIC_API_KEY` (already set for the AI form builder) powers the briefing too.

## 2026-06-15 — IAT Learn (Phase 1)

Added **IAT Learn**, an internal training portal that replaces Trainual, served at
`/learn` inside the forms portal with shared Supabase auth (no second login).

### Added
- **`/learn` route group** — searchable category grid, numbered module steppers, and a
  lesson reader with per-module progress and mark-complete.
- **Admin** (`/learn/admin`) — full content tree with publish toggles and a TipTap
  rich-text lesson editor. Gated to `profiles.role = 'admin'`.
- **API** (`/api/learn/*`) — progress upsert (user id taken from the session, never the
  request body), plus admin-only lesson/module CRUD.
- **Migrations**
  - `014_learn_system.sql` — schema (`learn_categories`, `learn_modules`, `learn_lessons`,
    `learn_progress`) + indexes, `updated_at` trigger, `is_learn_admin()` helper, and RLS.
  - `015_learn_seed.sql` — seed of 5 categories, 14 subjects, **357 lessons** imported from
    the Trainual PDF exports. Idempotent (`ON CONFLICT DO NOTHING`). Split into
    `015a`–`015f` chunk files for pasting into the Supabase SQL editor (the combined file
    exceeds the editor's paste limit).
- `middleware.ts` — `/learn` auth gate (admin-gating handled in the `/learn/admin` layout).
- `app/globals.css` — `.learn-prose` reading styles + missing-image placeholder styling.
- `scripts/gen-learn-seed.mjs` — regenerates the seed (and chunk files) from
  `iat-learn/_import/*.json`.

### Known gaps (tracked for follow-up)
- **81 of 357 lessons are heading-only stubs** — those Trainual PDFs exported without body
  text (notably Safety Procedures: 21 of 23). Fill via the admin editor or re-import from a
  higher-fidelity export.
- **154 image/video placeholders** flagged for re-upload via the admin editor.
- Creating categories/modules from the UI isn't built yet (they come from the seed).
- Phase 2 (gamification: points, leaderboards, streaks, badges, quizzes) is deferred; the
  schema is ready for it.

### Operational notes
- Migrations are applied by hand in the Supabase SQL editor (no Supabase CLI wired up),
  same as prior migrations. For this release, run `014` then `015a`–`015f` in order.
- Full build detail lives in `../LEARN_BUILD_NOTES.md`.
