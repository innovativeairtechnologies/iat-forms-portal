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
- **Library** — one vertical **shelf per category** (`components/learn/SubjectLibrary.tsx`), in the
  admin's `display_order`, each shelf carrying its own subject/lesson/time counts and a progress
  bar. Inside a shelf, subjects keep their module `display_order` — for the HVAC/R course that
  order *is* the syllabus. Filters: All / Required / In progress / Not started / Completed, plus a
  text search and a "jump to" row. See **Why the deck became shelves** below.
- **This week** — a bar chart of content completed per day, with a vs-last-week delta and four
  stat tiles.
- **Up next** — a 7-day activity strip plus the next lessons to open (subjects already underway
  first, then fresh ones).

**Colour is the DESIGN.md §2.4 dashboard exception, not a departure.** Every wash is a Tone from
the sanctioned table (emerald / sky / amber / violet / rose / slate) — no off-system pastels — and
a subject inherits its *category's* tone, so the colour means "this part of the library" rather
than decoration. The map lives in `components/learn/learn-tones.ts`.

### Why the deck became shelves (2026-08-11)

The library was **one horizontal deck of every subject**. That was built for 14 subjects; the
Refrigeration & HVAC/R course (085) took it to **32**, and `getLearnDashboard` fetches modules
ordered by the *module's* `display_order` alone — which **interleaves categories**. So the deck had
become 32 cards of shuffled subject matter, about 4½ visible at a time, behind roughly seven
sideways scrolls. The team's feedback was exactly that: sideways scrolling, and no sense of which
part of the library you were in.

Grouping by category is the fix, and it made the **colour work better, not worse** — a shelf is now
one Tone block instead of six tones shuffled together, so the §2.4 wash finally reads as "this part
of the library". Notes for anyone changing it:

- `SubjectCard` carries `categorySlug` + `categoryOrder` **because** the module ordering interleaves
  categories. Don't group on `categoryName`.
- **Shelf totals are computed over the whole category, never the filtered subset.** "You have read
  22 of 63 lessons in Onboarding" is a fact about Onboarding; recomputing it per filter would make
  the number jump whenever someone clicked a tab.
- Shelf progress is **lessons read**, deliberately *not* a completion claim — a subject with a
  published quiz also needs a pass (`subjectIsComplete`). It's labelled "lessons read" for that
  reason. A tile showing 100% with an unpassed quiz says **"Quiz left"** rather than 100%.
- The subject title is the **first** element in a tile. Anything optional above it (a due chip, a
  Done pill) knocks the titles in a row out of alignment, which is what you scan down a shelf.
- **Required of you** is a compact list, not tiles — every subject in it also appears in its own
  shelf, and repeating the full tile a screen apart read as a rendering bug rather than a shortcut.
- The "jump to" row is hidden while a filter or search is active, because it would advertise
  shelves that have been filtered away.

**How the page tracks the reference design.** Three of the five gaps closed the same day:

| Reference element | Status |
|---|---|
| "Due Jun 25" date pills | ✅ **Real** — from an assignment (076). No assignment → the pill carries the category. |
| Mandatory filter | ✅ **Real** as the **Required** tab (076). Hidden when nothing is required. |
| Tests Passed · Average Test Score | ✅ **Real** — the Quizzes stat tile (074), shown once any attempt exists. |
| Recommended filter | ❌ No recommendation signal exists, so there is no tab. |
| "32 Hours Studied" | ❌ `learn_progress.time_spent_seconds` exists but **is never written**. The chart shows `estimated_minutes` of lessons *completed* per day, labelled "Content completed" so it can't be read as measured time. |
| Next Lessons w/ instructor + scheduled time | ❌ Lessons have no instructor and no schedule. "Up next" answers the same question from real ordering. |

The four stat tiles adapt: Streak gives way to **Quizzes** once any quiz has been taken, and Library %
gives way to **Required** once anything is assigned — a deadline outranks a completion rate.

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

## Required training + reporting (migration 076)

`/admin/learn-content/assignments`. Assign a **subject** or a **category** to an audience, with an
optional due date, and see who has actually finished it.

**Two polymorphic axes** on `learn_assignments`:

| | |
|---|---|
| WHAT | `scope_type` = `module` \| `category` |
| WHO | `audience_type` = `user` \| `role` \| `department` \| `everyone` |

**The audience is a RULE, not a list.** It is resolved on read, never materialised, so a new hire
inherits every `role` / `department` / `everyone` assignment the day their account exists. That is
the whole reason to assign by group.

