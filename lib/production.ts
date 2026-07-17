// ─────────────────────────────────────────────────────────────────────────────
// lib/production.ts — the production department board (migration 055).
//
// Shared by the PUBLIC board (/board/<token>, no login) and the manager's
// /admin/production. Dependency-free apart from types so both surfaces agree on
// what "done" means — the rule below is subtle enough that two copies of it
// would drift within a week.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductionTask, ProductionProject, TaskCadence } from './supabase'

/**
 * The shop's wall clock. Everything date-shaped here is a CALENDAR day in this
 * zone, never UTC: Vercel runs UTC, so a "daily" task keyed on the UTC date
 * would reset at 8pm local — the board would clear itself during second shift.
 *
 * America/New_York is the house timezone (lib/learn-gamification.ts STREAK_TZ,
 * lib/admin-digest.ts, the /admin greeting). If IAT ever runs a shop in another
 * zone this becomes a production_departments column; one constant until then.
 */
export const SHOP_TZ = 'America/New_York'

/**
 * Calendar date in `tz` as 'YYYY-MM-DD'. en-CA formats exactly that way, which
 * is the trick lib/learn-gamification.ts:67 already uses for streaks — same
 * approach here so the two can't disagree about when a day ends.
 */
export function shopDate(d: Date = new Date(), tz: string = SHOP_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * The Monday of `dateStr`'s week, as 'YYYY-MM-DD'. Weekly tasks reset Monday
 * because that's when the shop week starts.
 *
 * Parsed as UTC noon deliberately: 'YYYY-MM-DD' + new Date() would be read as
 * UTC midnight, which is the PREVIOUS day in every US zone, landing the whole
 * week one day early. Noon has ~12h of slack in either direction, and since
 * we only ever read the weekday off it, DST can't reach it.
 */
export function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const dow = d.getUTCDay() // 0 = Sunday
  const backToMonday = dow === 0 ? 6 : dow - 1
  d.setUTCDate(d.getUTCDate() - backToMonday)
  return d.toISOString().slice(0, 10)
}

/**
 * Is this task done RIGHT NOW, from the board's point of view?
 *
 * THE ONE PLACE THIS RULE LIVES. Recurring tasks reset with no cron and no
 * nightly job: `done_on` records the shop-local day the work happened, and a
 * recurring task simply stops counting as done once that day (or week) is past.
 * Nothing to schedule, nothing to fail overnight, and the answer is computed
 * fresh on every read.
 *
 * `status` is still the stored truth for one-offs and for 'blocked'; cadence
 * only governs how long a 'done' lasts.
 */
export function effectiveDone(task: ProductionTask, today: string = shopDate()): boolean {
  if (task.status !== 'done' || !task.done_on) return false
  if (task.cadence === 'daily') return task.done_on === today
  if (task.cadence === 'weekly') return weekStart(task.done_on) === weekStart(today)
  return true // 'once' — done stays done
}

/** A task nobody has picked up. Surfaced on the board on purpose. */
export function isUnassigned(task: ProductionTask): boolean {
  return !task.assignee || !task.assignee.trim()
}

/** Standing duty (department-wide, belongs to no project) vs project work.
 *  Since 056 the tell is project_id, NOT the deprecated `project` text. */
export function isStanding(task: ProductionTask): boolean {
  return !task.project_id
}

export const CADENCE_LABELS: Record<TaskCadence, string> = {
  once: 'One-off',
  daily: 'Every day',
  weekly: 'Every week',
}

/** Past due, and not already satisfied. Recurring tasks lean on effectiveDone. */
export function isOverdue(task: ProductionTask, today: string = shopDate()): boolean {
  if (!task.due_date || effectiveDone(task, today)) return false
  return task.due_date < today
}

const bySortThenTitle = (a: ProductionTask, b: ProductionTask) =>
  a.sort_order - b.sort_order || a.title.localeCompare(b.title)

/** A phase heading and its tasks. `phase` null = the un-phased tasks that lead a
 *  project (or a whole flat list, when nothing carries a phase). */
export type PhaseGroup = {
  phase: string | null
  tasks: ProductionTask[]
}

/**
 * Split a project's tasks into ordered phase groups. Un-phased tasks come first
 * (a project with no phases is just one null group = a flat list); named phases
 * follow in order of their earliest task's sort_order, so "Day 1" (sorts 10–30)
 * precedes "Day 2" (40–60) without depending on the string. Tie-broken by the
 * first appearance so two phases that share a sort never swap between renders.
 */
