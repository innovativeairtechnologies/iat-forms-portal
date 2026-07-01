/* ────────────────────────────────────────────────────────────────────────────
   Gantt / Project Timelines — shared types + pure scheduling math.

   NO server imports (never pulls in supabaseAdmin) — safe to import from client
   components AND server code, so the schedule math is identical in both.

   The schedule is a finish-to-start chain: each task starts when the previous
   ends. One task is the `anchor` — the long-lead / critical-path driver — whose
   duration the user sets (slider/drag); its end date is the "arrival" that drives
   everything downstream. A `failure` toggle pushes the anchor out by `reset_weeks`
   (replacement long-lead parts), which cascades the whole tail.
   ──────────────────────────────────────────────────────────────────────────── */

export type Scenario = 'best' | 'likely' | 'worst'
export type TaskKind = 'task' | 'milestone'
export type TaskCat = 'routine' | 'uncertain' | 'build'
export type ChartStatus = 'active' | 'complete' | 'draft'

export interface GanttTask {
  id: string
  name: string
  kind: TaskKind
  cat: TaskCat
  owner?: string
  durMin: number
  durMax: number
  anchor?: boolean
}

export interface GanttChart {
  id: string
  name: string
  customer: string | null
  status: ChartStatus
  start_date: string // 'YYYY-MM-DD'
  scenario: Scenario
  failure: boolean
  reset_weeks: number
  tasks: GanttTask[]
  created_at?: string
  updated_at?: string
}

export interface LaidRow {
  t: GanttTask
  start: number
  base: number
  extra: number
  end: number
}

export function nid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 't' + Math.random().toString(36).slice(2, 10)
  }
}

/** Effective duration (weeks) for the active scenario. Milestones = 0; the
 *  anchor uses its set value (durMin); ranged tasks pick min / mid / max. */
export function effDur(t: GanttTask, sc: Scenario): number {
  if (t.kind === 'milestone') return 0
  const a = Number(t.durMin) || 0
  const b = Number(t.durMax) || a
  if (t.anchor) return a
  return sc === 'best' ? Math.min(a, b) : sc === 'worst' ? Math.max(a, b) : Math.round((a + b) / 2)
}

export function anchorTask(c: GanttChart): GanttTask | undefined {
  return c.tasks.find((t) => t.anchor)
}

/** Lay the chain out on a week axis. `ship` = total weeks to the last task's end;
 *  `anchorEnd` = the arrival week (incl. any failure reset). */
export function layout(c: GanttChart): { rows: LaidRow[]; ship: number; anchorEnd: number } {
  let cur = 0
  let anchorEnd = 0
  const rows = c.tasks.map((t) => {
    const start = cur
    const base = effDur(t, c.scenario)
    const extra = t.anchor && c.failure ? Number(c.reset_weeks) || 0 : 0
    const end = start + base + extra
    if (t.anchor) anchorEnd = end
    cur = end
    return { t, start, base, extra, end }
  })
  return { rows, ship: cur, anchorEnd }
}

export function addWeeks(startISO: string, w: number): Date {
  const d = new Date(startISO + 'T00:00:00')
  d.setDate(d.getDate() + Math.round(w * 7))
  return d
}
export function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}
export function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export const CAT_META: Record<TaskCat, { label: string }> = {
  routine: { label: 'routine step' },
  uncertain: { label: 'critical path (uncertain)' },
  build: { label: 'production build' },
}

// ── Templates (task shapes without ids; withIds() stamps ids) ─────────────────
export const AUCKLAND_TASKS: Omit<GanttTask, 'id'>[] = [
  { name: 'Engineering release',      kind: 'milestone', cat: 'routine',   owner: 'Engineering',   durMin: 0,  durMax: 0 },
  { name: 'Auckland planning',        kind: 'task',      cat: 'routine',   owner: 'Sales / PM',    durMin: 1,  durMax: 1 },
  { name: 'LLI procurement',          kind: 'task',      cat: 'uncertain', owner: 'Procurement',   durMin: 10, durMax: 10, anchor: true },
  { name: 'Testing at Auckland Labs', kind: 'task',      cat: 'uncertain', owner: 'Auckland Labs', durMin: 2,  durMax: 4 },
  { name: 'Final design release',     kind: 'milestone', cat: 'routine',   owner: 'Engineering',   durMin: 0,  durMax: 0 },
  { name: 'Production build',         kind: 'task',      cat: 'build',     owner: 'Production',    durMin: 6,  durMax: 8 },
  { name: 'Final testing & FAT',      kind: 'task',      cat: 'routine',   owner: 'QC',            durMin: 2,  durMax: 2 },
  { name: 'Shipment',                 kind: 'milestone', cat: 'routine',   owner: 'Logistics',     durMin: 0,  durMax: 0 },
]

export const BLANK_TASKS: Omit<GanttTask, 'id'>[] = [
  { name: 'Kickoff',  kind: 'milestone', cat: 'routine',   durMin: 0, durMax: 0 },
  { name: 'Phase 1',  kind: 'task',      cat: 'uncertain', durMin: 2, durMax: 4, anchor: true },
  { name: 'Delivery', kind: 'milestone', cat: 'routine',   durMin: 0, durMax: 0 },
]

export function withIds(tasks: Omit<GanttTask, 'id'>[]): GanttTask[] {
  return tasks.map((t) => ({ ...t, id: nid() }))
}