**There is no `completed` column.** Completion is derived from `learn_progress` (+ a passed quiz
where one is published) through the same `subjectIsComplete()` the library pages use — so a
manager's report can never drift from what the learner sees.

⚠️ **`department` is free text and blank for 5 of 9 staff.** A department assignment can resolve to
nobody. Both halves of the guard matter: the admin form shows the resolved head-count *before*
saving and warns how many staff have no department, and `POST /api/learn/assignments` refuses a
zero-person audience with a 422. Don't remove either.

**Learner surfaces.** Required subjects sort to the front of the browse deck, carry a due pill
(`Due in 5d` / `3d overdue`, rose when late) in place of the category label, and get a **Required**
filter tab — the reference design's "Mandatory" tab, made real rather than faked. The tab hides
itself when nothing is required. Company Home's training strip leads with outstanding/overdue
counts when anything is due.

All four surfaces — the browse deck, the Required stat tile, Company Home's strip and the admin
report — apply the **same** rule, including the quiz gate. An earlier cut had Company Home skip the
quiz check to save a query, which meant someone who had read every lesson but never passed was told
nothing was due while the report showed them overdue. One extra query is worth the agreement.

Deleting an assignment removes the **requirement**, never any progress.

Still no `is_mandatory` column and no "Recommended" signal — Required comes from an assignment, and
there is no Recommended tab.

## Quizzes (migration 074)

A quiz attaches to a **subject** or a **category** (`learn_quizzes.scope_type` + `scope_id` —
polymorphic, so one set of tables serves both). Postgres can't FK one column at two tables, so
integrity and delete-cascade are enforced by triggers; a partial unique index gives one quiz per scope.

**Gating.** A subject with a **published** quiz is complete only when the lessons are read *and* the
quiz is passed. A subject with no published quiz completes on lessons alone — so publishing a quiz
later can never retroactively un-complete someone. Category quizzes are capstones and gate nothing.
The rule lives in one place, `subjectIsComplete()` in `lib/learn-quiz.ts`.

**Scoring.** 80% to pass (stored per quiz as `pass_pct`, not a constant), unlimited retakes, **best
score kept**, and `passed` is sticky — a bad retake can't un-pass you. Attempts store the `passed`
they were graded against, so raising the bar later doesn't retroactively fail history. Passing
awards `QUIZ_PASS_XP` (150) **once**, on the first pass, so retaking can't farm XP.

### Build with AI

`POST /api/learn/quizzes/generate { scopeType, scopeId, questionCount }` reads the lesson text for
the scope and drafts questions with four options, a correct answer, an explanation, and the
`source_lesson_id` it came from — that last one is the reviewer's hook for checking the key.

It produces a **draft**. Nothing reaches a learner until a human publishes it, and publishing is
refused server-side unless every question has exactly one correct option.

**Two layers stop it inventing questions:**

1. **A deterministic pre-flight, before any API call.** 33 lessons are the literal placeholder
   "Content for this lesson is maintained in Trainual", and they cluster badly. Measured against
   production:

   | Subject | Lessons | Usable | Usable chars | 10-question quiz? |
   |---|---:|---:|---:|---|
   | Safety Procedures | 23 | 2 | 1,485 | **refused** |
   | Our Products | 4 | 3 | 666 | **refused** |
   | Testing Training | 16 | 3 | 4,082 | **refused** (too few lessons) |
   | Using DryWare | 10 | 9 | 6,408 | yes |
   | Welcome to IAT | 6 | 6 | 16,705 | yes |

   The bar scales with the request: `questionCount × 300` characters and `max(3, ceil(n/3))` usable
   lessons. A refusal costs nothing and names the lessons that need writing.

2. **The model's own block.** Content can be long enough and still unquizzable (an index page, a
   list of links). The contract gives Claude a `{ "blocked": { reason, lessons } }` shape, and a
   prose reply degrades into that same path carrying its words — never a generic "malformed",
   which is the lesson the case-studies tool taught.

Generation also refuses (409) when a **published** quiz already exists — unpublish first, so
rebuilding can't silently swap a quiz people are being graded on.

### The answer key is never readable before you pass

- `learn_quiz_options` holds `is_correct` and has **no learner read policy at all** — one
  admin-only policy, service-role otherwise. Verify with:
  `SELECT tablename, COUNT(*) FROM pg_policies WHERE tablename LIKE 'learn_quiz%' GROUP BY 1;`
  — `learn_quiz_options` must be **1**.
- `getQuizForLearner()` doesn't even *select* `is_correct`, so it can't leak through a later
  refactor that spreads the row.
