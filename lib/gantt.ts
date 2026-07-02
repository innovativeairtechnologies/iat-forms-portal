/* ────────────────────────────────────────────────────────────────────────────
   Gantt / Project Timelines — shared types + pure scheduling math.

   NO server imports (never pulls in supabaseAdmin) — safe to import from client
   components AND server code, so the schedule math is identical in both.

   The schedule is a finish-to-start chain: each task starts when the previous
   ends. One task is the `anchor` — the long-lead / critical-path driver — whose
   duration the user sets (slider/drag); its end date is the "arrival" that drives
   everything downstream.

   v2 ("honest schedules"): the chart is a FORECAST, not a promise.
   - Every task carries a [durMin, durMax] range; the chart always computes three
     lanes (best / likely / worst) and shows the ship WINDOW, never a single date.
   - Any task can carry risk rules ({prob %, delayMin–delayMax, note}) — the
     IF-THEN branches (test failure → replacement parts, vendor slip, …). A risk
     can be "fired" as a persisted, loudly-labeled what-if; unfired risks are
     priced only by the Monte Carlo simulation (P50/P80/P90 confidence dates).
   - A baseline freezes the computed schedule as ABSOLUTE dates so later edits
     can't silently rewrite history; variance is always shown against it.
   Legacy chart-level `failure`/`reset_weeks` are DEPRECATED — normalizeChart()
   lazily migrates them onto the anchor task's risks.
   ──────────────────────────────────────────────────────────────────────────── */

export type Scenario = 'best' | 'likely' | 'worst'
export type TaskKind = 'task' | 'milestone'
export type TaskCat = 'routine' | 'uncertain' | 'build'
export type ChartStatus = 'active' | 'complete' | 'draft'

export interface TaskRisk {
  id: string
  /** 0–100: % chance this risk fires (feeds Monte Carlo). */
  prob: number
  /** weeks added if it fires */
  delayMin: number
  delayMax: number
  note?: string
  /** what-if toggle: assume this risk happens. PERSISTED (a shared chart must
   *  look identical to every viewer) and loudly labeled on screen + print. */
  fired?: boolean
}

export interface GanttTask {
  id: string
  name: string
  kind: TaskKind
  cat: TaskCat
  owner?: string
  durMin: number
  durMax: number
  anchor?: boolean
  risks?: TaskRisk[]
}

export interface GanttAssumption {
  id: string
  text: string
}

/** Frozen snapshot of the computed schedule, in ABSOLUTE dates — so a later
 *  start_date change can't silently drag the baseline along with the plan.
 *  Always computed at the likely lane with all what-ifs off (plan, not what-if). */
export interface GanttBaseline {
  taken_at: string // ISO timestamp
  taken_by?: string
  label?: string
  start_date: string // chart start_date AT snapshot ('YYYY-MM-DD')
  ship: { best: string; likely: string; worst: string } // absolute 'YYYY-MM-DD'
  tasks: { id: string; name: string; start: string; end: string }[]
}

export interface GanttChart {
  id: string
  name: string
  customer: string | null
  status: ChartStatus
  start_date: string // 'YYYY-MM-DD'
  /** DEPRECATED since 041 — lanes are always all computed; kept for stored rows. */
  scenario: Scenario
  /** DEPRECATED since 041 — read only by normalizeChart(). */
  failure: boolean
  /** DEPRECATED since 041 — read only by normalizeChart(). */
  reset_weeks: number
  tasks: GanttTask[]
  baseline?: GanttBaseline | null
  assumptions?: GanttAssumption[]
  created_at?: string
  updated_at?: string
}

export interface LaidRow {
  t: GanttTask
  start: number // likely-lane start (weeks)
  base: number // likely duration
  extra: number // fired-risk weeks (likely lane)
  end: number // likely-lane end
}

export interface LaidRowRange extends LaidRow {
  /** accumulated best/worst chain ends — milestones whisker across these */
  endBest: number
  endWorst: number
  /** likely start + own worst duration — the bar's faded range extension cap */
  ownWorstEnd: number
  /** baseline ghost, weeks on the CURRENT axis (clamped at 0) */
  baseStart?: number
  baseEnd?: number
  baseClamped?: boolean
}

