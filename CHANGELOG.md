# Changelog

Notable changes to the IAT Forms Portal, newest first. Dates are deploy dates.

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