- ⚠️ The GRADE response carries `correctOptionId` **only on a passing attempt**. Returning it
  unconditionally was a real hole: `POST {"answers":{}}` handed back the whole key and a replay
  scored 100%, defeating the gate and the compliance report built on it.
- `getPublishedModuleQuizzes()` and `getAttemptSummaries()` **throw** on a read error rather than
  returning empty. `subjectIsComplete` treats "no quiz" as "lessons are enough", so an empty map
  would silently un-gate every subject — the one failure mode that must not be quiet.
- The client posts option ids only. `gradeAttempt()` re-reads the key server-side, and an option id
  belonging to a different question is treated as unanswered rather than credited (regression-tested).

Model: `claude-sonnet-5`. Note the older AI features (case studies, Jerry, form builder) are still
on `claude-sonnet-4-6`.

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

The Trainual-imported core is 5 categories · 14 modules · **357 published lessons**. Two courses have
been added since and are *not* in the table below: Control Panel Crash Course (10 lessons, 2026-08-06)
and Refrigeration & HVAC/R (18 subjects / 155 lessons, 2026-08-07) — both authored here rather than
imported, so neither carries placeholder bodies or missing images.

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

Jacob's 2026-07-30 priority list, with the first two now shipped:

1. ~~**Assignments + completion reporting**~~ — **done**, migration 076. See above.
2. ~~**Quizzes**~~ — **done**, migration 074. See above.
3. **Content backfill** — the 33 placeholder bodies and ~180 missing images. **No longer blocked**
   — image upload shipped 2026-08-04 (see below) — but still the thing blocking quizzes for
   Safety Procedures, Testing Training and Our Products.
4. **The rest of authoring CRUD** — **delete is done** (see above), lessons can be created and
   edited, and **image upload is done** (see below). Still missing: **creating** categories and
   subjects (seed-only — an admin cannot add a new subject without SQL), **renaming** subjects
   and lessons from the tree, and **reordering** anything (`display_order` has no write path).

## Interactive lessons + the Control Panel Crash Course (2026-08-06)

Lessons can embed **interactive exercises**: a marker div in the body —

```html
<div data-interactive="cpco-sim" data-scenario="bacnet-instance"></div>
```

— renders as a real component. Three exercises are registered: `cpco-sim` (the c.pCO panel
simulator, optional `data-scenario` for a graded task, `data-guided="true"` to show all hints),
`cpco-points` (the BACnet point explorer) and `cpco-alarm-lab` (fault injection). The first course
using them is **Control Panel Crash Course** (migration 082, Technical Training, 10 lessons).

### The moving parts

| Piece | File |
|---|---|
| Marker split/build | `lib/learn-interactive.ts` — pure string work, no DOM |
| Reader | `components/learn/LessonContent.tsx` — **guarded**: no marker → the byte-identical old `dangerouslySetInnerHTML` path |
| Registry | `components/learn/InteractiveBlockView.tsx` (`'use client'` — the value imports stay behind the boundary) |
| Editor node | `components/learn/admin/InteractiveBlock.tsx` — same job/hazard as `ImagePlaceholder`; without it, opening a lesson with an exercise and saving **deletes the exercise** |
| Simulator engine | `lib/cpco/` — display grid, keypress reducer, menu trees as data, the 38-object point list, graded scenarios |
| Attempts | `learn_sim_attempts` (081) + `POST /api/learn/sim-attempt` — session-scoped like progress; best run kept, `passed` sticky |
| Workbench | `/admin/tools/panel` (`tools` perm) — deliberately NOT in the launchers; the tracked course is the front door |

A passed scenario posts the attempt, then completes the lesson through the ordinary
`/api/learn/progress` route — XP, streaks, badges and the assignments report needed no changes.

### Verify scripts (run on any change to these areas)

- `node --import ./scripts/ts-resolve.mjs scripts/verify-cpco.mjs` — walks the BACnet setup
  procedure keystroke-for-keystroke, asserting **literal screen text typed from the source PDF**
  (never read back out of the trees). 38 checks. A red run means a tree drifted from the panel.
- `node --import ./scripts/ts-resolve.mjs scripts/verify-learn-interactive.mjs` — the splitter
  guard: bodies without a marker must come back byte-identical.
- **On every TipTap bump**, extend the existing jsdom round-trip harness to also assert
  `data-interactive` markers survive open/save (same method as `img-missing`: esbuild-bundle the
  real nodes, diff old-version output vs new-version output).

