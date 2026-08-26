/* ────────────────────────────────────────────────────────────────────────────
   lib/engineering.ts — the Engineering domain: streams, statuses, and the
   schedule arithmetic behind every "ahead / behind / N days" badge in the
   section.

   🔴 DEPENDENCY-FREE ON PURPOSE. Client components (the status board, the task
   queue, the job detail) import VALUES from here — STREAMS, labels, tones,
   projectTask. If this file ever imports a module that reaches supabase-admin,
   that value import ships the service-role client to the browser and the page
   dies at hydration, past tsc and past a green server render. lib/report-shared.ts
   carries the same warning for the same reason, and for the same scar.

   Data access lives in lib/eng-data.ts. The playbook lives in lib/eng-playbook.ts.
   Only pure functions and constants belong here.
   ──────────────────────────────────────────────────────────────────────────── */

import type { Tone } from '@/components/admin/list'

export const DAY_MS = 86_400_000

// ─── Streams — the five buckets from the whiteboard, plus the sixth ──────────
//
// The first five are the modules drawn on the board on 2026-08-25, in the order
// they were drawn. `support` is the sixth and it is not decoration: the
// workbook's un-highlighted rows (Sales Support, Training, R&D, Testing Support,
// Production Cross-Check) are where a 60-hour week goes, and a system that only
// tracks job work cannot show that.

export const STREAMS = ['submittal', 'long_lead', 'bom', 'production', 'electrical', 'support'] as const
export type Stream = (typeof STREAMS)[number]

export const STREAM_LABELS: Record<Stream, string> = {
  submittal:  'Submittals',
  long_lead:  'Long-Lead Items',
  bom:        'Bill of Materials',
  production: 'Production / Design',
  electrical: 'Electrical Production',
  support:    'Support & Other',
}

/** Three-to-five letters for dense table cells and the wall board. */
export const STREAM_SHORT: Record<Stream, string> = {
  submittal: 'SUB', long_lead: 'LLI', bom: 'BOM',
  production: 'PROD', electrical: 'ELEC', support: 'OTHER',
}

// One hue per stream, from the sanctioned Tone palette. These are IDENTITY
// colors — a stream is the same color on the board, in the queue, on the
// dashboard card and in the report — which is the only reason color is earning
// its place here rather than being decorative (DESIGN.md §brand).
export const STREAM_TONE: Record<Stream, Tone> = {
  submittal: 'sky', long_lead: 'violet', bom: 'amber',
  production: 'emerald', electrical: 'rose', support: 'slate',
}

export const STREAM_BLURB: Record<Stream, string> = {
  submittal:  'Package, unit outline, electrical drawings — out to the customer.',
  long_lead:  'Items that have to be on order before the rest of the job can move.',
  bom:        'Mechanical and electrical bills of material, released to ordering.',
  production: 'The production package the floor builds from.',
  electrical: 'Drawings, BOM, PLC and HMI — the controls side of the unit.',
  support:    'Sales support, cross-checks, testing, training, R&D.',
}

// ─── Task status ─────────────────────────────────────────────────────────────

export const TASK_STATUSES = ['not_started', 'in_progress', 'blocked', 'done', 'skipped'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked:     'Blocked',
  done:        'Done',
  skipped:     'Not required',
}

export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  not_started: 'slate',
  in_progress: 'sky',
  // Violet, not amber — the same distinction the ticket queue draws between
  // "we are working it" and "we are waiting on somebody else". Blocked work is
  // not slow work, and a manager needs to tell them apart at a glance.
  blocked:     'violet',
  done:        'emerald',
  skipped:     'slate',
}

/** Statuses that still represent outstanding work. */
export const OPEN_STATUSES: readonly TaskStatus[] = ['not_started', 'in_progress', 'blocked']

// ─── Jobs ────────────────────────────────────────────────────────────────────

export const JOB_STATUSES = ['active', 'on_hold', 'complete', 'cancelled'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  active: 'Active', on_hold: 'On hold', complete: 'Complete', cancelled: 'Cancelled',
}
export const JOB_STATUS_TONE: Record<JobStatus, Tone> = {
  active: 'sky', on_hold: 'violet', complete: 'emerald', cancelled: 'slate',
}

// Straight off the monday Submittals board's Complexity column, which is what
// actually predicts how long a submittal takes.
export const COMPLEXITIES = ['new', 'std_major', 'std_minor'] as const
export type Complexity = (typeof COMPLEXITIES)[number]
export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  new: 'New design', std_major: 'Standard — major', std_minor: 'Standard — minor',
}

// ─── Row shapes ──────────────────────────────────────────────────────────────