export function nid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 't' + Math.random().toString(36).slice(2, 10)
  }
}

/* ── durations ────────────────────────────────────────────────────────────── */

/** Effective duration (weeks) for a lane. Milestones = 0; the anchor is pinned
 *  to its set value (durMin) — its durMax feeds only the range extension + MC. */
export function effDur(t: GanttTask, sc: Scenario): number {
  if (t.kind === 'milestone') return 0
  const a = Number(t.durMin) || 0
  const b = Number(t.durMax) || a
  if (t.anchor) return a
  return sc === 'best' ? Math.min(a, b) : sc === 'worst' ? Math.max(a, b) : Math.round((a + b) / 2)
}

/** Lane duration for the accumulated window chains: unlike effDur, the anchor's
 *  durMax DOES stretch the worst lane (the ship window must be honest). */
function laneDur(t: GanttTask, lane: Scenario): number {
  if (t.kind === 'milestone') return 0
  if (t.anchor && lane === 'worst') {
    const a = Number(t.durMin) || 0
    return Math.max(a, Number(t.durMax) || a)
  }
  return effDur(t, lane)
}

function riskDelay(r: TaskRisk, lane: Scenario): number {
  const a = Math.max(0, Number(r.delayMin) || 0)
  const b = Math.max(a, Number(r.delayMax) || a)
  return lane === 'best' ? a : lane === 'worst' ? b : Math.round((a + b) / 2)
}

/** Σ fired-risk delay for a task at a lane. Unfired risks contribute ZERO to
 *  deterministic lanes — only the Monte Carlo prices them (by probability). */
export function firedDelay(t: GanttTask | undefined, lane: Scenario): number {
  if (!t || !t.risks || t.risks.length === 0) return 0
  return t.risks.reduce((s, r) => s + (r.fired ? riskDelay(r, lane) : 0), 0)
}

export function anchorTask(c: GanttChart): GanttTask | undefined {
  return c.tasks.find((t) => t.anchor)
}

/* ── legacy migration ─────────────────────────────────────────────────────── */

/** Lazily migrate the pre-041 chart-level failure/reset_weeks contingency onto
 *  the anchor task's risks. Non-mutating; returns the input unchanged when no
 *  migration is needed. Called INSIDE layout/layoutRange so even the list page
 *  renders legacy rows correctly without a persistence round-trip. */
export function normalizeChart(c: GanttChart): GanttChart {
  const hasRisks = c.tasks.some((t) => t.risks && t.risks.length > 0)
  const anchor = anchorTask(c)
  const reset = Number(c.reset_weeks) || 0
  if (hasRisks || !anchor || (!c.failure && reset <= 0)) return c
  const rw = reset || 8
  return {
    ...c,
    tasks: c.tasks.map((t) =>
      t.anchor
        ? {
            ...t,
            risks: [
              {
                id: 'legacy-failure',
                prob: 30,
                delayMin: rw,
                delayMax: rw,
                note: 'Test-failure contingency (migrated)',
                fired: !!c.failure,
              },
            ],
          }
        : t,
    ),
  }
}

/* ── layout ───────────────────────────────────────────────────────────────── */

const WEEK_MS = 7 * 24 * 3600 * 1000

/** Lay the chain out on a week axis across all three lanes.
 *  `ship` = likely total; `shipBest`/`shipWorst` = the window; `anchorEnd` = the
 *  likely-lane arrival week (incl. fired risks) — where the drag pill sits. */