### Facts the course is built on (sourced, not vibes)

CAREL c.pCO manual +0300057EN rel 1.4; IAT's "How to setup the BACnet instance" (one screenshot
per keystroke — the simulator spec); `BACnet_Documentation.xls` → `lib/cpco/points.ts`. The
export has **three label defects** (25/26 say "Pre" for post-cool/post-heat; 14/15 descriptions
swapped) — surfaced in the point explorer, flagged to engineering. The LCD hex in `globals.css`
(`.cpco-*`) is a deliberate token exception: it reproduces a physical part and must not follow
the theme.

### Blocked on the SOO + screen captures

Unit schematic with real sensor positions, setpoint behaviour lessons, the rest of the IAT menu
tree (menu entries the procedure never shows are carried as `—` with `optional: true` — fill
them from captures, don't invent), the password tiers, and the capstone quiz.

## The Refrigeration & HVAC/R course (2026-08-07, migrations 085 + 086)

The library's largest course: a new **`refrigeration-hvacr`** category holding **17 teaching
subjects + 1 closing subject, 155 lessons, 18 quizzes, 170 questions**. Ported from a standalone
HTML course Jacob supplied, rebuilt on the portal's own reader, progress, XP and quiz engine.

### It is generated, not authored

`scripts/gen-hvacr-course.mjs` reads `scripts/hvacr-course/{modules,quick,branch}.json` and writes
**four** files — migrations `085` (category, subjects, lessons) and `086` (quizzes), plus the
runtime data modules `lib/hvacr/branch.ts` and `lib/hvacr/terms.ts`. The bodies are 176k characters
of prose; hand-editing them would drift from the source with nothing to diff against. Re-run the
script rather than editing any of those four.

Each subject becomes: an **Overview** lesson (objectives + the subject's hero widget), one lesson
per source section (at-a-glance bullets, then the full explanation), a **Practice** lesson holding
the drills, and a **Key terms** flashcard lesson.

### The closing subject, the capstone, and the certificate

`course-completion` is the 18th subject and carries no teaching content — an explainer for the exam
and the certificate block. The **final exam** is a *category-scoped* quiz: 34 questions, two drawn
from each subject. Being category-scoped it **gates nothing**, by design; each subject still
completes on its own lessons plus its own module quiz.

`GET /api/learn/hvacr-certificate` decides eligibility **server-side**, using the same
`subjectIsComplete()` (quiz gate included) as the library pages and the assignments report — the
agreement that stops a certificate congratulating someone the compliance report shows as overdue. It
excludes `course-completion` from the requirement, and dates the award from the last thing that
actually happened rather than `now()`, so it doesn't re-date itself on every page load.

### Interactive blocks: the catalogue types the registry

`lib/learn-blocks.ts` is the single list of every block a lesson may embed — for **both** courses.
It is consumed three ways, and the middle one is the load-bearing part:

| Consumer | What it gets |
|---|---|
| `InteractiveBlockView.tsx` | types its registry `Record<InteractiveBlockName, …>` — a catalogued name with no component is a **compile error** |
| `LessonEditor.tsx` | builds the author's insert menu, including per-block parameter pickers |
| `gen-hvacr-course.mjs` | asserts every marker it writes is catalogued |

Together those mean a marker in a seed can no longer ship as a silent "isn't available" note.

The 24 HVAC/R widgets live in `components/hvacr/`. Six are react-three-fiber models sharing
`Scene3D.tsx`; the rest are SVG/DOM. Datasets for the drills are in `lib/hvacr/exercises.ts`, keyed
by the marker's `data-set`, so a new drill is a data entry rather than a new component.

### Three traps in this area

- ⚠️ **`next/dynamic` needs a literal options object at the call site.** Hoisting the shared
  `{ ssr: false }` into a const and spreading it type-checks cleanly and then **500s every lesson
  page** ("next/dynamic options must be an object literal", enforced by SWC, not TS). The options in
  `InteractiveBlockView.tsx` are written out one by one on purpose — do not DRY them up.
- ⚠️ **Shuffles must not run during render.** These widgets are `'use client'`, which still
  server-renders the first pass, so `Math.random()` in a render body or a `useState` initialiser is a
  hydration mismatch. `components/hvacr/use-shuffle.ts` paints the source order and shuffles in an
  effect.
- ⚠️ **`lib/hvacr/palette.ts` is a sanctioned token exception**, like `UnitScene.tsx` and the
  `.cpco-*` LCD hex. WebGL materials cannot read CSS variables, and blue-is-cold / orange-is-hot is
  physics rather than branding — re-toning it per theme would make the models teach the wrong thing.
  It is the *only* place raw colour appears in this feature; all chrome is on semantic tokens.

### Practice drills are ungraded on purpose

The drills reveal their answer and explanation on a wrong attempt, and write **nothing** to
`learn_progress` or `learn_sim_attempts`. That is the opposite of the graded quizzes, whose key
never reaches the browser, and the difference is deliberate: one is a rehearsal, the other feeds the
compliance report. `/api/learn/sim-attempt` was left alone — it still validates against the c.pCO
scenario registry only.

### Verifying

```
node scripts/gen-hvacr-course.mjs                      # regenerate; asserts markers + answer keys
node --env-file=.env.local --import ./scripts/ts-resolve.mjs \
  scripts/verify-hvacr-certificate.mjs                 # 17 checks against production
```

The second script checks the certificate route's data logic *and* re-parses every seeded lesson body
through `splitLessonHtml`, asserting all 55 markers resolve to a catalogued widget with valid
params. Learn pages are login-gated, so widgets were browser-verified through a temporary
unauthenticated route (the middleware matcher is a prefix whitelist, so an unlisted top-level path
renders without a session) — and **the Browser pane does not composite, so WebGL canvases never size
and screenshots time out there**; use headed Playwright from inside `iat-forms-portal`.

## Images in the lesson editor (2026-08-04)

`components/learn/admin/LessonEditor.tsx`. Three ways in — the toolbar button, drag-and-drop,
and pasting a screenshot — all of which upload. **There is no way to insert an external image
URL**, so every image in a lesson is one we host.

Uploads go **browser → Supabase Storage directly**, using a one-shot signed URL from
`/api/upload` (`lib/lesson-images.ts`); the bytes never touch a route handler, because Vercel's
~4.5MB function body limit is under a typical phone photo. Public `form-uploads` bucket, 10MB
(the bucket's own `file_size_limit`, migration 021), JPG/PNG/GIF/WebP. SVG and HEIC are refused
by name with a message saying what to do instead. Save is disabled while an upload is in flight.

### ⚠️ `figure.img-missing` is a real node — do not remove it

The 133 lessons in the table above carry `<figure class="img-missing">` markers from the Trainual
import, each with a figcaption naming the image that couldn't be carried over.

**StarterKit has no `figure` node.** Before `components/learn/admin/ImagePlaceholder.tsx` existed,
ProseMirror parsed the marker as unknown, dropped the wrapper, and re-serialized the caption as a
bare `<p>` — so opening one of those lessons and pressing Save destroyed the placeholder.
Confirmed against all 133 production rows: without the node, 133/133 lose it; with it, 133/133
survive with identical captions.

The node view renders the marker as the upload target — a dashed card with **Add image** and a
remove button (some markers stood in for things that were never a still image; one is an embedded
YouTube video). Replacing one carries the Trainual description over as **alt text**.

`renderHTML` must keep emitting `<figure class="img-missing"><figcaption>…</figcaption></figure>`
verbatim: the read-side styling in `app/globals.css` keys off that exact selector, and any change
rewrites all 133 rows. (12 of the 133 captions contain HTML entities; `&quot;` re-serializes as a
literal `"`. Same rendering, same text — cosmetic only.)

**Re-verify this on every TipTap bump.** The check is a jsdom harness that esbuild-bundles the
real `ImagePlaceholder.tsx` and round-trips all 133 rows — no dev server, no auth. Two things to
get right, both of which will otherwise mislead you:

- **Diff old-version output against new-version output, not input against output.** A round trip
  is already lossy at the byte level on 124 of the 133 rows on a known-good build: ProseMirror
  wraps `<li>text` as `<li><p>text` and drops the whitespace between block tags. Both preserve
  content — no tag is ever removed and the visible words are identical — but an input-vs-output
  byte check looks like total failure on a perfectly safe bump.
- **Pin the scratch install to the PR lockfile's `prosemirror-model` / `prosemirror-view`**, which
  is where parse and serialize actually live. Dependabot's table lists only the `@tiptap/*`
  packages; the lockfile moved 32 entries.

Verified clean through **@tiptap 3.29.2 / prosemirror-model 1.25.11** (PR #35, 2026-08-05):
0 differences across all 133 rows.

### Known gap

Pasting rich HTML copied from a web page still brings that page's `<img>` tags in as **external
hotlinks**, which will rot when the source moves. Pre-existing TipTap behaviour, not introduced
by the upload work, but it's the one hole in "every image is one we host".
