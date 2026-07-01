# Gantt / Project Timelines (`/admin/gantt`)

Phase 1 — 2026-07-01. An internal, admin-only tool for building and tracking
**customer project schedules** as interactive Gantt charts. Born from a Sales
request for a schedule on a specific customer build (the "Auckland" unit); made a
persistent, shareable portal tab instead of a throwaway file so charts save,
update, and live in one place.

## Who it's for
Admin-only for now (every read/write is admin-gated). Sales/PM users get access by
being given an `admin` role temporarily. Role-based access (Sales sees Gantt but
not PTO/Time Off, etc.) is planned but **not yet built** — see "Not yet" below.

## The model
A timeline is a simple **finish-to-start chain**: each task starts when the
previous one ends. Two ideas make it useful for real projects:

- **Anchor** — exactly one task is flagged the anchor: the long-lead /
  critical-path driver (e.g. "LLI procurement"). Its end date is the **arrival**
  that drives everything downstream. You set its duration with the slider or by
  dragging the arrival pill on the chart; the whole tail re-cascades live.
- **Failure contingency** — a per-chart toggle that models a test failure
  requiring replacement long-lead parts: it pushes the anchor out by
  `reset_weeks` (shown as a red extension) and re-cascades. A Gantt can't draw a
  loop, so the "schedule reset" from the Sales brief is modeled as this push.

Ranged durations (`durMin`–`durMax`, e.g. 2–4 wks) feed a **Best / Likely / Worst**
scenario toggle so you show a *window*, not false-precision. Summary stats
(estimated ship, weeks-from-arrival, total weeks) recompute on every change.

The scheduling math lives in `lib/gantt.ts` (`layout()`, `effDur()`) as a pure,
server-safe module, so the list page and the interactive editor compute identical
dates.

## Data model (migration `040_gantt_charts.sql`)
- `gantt_charts` — one row per project timeline. Columns: `name`, `customer`,
  `status` (active/complete/draft), `start_date`, `scenario`, `failure`,
  `reset_weeks`, and `tasks` (jsonb array). Tasks are stored **inline as jsonb**
  (owned by the chart, small, always read/written as a whole) rather than a
  separate table. Each task: `{ id, name, kind:'task'|'milestone',
  cat:'routine'|'uncertain'|'build', owner, durMin, durMax, anchor }`.

`gantt_charts` is **service-role only** (RLS on, no policies) — every read/write
goes through `supabaseAdmin` behind admin-gated code, same posture as
`presentations` (039) and `digest_runs` (038). The browser never queries it.

## How it's built
- `lib/gantt.ts` — shared types + pure scheduling math + the Auckland/blank
  templates. No server imports (safe for client components).
- `lib/gantt-data.ts` — server-side reads (`listCharts`, `getChart`) via `supabaseAdmin`.
- `app/admin/gantt/actions.ts` — server actions (`createChart`, `updateChart`,
  `duplicateChart`, `deleteChart`), each guarded with `getAdminUser()`, audit-logged.
- `app/admin/gantt/page.tsx` + `GanttListClient.tsx` — the chart list (cards,
  est-ship, "New chart" / "New from Auckland template").
- `app/admin/gantt/[id]/page.tsx` + `GanttEditorClient.tsx` — the interactive
  editor: draggable arrival anchor, scenario toggle, failure sim, editable task
  table, live stats, and Print / PDF. Edits **autosave** (600 ms debounce) via
  `updateChart`.
- Nav: a **Gantt** item in the `AdminSidebar` "IAT" section (`CalendarRange` icon).

## Not yet (planned)
- **Role-based access.** Today anyone who can see the tab is an admin. Next:
  Admin sees everything; Sales sees Gantt but not PTO/Time Off, etc.
- **AI-seed** a chart from a plain-English project description (the Anthropic key
  is already wired for other features).
- A customer-facing read-only view (the data model doesn't change).

## Deploy
Run `supabase/migrations/040_gantt_charts.sql` by hand in the Supabase SQL editor
before deploying, then push. Verify: open `/admin/gantt`, create from the Auckland
template, drag the arrival pill, confirm it saves (reload).