export function layoutRange(c0: GanttChart): {
  rows: LaidRowRange[]
  ship: number
  shipBest: number
  shipWorst: number
  anchorEnd: number
} {
  const c = normalizeChart(c0)
  let curB = 0
  let curL = 0
  let curW = 0
  let anchorEnd = 0
  const rows: LaidRowRange[] = c.tasks.map((t) => {
    const start = curL
    const base = effDur(t, 'likely')
    const extra = firedDelay(t, 'likely')
    const end = start + base + extra
    const endBest = curB + laneDur(t, 'best') + firedDelay(t, 'best')
    const ownWorst = laneDur(t, 'worst') + firedDelay(t, 'worst')
    const endWorst = curW + ownWorst
    if (t.anchor) anchorEnd = end
    curL = end
    curB = endBest
    curW = endWorst
    return { t, start, base, extra, end, endBest, endWorst, ownWorstEnd: start + ownWorst }
  })

  if (c.baseline) {
    const s0 = parseDate(c.start_date).getTime()
    const byId = new Map(c.baseline.tasks.map((b) => [b.id, b]))
    for (const r of rows) {
      const b = byId.get(r.t.id)
      if (!b) continue
      const bs = (parseDate(b.start).getTime() - s0) / WEEK_MS
      const be = (parseDate(b.end).getTime() - s0) / WEEK_MS
      if (be < 0) continue // baseline entirely before the current axis
      r.baseClamped = bs < 0
      r.baseStart = Math.max(0, bs)
      r.baseEnd = be
    }
  }

  return { rows, ship: curL, shipBest: curB, shipWorst: curW, anchorEnd }
}

/** Likely-lane layout — thin wrapper kept so existing callers compile untouched. */
export function layout(c: GanttChart): { rows: LaidRow[]; ship: number; anchorEnd: number } {
  const R = layoutRange(c)
  return { rows: R.rows, ship: R.ship, anchorEnd: R.anchorEnd }
}

/* ── baseline ─────────────────────────────────────────────────────────────── */

function stripFired(c: GanttChart): GanttChart {
  const n = normalizeChart(c)
  return {
    ...n,
    tasks: n.tasks.map((t) =>
      t.risks && t.risks.some((r) => r.fired)
        ? { ...t, risks: t.risks.map((r) => ({ ...r, fired: false })) }
        : t,
    ),
  }
}

/** Snapshot the current computed schedule as absolute dates. CLIENT-side by
 *  design: chart truth lives in client state under a debounced autosave, so a
 *  server-side snapshot would race stale data. Baseline = the plan (likely lane,
 *  all what-ifs off). */
export function makeBaseline(c: GanttChart, takenBy?: string, label?: string): GanttBaseline {
  const R = layoutRange(stripFired(c))
  const iso = (w: number) => toISODate(addWeeks(c.start_date, w))
  return {
    taken_at: new Date().toISOString(),
    taken_by: takenBy,
    label,
    start_date: c.start_date,
    ship: { best: iso(R.shipBest), likely: iso(R.ship), worst: iso(R.shipWorst) },
    tasks: R.rows.map((r) => ({ id: r.t.id, name: r.t.name, start: iso(r.start), end: iso(r.end) })),
  }
}

/** Current plan vs baseline, in weeks (positive = slipped). What-ifs are
 *  excluded on both sides (plan vs plan, apples to apples — the fired banner
 *  carries the what-if story separately). */
export function baselineVariance(
  c: GanttChart,
): { shipDeltaWeeks: number; windowGrowthWeeks: number; startMovedWeeks: number } | null {
  const b = c.baseline
  if (!b) return null
  const R = layoutRange(stripFired(c))
  const round1 = (x: number) => Math.round(x * 10) / 10
  const curShip = addWeeks(c.start_date, R.ship).getTime()
  const curBest = addWeeks(c.start_date, R.shipBest).getTime()
  const curWorst = addWeeks(c.start_date, R.shipWorst).getTime()
  return {
    shipDeltaWeeks: round1((curShip - parseDate(b.ship.likely).getTime()) / WEEK_MS),
    windowGrowthWeeks: round1(
      (curWorst - curBest - (parseDate(b.ship.worst).getTime() - parseDate(b.ship.best).getTime())) / WEEK_MS,
    ),
    startMovedWeeks: round1((parseDate(c.start_date).getTime() - parseDate(b.start_date).getTime()) / WEEK_MS),
  }
}

/* ── Monte Carlo ──────────────────────────────────────────────────────────── */

