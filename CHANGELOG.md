# Changelog

Notable changes to the IAT Forms Portal, newest first. Dates are deploy dates.

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
