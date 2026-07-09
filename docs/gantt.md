# Gantt / Project Timelines (`/admin/gantt`)

Phase 1 — 2026-07-01. v2 "Honest Schedules" — 2026-07-02. v2.1 "Living Schedule"
(per-task status + actuals + health) — built 2026-07-02. An internal, admin-only
tool for building and tracking **customer project schedules** as interactive Gantt
charts. Born from a Sales request for a schedule on a specific customer build (the
"Auckland" unit); made a persistent portal tab so charts save, update, and live in
one place.

## v2: the chart is a forecast, not a promise

Leadership's critique of v1 — *"deceptive and deep, with a ton of nuances and
conditional IF-THEN statements"* — decoded to two classic Gantt failure modes,
each fixed with the industry-standard mechanism:

| Problem | Fix (v2) |
|---|---|
| **False precision** — single-date bars, silent replanning | Ship **windows** everywhere (never one date), range rendering on bars, milestone whiskers, **baselines** with variance chips, **P50/P80/P90** Monte Carlo confidence dates |
| **Rules live outside the chart** — failure loops / IF-THENs in heads or Excel | **Per-task risk rules** `{prob %, delay range, note}` (probabilistic branching à la RiskyProject), what-if toggles, and a 5,000-run simulation that prices unfired risks |

The discipline baked into the copy: *commit externally to P80, never the plan
date* (QSRA practice). The printed sheet carries the window headline, what-if
labeling, baseline variance, the risk register, assumptions, and a "Forecast, not
a commitment" footer — a shared chart can't shed its caveats.

## Who it's for
Admin-only (every read/write is admin-gated). Sales/PM users get access by being
given an `admin` role temporarily; role-based access (Sales sees Gantt but not
PTO/Time Off) is planned but **not yet built**.

## The model
A timeline is a **linear finish-to-start chain** (deliberately — dependency graphs
/ parallel tracks are where you buy MS Project; our niche is linear custom-unit
projects with honest uncertainty):

- **Ranges.** Every task carries `[durMin, durMax]`. Three lanes are always
  computed (best / likely / worst); the likely lane draws the solid bars, the
  worst lane draws each bar's faded extension and the accumulated milestone
  whiskers, and best–worst is the ship window.
- **Anchor** — exactly one task (e.g. "LLI procurement"): the long-lead driver.
  Its plan value is `durMin` (dragged via the arrival pill / slider,
  spread-preserving); its `durMax` feeds only the range + simulation.
- **Risk rules** — any task can carry risks `{prob %, delayMin–delayMax, note,
  fired}`; several per task. Unfired risks contribute **zero** to the drawn plan
  (only the simulation prices them). "Fired" = a persisted what-if that adds the
  delay to every lane and is loudly labeled on screen and in print.
