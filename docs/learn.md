# IAT Learn

The internal training portal that replaces Trainual. Lives inside this app at
**`/admin/learn`**, on the shared Supabase auth and the shared deploy — there is no separate
Learn login.

> Not to be confused with the `iat-learn/` folder in the workspace root. That is a **paused
> standalone prototype** with its own Supabase project and an incompatible schema
> (`subjects`/`topics`/`steps`). It is useful only as reference — see `TRANSITION-PLAN.md`.

## Routes

| Route | What | Who |
|---|---|---|
| `/admin/learn` | Browse — greeting hero + category grid with per-category progress | every staff role |
| `/admin/learn/[category]` | Subjects in a category | every staff role |
| `/admin/learn/[category]/[module]` | Numbered lesson stepper, "Start training" | every staff role |
| `/admin/learn/[category]/[module]/[lesson]` | Lesson reader + mark-complete | every staff role |
| `/admin/learn/me` | My Learning — level ring, XP, streak, badges, per-category progress | every staff role |
| `/admin/learn/leaderboard` | XP ranking with a department filter | every staff role |
| `/admin/learn-content` | Authoring — content tree, publish toggles, TipTap lesson editor | **full admin only** |

Old `/learn/*` URLs 308 to these via `next.config.js` redirects, which run *before* middleware,
so a `?redirect=/learn...` login round-trip still lands correctly.

## Access model — and why authoring is a *sibling* route

`'/admin/learn'` is in `OPEN_ADMIN_PREFIXES` (`lib/roles.ts`), so every admin-surface role
(including base `production`) can view. Training is for everyone, and `/learn` carried no
permission before the move either.

Authoring is gated by a `learn_admin` permission mapped in `ADMIN_PATH_PERMS`.

**The authoring route must not be nested under `/admin/learn`.** `requiredPermForPath` checks
`OPEN_ADMIN_PREFIXES` *first* and returns `null` unconditionally — it does not compete on prefix
length with `ADMIN_PATH_PERMS`. So anything under an open prefix is also open, and a
`{ prefix: '/admin/learn/manage', perm: … }` entry would be silently dead code. `matchesPrefix`
requires an exact hit or a trailing `/`, which is why the sibling `/admin/learn-content` is
genuinely outside `/admin/learn`. Same non-collision idiom as `/admin/tools` vs `/admin/tool-crib`.

The `ADMIN_PATH_PERMS` entry is **mandatory**, not optional: an unmapped `/admin/*` path falls
back to `dashboard`, which every scoped role holds — omitting it would *open* authoring.

`learn_admin` appears in **no** `DEFAULT_ROLE_PERMS` list, so it is admin-only by omission and
needed no migration (same pattern as `srv`, `sizing`, `knowledge`). It is also in
`NON_DELEGATABLE_PERMS`: the authoring layout and all four `app/api/learn/**` write routes use
the strict `getAdminUser()`, so granting it to a scoped role would be a half-grant that
dead-ends at the layout. **To open authoring to HR later**: remove it from `NON_DELEGATABLE_PERMS`,
move the layout gate and those four API routes onto the perm, and add a migration `INSERT`.

`app/api/learn/progress` is the exception — it is session-scoped by design (the `user_id` comes
from the session, never the body) and is open to any signed-in account. `/api` is deliberately
outside middleware's matcher.

## Data model

Four tables, all from `supabase/migrations/014_learn_system.sql`; the seed is `015`/`015a–f`.

- `learn_categories` — name, slug, icon (lucide name), `accent`, `display_order`
- `learn_modules` — FK category, title, slug, `is_published`, `source_file`, `import_status`
- `learn_lessons` — FK module, title, slug, `content` (HTML), `estimated_minutes`, `is_published`
- `learn_progress` — `(user_id, lesson_id)` unique, `completed_at`, `time_spent_seconds`

`learn_categories.accent` holds a raw per-category hex. It is **no longer read for color** —
progress bars take the single brand accent (DESIGN §2.3). The column is inert, not dropped.