/** Deterministic PRNG — seed from hashChartInputs so the same chart always
 *  yields the same histogram (no P80 shimmer between renders). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashChartInputs(c: GanttChart): number {
  const s = JSON.stringify(normalizeChart(c).tasks)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h >>> 0
}

/** Symmetric-triangular sample on [min,max] (mode = midpoint) via inverse CDF. */
function sampleTri(min: number, max: number, u: number): number {
  if (max <= min) return min
  return min + (max - min) * (u < 0.5 ? Math.sqrt(u / 2) : 1 - Math.sqrt((1 - u) / 2))
}

export interface MonteCarloResult {
  iterations: number
  /** ship stats in continuous weeks from start */
  ship: { p50: number; p80: number; p90: number; min: number; max: number; mean: number }
  histogram: { week: number; count: number }[]
  risks: {
    taskId: string
    taskName: string
    riskId: string
    note?: string
    prob: number
    hitRate: number
    /** mean ship (wks) in runs where it fired minus runs where it didn't */
    avgImpact: number
  }[]
}

/** Simulate the schedule: durations sampled triangular from each task's range
 *  (the anchor's range included), risks fire as independent Bernoulli(prob) —
 *  `fired` risks always fire — with a uniform delay in [delayMin, delayMax].
 *  Pure given `rng`; ~12 tasks × 5000 iterations runs in single-digit ms. */
export function monteCarlo(
  c0: GanttChart,
  opts?: { iterations?: number; rng?: () => number },
): MonteCarloResult {
  const c = normalizeChart(c0)
  const iterations = Math.max(100, opts?.iterations ?? 5000)
  const rng = opts?.rng ?? Math.random

  const riskRefs: { taskId: string; taskName: string; r: TaskRisk }[] = []
  for (const t of c.tasks) for (const r of t.risks ?? []) riskRefs.push({ taskId: t.id, taskName: t.name, r })

  const ships = new Float64Array(iterations)
  const agg = riskRefs.map(() => ({ hits: 0, shipHit: 0, shipMiss: 0 }))
  const fired: boolean[] = new Array(riskRefs.length)

  for (let i = 0; i < iterations; i++) {
    let ship = 0
    for (const t of c.tasks) {
      if (t.kind === 'milestone') continue
      const a = Math.max(0, Number(t.durMin) || 0)
      const b = Math.max(a, Number(t.durMax) || a)
      ship += sampleTri(a, b, rng())
    }
    for (let j = 0; j < riskRefs.length; j++) {
      const r = riskRefs[j].r
      const hit = r.fired ? true : rng() * 100 < (Number(r.prob) || 0)
      fired[j] = hit
      if (hit) {
        const dA = Math.max(0, Number(r.delayMin) || 0)
        const dB = Math.max(dA, Number(r.delayMax) || dA)
        ship += dA + (dB - dA) * rng()
      }
    }
    ships[i] = ship
    for (let j = 0; j < riskRefs.length; j++) {
      if (fired[j]) {
        agg[j].hits++
        agg[j].shipHit += ship
      } else agg[j].shipMiss += ship
    }
  }

  const sorted = Array.from(ships).sort((x, y) => x - y)
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]

  const lo = Math.round(sorted[0])
  const hi = Math.round(sorted[sorted.length - 1])
  // Bin into at most MAX_BINS buckets so a wide distribution (long-lead projects
  // can span 80+ weeks) doesn't render as a hundred 1px slivers. Each bucket key
  // is its start week; width is binW.
  const MAX_BINS = 48
  const binW = Math.max(1, Math.ceil((hi - lo + 1) / MAX_BINS))
  const counts = new Map<number, number>()
  for (let i = 0; i < iterations; i++) {
    const bin = lo + Math.floor((Math.round(ships[i]) - lo) / binW) * binW
    counts.set(bin, (counts.get(bin) ?? 0) + 1)
  }
  const histogram: { week: number; count: number }[] = []
  for (let w = lo; w <= hi; w += binW) histogram.push({ week: w, count: counts.get(w) ?? 0 })

  let mean = 0
  for (let i = 0; i < iterations; i++) mean += ships[i]
  mean /= iterations

  return {
    iterations,
    ship: { p50: q(0.5), p80: q(0.8), p90: q(0.9), min: sorted[0], max: sorted[sorted.length - 1], mean },
    histogram,
    risks: riskRefs.map(({ taskId, taskName, r }, j) => ({
      taskId,
      taskName,
      riskId: r.id,
      note: r.note,
      prob: Number(r.prob) || 0,
      hitRate: agg[j].hits / iterations,
      avgImpact:
        agg[j].hits > 0 && agg[j].hits < iterations
          ? agg[j].shipHit / agg[j].hits - agg[j].shipMiss / (iterations - agg[j].hits)
          : 0,
    })),
  }
}