export function groupByPhase(tasks: ProductionTask[]): PhaseGroup[] {
  const order: string[] = [] // named phases, first-seen order
  const minSort = new Map<string, number>()
  const byPhase = new Map<string, ProductionTask[]>()
  const unphased: ProductionTask[] = []

  for (const t of tasks) {
    const phase = t.phase?.trim()
    if (!phase) {
      unphased.push(t)
      continue
    }
    let list = byPhase.get(phase)
    if (!list) {
      list = []
      byPhase.set(phase, list)
      order.push(phase)
      minSort.set(phase, t.sort_order)
    } else if (t.sort_order < minSort.get(phase)!) {
      minSort.set(phase, t.sort_order)
    }
    list.push(t)
  }

  order.sort((a, b) => minSort.get(a)! - minSort.get(b)! || order.indexOf(a) - order.indexOf(b))

  const groups: PhaseGroup[] = []
  if (unphased.length) groups.push({ phase: null, tasks: unphased.sort(bySortThenTitle) })
  for (const phase of order) groups.push({ phase, tasks: byPhase.get(phase)!.sort(bySortThenTitle) })
  return groups
}

export type ProjectView = {
  project: ProductionProject
  phases: PhaseGroup[]
  progress: ReturnType<typeof boardProgress>
}

export type BoardView = {
  /** Department-wide standing duties (project_id null), a flat ordered list. */
  standing: ProductionTask[]
  /** One section per active project, standing sort-order first. */
  projects: ProjectView[]
}

/**
 * Assemble a department board the way it reads top-to-bottom: standing duties
 * first (same every day — muscle memory lives at the top), then each active
 * project as its own separately-tracked section. `projects` is already ordered
 * by the manager's sort_order; only their live (non-archived) tasks are placed.
 *
 * The two surfaces (public board + admin) both build from this so their grouping
 * and progress can never disagree.
 */
export function buildBoard(
  tasks: ProductionTask[],
  projects: ProductionProject[],
  today: string = shopDate()
): BoardView {
  const standing = tasks.filter((t) => isStanding(t)).sort(bySortThenTitle)

  const byProject = new Map<string, ProductionTask[]>()
  for (const t of tasks) {
    if (!t.project_id) continue
    const list = byProject.get(t.project_id)
    if (list) list.push(t)
    else byProject.set(t.project_id, [t])
  }

  const views: ProjectView[] = projects.map((project) => {
    const own = byProject.get(project.id) ?? []
    return { project, phases: groupByPhase(own), progress: boardProgress(own, today) }
  })

  return { standing, projects: views }
}

/** Board headline: how much of today's work is actually finished. */
export function boardProgress(tasks: ProductionTask[], today: string = shopDate()) {
  const live = tasks.filter((t) => t.status !== 'blocked')
  const done = live.filter((t) => effectiveDone(t, today)).length
  return {
    done,
    total: live.length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    unassigned: tasks.filter((t) => isUnassigned(t) && !effectiveDone(t, today) && t.status !== 'blocked').length,
    pct: live.length === 0 ? 0 : Math.round((done / live.length) * 100),
  }
}

// ─── Untrusted input from the board ──────────────────────────────────────────

/** Longest name we'll store from the floor. Long enough for a real name. */
export const MAX_ACTOR_NAME = 60

/**
 * Characters that render as nothing, or lie about what renders. Tested by code
 * point rather than a regex character class on purpose: the escapes for these
 * ranges are unreadable, and pasting them literally puts invisible control
 * characters into the source where no reviewer can see them.
 *
 * Covers C0/C1 controls, the zero-width family, and the bidi overrides — the
 * last of which can make a stored name display as something other than typed.
 */
function isInvisible(ch: string): boolean {
  const c = ch.codePointAt(0)!
  return (
    c <= 0x1f ||                    // C0 controls
    (c >= 0x7f && c <= 0x9f) ||     // DEL + C1 controls
    (c >= 0x200b && c <= 0x200f) || // zero-width space/joiners, LRM/RLM
    (c >= 0x202a && c <= 0x202e) || // bidi embedding / override
    c === 0xfeff                    // BOM / zero-width no-break space
  )
}

/**
 * Clean a name typed on the board. It arrives from an unauthenticated request
 * and is rendered back to everyone else looking at that board, so it is treated
 * as untrusted display text: neutralise invisible characters, collapse
 * whitespace, cap the length. React escapes on render — this keeps junk out of
 * storage and stops one joker writing an essay into the trail.
 *
 * Returns null when nothing usable is left, so callers can 400 rather than
 * silently record an empty signature.
 */
export function cleanActorName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = Array.from(raw)
    .map((ch) => (isInvisible(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  return cleaned.slice(0, MAX_ACTOR_NAME)
}
