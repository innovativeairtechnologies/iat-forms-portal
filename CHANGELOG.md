# Changelog

Notable changes to the IAT Forms Portal, newest first. Dates are deploy dates.

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