export type EngJob = {
  id: string
  job_number: string
  customer_name: string
  project_name: string
  model_number: string | null
  complexity: Complexity
  po_date: string | null
  ship_date: string | null
  status: JobStatus
  deal_id: string | null
  customer_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type EngTask = {
  id: string
  job_id: string | null
  stream: Stream
  step: string
  title: string
  assignee_id: string | null
  status: TaskStatus
  progress: number
  progress_band: number | null
  target_hours: number | null
  actual_hours: number | null
  due_date: string | null
  started_at: string | null
  completed_at: string | null
  priority: number
  sort_order: number
  blocked_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** A task with the two things every screen shows next to it. */
export type EngTaskRow = EngTask & {
  job_number: string | null
  customer_name: string | null
  assignee_name: string | null
}

// ─── The schedule projection ─────────────────────────────────────────────────
//
// This is the "AI can predict whether tasks are trending late" ask from the
// meeting, and it is deliberately ARITHMETIC rather than a model. Three reasons:
// it is auditable (a manager can be shown the sum), it is stable (the same task
// on the same day always reads the same, so "behind by 3 days" cannot quietly
// become "behind by 5" because a model was re-rolled), and it costs nothing.
//
// The method, in one line: at the point where 60% of a task's window has been
// used up, a task that is 30% done is running at half pace, so it will land at
// twice its window — and the difference between that and the due date is the
// number the badge prints.
//
//   elapsedFrac  = (today − start) / (due − start)
//   projectedEnd = start + (elapsed / progressFrac)
//   varianceDays = due − projectedEnd        (negative ⇒ behind by N days)
//
// ── Where it refuses to answer ──────────────────────────────────────────────
// A projection needs a start, a due date and some progress. Missing any of the
// three returns kind 'unknown' and the UI prints an em dash. That matters more
// than it sounds: progress = 0 would divide by zero and, clamped, would report
// every freshly-opened task as catastrophically late — a board where everything
// is red is a board nobody reads.

export type ProjectionKind =
  | 'done_early' | 'done_late' | 'done_on_time'
  | 'overdue'    | 'behind'    | 'at_risk' | 'on_track' | 'ahead'
  | 'not_started' | 'blocked'  | 'unknown'

export type Projection = {
  kind: ProjectionKind
  /** Whole days. Positive = to the good (early / spare), negative = late. */
  varianceDays: number | null
  /** Percent of the window used up. Null when there is no window to speak of. */
  elapsedPct: number | null
  /** What a linear pace says you should be at right now. Null when unknowable. */
  expectedPct: number | null
  /** One short sentence, safe to print as-is. */
  label: string
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS)

/** "3 days" / "1 day" — used inside every projection label. */
export function days(n: number): string {
  const a = Math.abs(n)
  return `${a} day${a === 1 ? '' : 's'}`
}

/**
 * Where this task stands against its own due date. `now` is injectable so the
 * report, the digest mailer and the tests all agree on "today" instead of each
 * reading the clock at a slightly different moment.
 */
export function projectTask(t: Pick<EngTask, 'status' | 'progress' | 'due_date' | 'started_at' | 'created_at' | 'completed_at'>, now: Date = new Date()): Projection {
  const due = t.due_date ? new Date(`${t.due_date}T23:59:59`) : null

  // ── Finished ──────────────────────────────────────────────────────────────
  if (t.status === 'done' || t.status === 'skipped') {
    if (!due || !t.completed_at) {
      return { kind: 'done_on_time', varianceDays: null, elapsedPct: 100, expectedPct: 100, label: 'Done' }
    }
    const v = dayDiff(due, new Date(t.completed_at))
    if (v > 0) return { kind: 'done_early', varianceDays: v, elapsedPct: 100, expectedPct: 100, label: `Finished ${days(v)} early` }
    if (v < 0) return { kind: 'done_late', varianceDays: v, elapsedPct: 100, expectedPct: 100, label: `Finished ${days(v)} late` }
    return { kind: 'done_on_time', varianceDays: 0, elapsedPct: 100, expectedPct: 100, label: 'Finished on time' }
  }

  // ── Open, but with nothing to measure against ─────────────────────────────
  if (!due) {
    return {
      kind: t.status === 'blocked' ? 'blocked' : 'unknown',
      varianceDays: null, elapsedPct: null, expectedPct: null,
      label: t.status === 'blocked' ? 'Blocked' : 'No due date',
    }
  }

  // ── Past its date. No arithmetic needed and none is wanted: an overdue task
  //    is overdue whatever its progress bar claims. ─────────────────────────
  const overdueBy = dayDiff(now, due)
  if (overdueBy > 0) {
    return {
      kind: 'overdue', varianceDays: -overdueBy, elapsedPct: 100, expectedPct: 100,
      label: `Overdue by ${days(overdueBy)}`,
    }
  }

  // The window. started_at when we have it (a task picked up late has a shorter
  // real window than its plan assumed, and that is exactly what we want to
  // measure); created_at otherwise.
  const start = new Date(t.started_at ?? t.created_at)
  const windowDays = Math.max(1, dayDiff(due, start))
  const usedDays = Math.max(0, dayDiff(now, start))
  const elapsedPct = Math.min(100, Math.round((usedDays / windowDays) * 100))

  if (t.status === 'blocked') {
    return { kind: 'blocked', varianceDays: dayDiff(due, now), elapsedPct, expectedPct: elapsedPct, label: `Blocked · due in ${days(dayDiff(due, now))}` }
  }

  if (t.status === 'not_started' || t.progress <= 0) {
    const left = dayDiff(due, now)
    return {
      kind: 'not_started', varianceDays: left, elapsedPct, expectedPct: elapsedPct,
      // Deliberately NOT projected. See the header — a 0% task projects to
      // infinity, and a board where every new task is red is a board nobody reads.
      label: `Not started · ${days(left)} left`,
    }
  }

  // ── The projection ────────────────────────────────────────────────────────
  const progressFrac = t.progress / 100
  const projectedDays = usedDays / progressFrac
  const projectedEnd = new Date(startOfDay(start).getTime() + projectedDays * DAY_MS)
  const varianceDays = dayDiff(due, projectedEnd)

  if (varianceDays < 0) {
    return { kind: 'behind', varianceDays, elapsedPct, expectedPct: elapsedPct, label: `Trending ${days(varianceDays)} late` }
  }
  // "At risk" is the band where a task is still projected to land on time but
  // has no room left. Without it the board flips straight from green to red the
  // day something slips, which is the late warning arriving too late to act on.
  if (varianceDays === 0) {
    return { kind: 'at_risk', varianceDays, elapsedPct, expectedPct: elapsedPct, label: 'No slack left' }
  }
  if (t.progress < elapsedPct - 15) {
    return { kind: 'at_risk', varianceDays, elapsedPct, expectedPct: elapsedPct, label: `Behind pace · ${t.progress}% at ${elapsedPct}% of the window` }
  }
  if (t.progress > elapsedPct + 15) {
    return { kind: 'ahead', varianceDays, elapsedPct, expectedPct: elapsedPct, label: `Ahead · ${days(varianceDays)} of slack` }
  }
  return { kind: 'on_track', varianceDays, elapsedPct, expectedPct: elapsedPct, label: `On track · ${days(varianceDays)} of slack` }
}

export const PROJECTION_TONE: Record<ProjectionKind, Tone> = {
  done_early: 'emerald', done_on_time: 'emerald', done_late: 'amber',
  overdue: 'rose', behind: 'rose', at_risk: 'amber',
  on_track: 'sky', ahead: 'emerald',
  not_started: 'slate', blocked: 'violet', unknown: 'slate',
}

/** The four kinds a manager is being paid to look at. */
export const AT_RISK_KINDS: readonly ProjectionKind[] = ['overdue', 'behind', 'at_risk', 'blocked']
export const isAtRisk = (p: Projection) => AT_RISK_KINDS.includes(p.kind)

// ─── Roll-ups ────────────────────────────────────────────────────────────────

/**
 * A stream's progress across one job, 0–100.
 *
 * Uses the playbook's completion BANDS when every step carries one (the Elec
 * sheet's 30 / 60 / 99 / 100), because those are real: finishing the drawings
 * genuinely puts an electrical job 30% of the way there, and an even split would
 * claim 25%. Falls back to a plain average of the per-task bars where the
 * workbook gives no percentages — which is honest, because for those streams
 * nobody has told us what the weights are.
 */
export function streamProgress(tasks: Pick<EngTask, 'progress' | 'progress_band' | 'status'>[]): number {
  const live = tasks.filter(t => t.status !== 'skipped')
  if (!live.length) return 0

  const banded = live.every(t => t.progress_band != null)
  if (banded) {
    // Highest band actually reached, plus partial credit for the step in flight.
    const sorted = [...live].sort((a, b) => (a.progress_band ?? 0) - (b.progress_band ?? 0))
    let floor = 0
    for (const t of sorted) {
      if (t.status === 'done') { floor = Math.max(floor, t.progress_band ?? 0); continue }
      if (t.progress > 0) {
        const prev = floor
        const band = t.progress_band ?? 0
        return Math.round(prev + ((band - prev) * t.progress) / 100)
      }
    }
    return floor
  }
  return Math.round(live.reduce((a, t) => a + t.progress, 0) / live.length)
}

/** Hours, formatted the way the workbook writes them. Null ⇒ "Not set". */
export function hours(n: number | null | undefined): string {
  if (n == null) return 'Not set'
  const v = Number(n)
  if (!Number.isFinite(v)) return 'Not set'
  return `${v % 1 === 0 ? v : v.toFixed(2).replace(/0$/, '')} hr`
}

/** Short date for dense cells. */
export function shortDate(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(`${d}T12:00:00`)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Add whole days to an ISO date (YYYY-MM-DD), returning the same shape.
 *  Calendar days, not working days — the workbook's cycle times ("2 weeks",
 *  "3 days") are written as calendar durations and are quoted to customers that
 *  way. Switching to working days would silently move every due date. */
export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
