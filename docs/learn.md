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

## The browse page (`/admin/learn`)

A gamified library dashboard, rebuilt 2026-07-31 from a reference design Jacob supplied:

- **Level band** — level ring, title, XP, progress to the next level, streak.
- **My courses** — a horizontal deck of the 14 **subjects**, each washed in its *category's* Tone,
  with lesson count, estimated time and a progress bar. Filters: All / In progress / Not started /
  Completed.
- **This week** — a bar chart of content completed per day, with a vs-last-week delta and four
  stat tiles.
- **Up next** — a 7-day activity strip plus the next lessons to open (subjects already underway
  first, then fresh ones).

**Colour is the DESIGN.md §2.4 dashboard exception, not a departure.** Every wash is a Tone from
the sanctioned table (emerald / sky / amber / violet / rose / slate) — no off-system pastels — and
a subject inherits its *category's* tone, so the colour means "this part of the library" rather
than decoration. The map lives in `components/learn/learn-tones.ts`.

**What the reference had that we deliberately did not build**, because the data does not exist:

| Reference element | Why not |
|---|---|
| "Due Jun 25" date pills | No `due_date` column. The pill carries the category instead. |
| Mandatory / Recommended filters | No `is_mandatory` and no recommendation signal. Filters use real progress state. |
| "32 Hours Studied" | `learn_progress.time_spent_seconds` exists but **is never written**. The chart shows `estimated_minutes` of lessons *completed* per day, and the card says "Content completed" so it is not read as measured time. |
| Tests Passed · Average Test Score | Quizzes do not exist at all. |
| Next Lessons w/ instructor + scheduled time | Lessons have no instructor and no schedule. "Up next" answers the same question from real ordering. |

Due dates and mandatory flags arrive with the assignments feature; test scores with quizzes.

Two implementation notes worth keeping:

- Bar heights are explicit **pixels**. The columns are `items-end`, so they size to their content —
  a percentage height resolves against an auto-height parent and collapses to nothing. The first
  cut did exactly that and rendered an empty chart.
- Days are bucketed with `dateKey()` from `lib/learn-gamification.ts`, the same helper streaks use.
  Using a different rule would let a late-evening completion extend a streak but land on the
  previous bar.

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

## Deleting content

`/admin/learn-content` can delete a **category**, a **subject** or a **lesson**. Every level
cascades, and none of it is recoverable.

| Delete | Also destroys |
|---|---|
| Lesson | its `learn_progress` rows |
| Subject | all its lessons → all their progress |
| Category | all its subjects → all their lessons → all their progress |

Because XP, levels, streaks and badges are **derived from `learn_progress` on read**, erasing
progress rows retroactively lowers people's totals and can revoke badges they had earned. There is
no soft-delete and no undo.

So the tree shows the blast radius *before* you commit: clicking the trash icon swaps the row for
an inline confirmation naming the exact counts ("Delete *How we Use Trainual at IAT* and 5
lessons?"), and calls out completion records separately when there are any. Counts come from
`getAdminTree()`'s `completionsByLesson`, so the strip is instant; the server independently
recounts via `getDeleteImpact()` **before** deleting, because afterwards the rows are gone and
uncountable.

**Prefer Hidden over Delete.** Setting a subject or lesson to *Hidden* (`is_published: false`)
takes it out of the library and out of every XP denominator without destroying anything. Delete is
for content that should never come back.

Every deletion writes an audit entry — `learn.category.delete` / `learn.module.delete` /
`learn.lesson.delete`, visible under the **Training** filter on `/admin/audit`. The metadata
records `modules`, `lessons`, `completions` and `progressRows`.

> `completions` counts `completed_at IS NOT NULL`; `progressRows` counts every row destroyed.
> They differ because `POST /api/learn/progress` writes a row with `completed_at = NULL` when
> someone *un-marks* a lesson. Only completions carry XP meaning, so that is the number the
> confirmation warns about — but the audit records both.

Renaming a category (`PATCH /api/learn/categories/[id]`) changes `name` and `description` only.
The `slug` is deliberately immutable: it is the public URL segment, so changing it would break
every existing link and bookmark.

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
4. **The rest of authoring CRUD + image upload** — **delete is done** (see above), and lessons can
   be created and edited. Still missing: **creating** categories and subjects (seed-only —
   an admin cannot add a new subject without SQL), **renaming** subjects and lessons from the
   tree, **reordering** anything (`display_order` has no write path), and **image upload** (the
   TipTap editor inserts images by URL only, which is what blocks the content backfill).