`time_spent_seconds` exists but is never written.

## Gamification — derived, no tables

XP, levels, streaks and badges are all computed on read from `learn_progress` + `learn_lessons`
+ `employees`. No gamification tables exist.

- `lib/learn-gamification.ts` — pure logic, no I/O. XP = 50 + 10/min; 10 named levels
  (Newcomer → IAT Scholar at 33,000 XP); streaks anchored to `America/New_York`; 9 badge types.
  Everything is tunable in this one file.
- `lib/learn.ts` — the data wrappers: `getCategoriesWithStats`, `getModuleWithLessons`,
  `getLessonContext`, `getAdminTree`, `getUserLearnStats`, `getLearnHeaderStats`,
  `computeAwardForCompletion`, `getLeaderboard`.

`getLearnHeaderStats` is the cheap one (2 queries) and feeds the **"Your training"** strip on
Company Home — the per-person progress card on `/admin/home`, which is where the XP/streak
numbers live now. There are deliberately **no gamification chips in the admin top bar**.

## Design

The surface is on the Quiet Precision tokens as of 2026-07-30. The acceptance gate is a grep,
not a checklist — this must return nothing under `app/admin/learn*`, `app/admin/learn-content`
and `components/learn`:

```
(gray|zinc|stone)-[0-9] | #hex | font-bold | shadow-(card|sm|md|lg|xl|2xl) | rounded-2xl | hover:-translate-y
```

`slate-*` is exempt — it is a sanctioned DESIGN §2.4 Tone. Badge tiers and leaderboard podium
chips use the Tone system: bronze/2nd → slate, silver → sky, gold/1st → amber, 3rd → violet,
special → emerald.

`.learn-prose` in `app/globals.css` styles lesson bodies. It is written on
`var(--ink*)`/`var(--hairline)`/`var(--brand)`, so it needs no `.dark` mirror.

`components/PortalHero.tsx` is shared with the employee profile **and the customer dashboard** —
do not re-skin it from a Learn change.

## Content: what is actually in there

5 categories · 14 modules · **357 published lessons**, imported from Trainual PDF exports.
Verified against production 2026-07-30:

| Module | Lessons | Placeholder bodies | Lessons with missing images |
|---|---:|---:|---:|
| Safety Procedures | 23 | **20** | 2 |
| Testing Training | 16 | **13** | 3 |
| Shipping Training | 41 | 0 | 30 |
| Company Policies | 62 | 0 | 47 |
| Using DryWare | 10 | 0 | 10 |
| Desiccant Dehumidification | 13 | 0 | 10 |
| **total (14 modules)** | **357** | **33** | **133** |

⚠️ **Safety Procedures is 20/23 placeholder text** and Testing Training is 13/16. Both are
published and visible. If Learn is announced to staff, consider unpublishing those two modules
until the bodies are filled in.

(The 2026-06-15 changelog entry says "81 stubs / 154 images". Those numbers are stale — the
table above is from a live query.)

Source Trainual PDFs are still on disk at `iat-learn/trainual-existing/`, and
`scripts/gen-learn-seed.mjs` regenerates the seed from `iat-learn/_import/*.json`.

## Not built yet

In the order Jacob prioritised them (2026-07-30):

1. **Assignments + completion reporting** — assign required training to people/roles with due
   dates, plus a manager view of who has completed what. The real Trainual-parity feature and
   the compliance story for Safety. Needs new tables.
2. **Quizzes** — nothing exists: no table, no route, no UI, and nothing gates lesson completion.
3. **Content backfill** — the 33 placeholder bodies and ~180 missing images. Blocked on image
   upload existing first.
4. **Authoring CRUD + image upload** — today an admin can create/edit/publish *lessons* only.
   Categories and modules are **seed-only** (no create, rename, reorder or delete from the UI),
   there is no reordering anywhere, and the TipTap editor inserts images **by URL only**.
   `DELETE /api/learn/lessons/[id]` is implemented but has no caller.
