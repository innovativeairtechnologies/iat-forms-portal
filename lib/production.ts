// ─────────────────────────────────────────────────────────────────────────────
// lib/production.ts — the production department board (migration 055).
//
// Shared by the PUBLIC board (/board/<token>, no login) and the manager's
// /admin/production. Dependency-free apart from types so both surfaces agree on
// what "done" means — the rule below is subtle enough that two copies of it
// would drift within a week.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductionTask, TaskCadence } from './supabase'

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

/** Standing duty (no job attached) vs project work. `project` NULL is the tell. */
export function isStanding(task: ProductionTask): boolean {
  return !task.project || !task.project.trim()
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

export type BoardGroup = {
  /** The job name, or null for the standing-duties group. */
  project: string | null
  tasks: ProductionTask[]
}

/**
 * Group a department's tasks the way the board reads top-to-bottom: standing
 * duties first (the same every day — muscle memory lives at the top), then each
 * job. Within a group, sort_order then title, so the manager's ordering wins and
 * ties never shuffle between renders.
 */
export function groupForBoard(tasks: ProductionTask[]): BoardGroup[] {
  const standing: ProductionTask[] = []
  const byProject = new Map<string, ProductionTask[]>()

  for (const t of tasks) {
    if (isStanding(t)) {
      standing.push(t)
    } else {
      const key = t.project!.trim()
      const list = byProject.get(key)
      if (list) list.push(t)
      else byProject.set(key, [t])
    }
  }

  const bySortThenTitle = (a: ProductionTask, b: ProductionTask) =>
    a.sort_order - b.sort_order || a.title.localeCompare(b.title)

  const groups: BoardGroup[] = []
  if (standing.length) groups.push({ project: null, tasks: standing.sort(bySortThenTitle) })

  for (const project of [...byProject.keys()].sort((a, b) => a.localeCompare(b))) {
    groups.push({ project, tasks: byProject.get(project)!.sort(bySortThenTitle) })
  }
  return groups
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
