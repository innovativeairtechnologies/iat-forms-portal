# Changelog

Notable changes to the IAT Forms Portal, newest first. Dates are deploy dates.

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