/* ── dates + misc ─────────────────────────────────────────────────────────── */

export function parseDate(s: string): Date {
  const p = (s || '').split('-').map(Number)
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1)
}
export function addWeeks(startISO: string, w: number): Date {
  const d = parseDate(startISO)
  d.setDate(d.getDate() + Math.round(w * 7))
  return d
}
export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}
export function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}
/** "+3 wks" / "−1.5 wks" / "on plan" */
export function fmtDelta(w: number): string {
  if (Math.abs(w) < 0.05) return 'on plan'
  const v = Math.round(w * 10) / 10
  return `${v > 0 ? '+' : '−'}${Math.abs(v)} wk${Math.abs(v) === 1 ? '' : 's'}`
}

export const CAT_META: Record<TaskCat, { label: string }> = {
  routine: { label: 'routine step' },
  uncertain: { label: 'critical path (uncertain)' },
  build: { label: 'production build' },
}

/* ── templates (task shapes without ids; withIds() stamps ids) ────────────── */

export type TaskSeed = Omit<GanttTask, 'id' | 'risks'> & { risks?: Omit<TaskRisk, 'id'>[] }

export const AUCKLAND_TASKS: TaskSeed[] = [
  { name: 'Engineering release',      kind: 'milestone', cat: 'routine',   owner: 'Engineering',   durMin: 0,  durMax: 0 },
  { name: 'Auckland planning',        kind: 'task',      cat: 'routine',   owner: 'Sales / PM',    durMin: 1,  durMax: 1 },
  { name: 'LLI procurement',          kind: 'task',      cat: 'uncertain', owner: 'Procurement',   durMin: 10, durMax: 14, anchor: true },
  {
    name: 'Testing at Auckland Labs', kind: 'task',      cat: 'uncertain', owner: 'Auckland Labs', durMin: 2,  durMax: 4,
    risks: [{ prob: 25, delayMin: 6, delayMax: 10, note: 'Test failure → replacement LLI + retest' }],
  },
  { name: 'Final design release',     kind: 'milestone', cat: 'routine',   owner: 'Engineering',   durMin: 0,  durMax: 0 },
  { name: 'Production build',         kind: 'task',      cat: 'build',     owner: 'Production',    durMin: 6,  durMax: 8 },
  { name: 'Final testing & FAT',      kind: 'task',      cat: 'routine',   owner: 'QC',            durMin: 2,  durMax: 2 },
  { name: 'Shipment',                 kind: 'milestone', cat: 'routine',   owner: 'Logistics',     durMin: 0,  durMax: 0 },
]

export const BLANK_TASKS: TaskSeed[] = [
  { name: 'Kickoff',  kind: 'milestone', cat: 'routine',   durMin: 0, durMax: 0 },
  { name: 'Phase 1',  kind: 'task',      cat: 'uncertain', durMin: 2, durMax: 4, anchor: true },
  { name: 'Delivery', kind: 'milestone', cat: 'routine',   durMin: 0, durMax: 0 },
]

export function withIds(tasks: TaskSeed[]): GanttTask[] {
  return tasks.map((t) => ({
    ...t,
    id: nid(),
    risks: t.risks?.map((r) => ({ ...r, id: nid() })),
  }))
}