- **Baseline** — freezes the computed schedule as **absolute dates** (so a later
  `start_date` edit can't drag the baseline along). Ghost bars render under live
  bars; variance chips show slip vs baseline; set/clear is audit-logged.
  What-ifs are excluded from variance on both sides (plan vs plan).
- **Monte Carlo** — ~5,000 client-side runs (triangular duration sampling,
  Bernoulli risks, RNG seeded from a hash of the tasks so results are stable
  across renders) → P50/P80/P90 ship dates, histogram, per-risk hit impact.
  Runs in single-digit ms in a `useMemo`.
- **Assumptions register** — editable list, printed with the chart.
- **Living schedule (v2.1)** — every task carries a status (not started / underway
  / done). Marking a task **done** records its actual end (seeded from the plan,
  editable as a date) and **pins the chain to reality**: all three lanes collapse
  to the actual, downstream reflows from it, its risks leave the simulation, and
  the ship window narrows as work completes. When the anchor is done, arrival is
  fact — the drag pill and slider are replaced by an "arrived" note. **Health**
  is computed vs the baseline per task (≤0.5 wks on-track, ≤2 at-risk, >2
  slipped) and only deviations speak (amber/rose "+X wks vs baseline" in the
  label; on-plan stays quiet). Status lives inside the `tasks` jsonb — no
  migration.

Legacy v1 charts (chart-level `failure`/`reset_weeks`) migrate lazily:
`normalizeChart()` synthesizes the equivalent risk on the anchor (30% / reset
weeks) inside `layout()`/`layoutRange()`, so even the list page renders old rows
correctly; opening a chart in the editor materializes + persists the migration.
The old columns are DEPRECATED and never written again. New charts write
`reset_weeks: 0` so no phantom risk is synthesized.

## How it's built
- `lib/gantt.ts` — pure, import-free math shared by client + server: types,
  `normalizeChart`, `effDur`/`firedDelay`, `layoutRange` (+ `layout` wrapper),
  `makeBaseline` / `baselineVariance`, `monteCarlo` / `mulberry32` /
  `hashChartInputs`, templates.
- `lib/gantt-data.ts` — server reads via `supabaseAdmin`.
- `app/admin/gantt/actions.ts` — admin-gated, audit-logged mutations; sanitizes
  tasks/risks/assumptions; `duplicateChart` deep-copies via spread-with-id-drop
  (never a field whitelist), resets `fired`, drops the baseline (a copy is a new
  plan).
- `app/admin/gantt/[id]/` — `GanttEditorClient.tsx` is the stateful shell (chart
  state, 600ms debounced autosave, drag logic); render-only siblings:
  `GanttChartView` (bars/ranges/whiskers/ghosts/pill), `TaskTable` (+ per-task
  risk editor), `ConfidencePanel`, `AssumptionsCard`, `PrintSheet`, `ui.tsx`.
  Baselines are computed **client-side** (`makeBaseline`) because chart truth
  lives in client state under the debounced autosave — a server-side snapshot
  would race stale data.
- Nav: **Gantt** in the `AdminSidebar` "IAT" section.

## Data model
- Migration `040_gantt_charts.sql` — the `gantt_charts` table, tasks inline jsonb,
  RLS-on/no-policies (service-role only).
- Migration `041_gantt_ranges_risks.sql` — adds `baseline jsonb` and
  `assumptions jsonb`; risks live inside the `tasks` jsonb (no new columns);
  marks `failure`/`reset_weeks` deprecated.

## Onboarding: sales guide + in-app tooltips (2026-07-09)
Sales found v2 powerful but opaque ("no idea how to use it"), so two low-risk
onboarding layers were added — **no logic/data changes**:

- **Guided tutorial PDF** — `docs/guides/gantt-sales-guide.html` (source) →
  `docs/guides/gantt-sales-guide.pdf` (12pp, branded). Plain-English, sales-first:
  the forecast-not-a-promise idea, a 60-second version, a tour of every control,
  "which date do I quote" (P80), the customer do/don't script, and a pin-up
  quick-reference card. Regenerate with `node docs/guides/render.mjs` (renders via
  the repo's existing Playwright/Chromium + inlines the logo through `sharp`; the
  HTML uses a `{{LOGO}}` placeholder). NOT in `public/` on purpose — the repo is
  public and the app admin-gates Gantt; serve it through an admin route if it ever
  needs an in-app link.
- **Hoverable `InfoTip` reminders** — a shared `InfoTip` in
  `app/admin/gantt/[id]/ui.tsx` (pure CSS hover + `focus-within`, `print:hidden`,
  left-aligned so it survives the `overflow-hidden` cards). Placed on the three top
  stats, the anchor slider, Baseline, the What-if row, Start date, and the
  Confidence / Assumptions / Tasks headers, plus a one-hover tool summary on the
  list page. Copy is deliberately non-technical ("the date to quote a customer",
  "safe and private", "no undo — Duplicate first"). All copy was accuracy-checked
  against `lib/gantt.ts` (a 4-lens review flagged only softening "plan = exactly
  50/50", now "around 50/50, sometimes worse").

## Not yet (planned)
- AI-seed a chart from a plain-English description; customer-facing read-only view.
- (Role-based access shipped separately 2026-07-02 — see
  `docs/roles-and-permissions.md`; Gantt is a grantable permission.)
- Optional: plainer wording on the printed `PrintSheet` ("Vs baseline" / "Risk
  register" read as jargon if a sheet is handed to a customer — though it's footer-
  labeled "IAT internal"). Not changed here; flagged for a later pass.

## Deploy
Run `041_gantt_ranges_risks.sql` in the Supabase SQL editor **before** deploying
v2 (the editor autosave writes the new columns and will error without them).
Verify: open the Auckland chart — same plan dates as v1, plus window/P80/baseline
controls; drag the arrival pill; set a baseline; toggle a risk chip; print.
