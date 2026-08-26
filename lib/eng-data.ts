import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import {
  OPEN_STATUSES, STREAMS, addDays, projectTask, isAtRisk, streamProgress,
  type EngJob, type EngTask, type EngTaskRow, type Projection, type Stream,
} from './engineering'
import { ENG_PLAYBOOK_DEFAULT, coercePlaybook, stepsForNewJob, type Playbook } from './eng-playbook'
import { getEmployeesWithPerm } from './staff'

/* ────────────────────────────────────────────────────────────────────────────
   lib/eng-data.ts — every read and write the Engineering section makes.

   Server-only. Client components take the RESULTS of these as props; they must
   never import this module, or the service-role client ships to the browser.
   ──────────────────────────────────────────────────────────────────────────── */

// ─── The playbook ────────────────────────────────────────────────────────────

/**
 * FAIL-SAFE, matching lib/soo-library.ts and srv_config(046): a missing row, a
 * read error or a blob that has gone bad all fall back to the code default, so
 * creating a job can never fail because the rules table hiccuped. A job with the
 * shipped default plan is recoverable; a PO that generated nothing is not — it
 * just quietly does not exist until someone notices.
 */
export async function getPlaybook(): Promise<Playbook> {
  try {
    const { data, error } = await supabaseAdmin.from('eng_playbook').select('playbook').eq('id', 1).maybeSingle()
    if (error || !data?.playbook) return ENG_PLAYBOOK_DEFAULT
    return coercePlaybook(data.playbook)
  } catch {
    return ENG_PLAYBOOK_DEFAULT
  }
}

export async function savePlaybook(pb: Playbook, updatedBy: string | null) {
  const clean = coercePlaybook(pb)
  const { error } = await supabaseAdmin
    .from('eng_playbook')
    .upsert({ id: 1, playbook: clean, updated_by: updatedBy, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  return clean
}

// ─── Generating a job's plan ─────────────────────────────────────────────────

/**
 * Turn a job into tasks. This is the meeting's "automation will reduce manual
 * management when a new job starts by automatically creating and assigning tasks
 * based on predefined rules and timelines" — the whole of it.
 *
 * ⚠️ IDEMPOTENT BY DESIGN. The unique index on (job_id, stream, step) plus
 * `ignoreDuplicates` means running this twice adds nothing and, crucially,
 * overwrites nothing: a job whose PO date is corrected re-generates the steps
 * that were never created without resetting the progress on the ones people have
 * been working. Re-dating existing tasks is a separate, explicit action (see
 * redateJob) precisely because it moves dates out from under whoever owns them.
 *
 * ⚠️ NO DUE DATES WITHOUT AN ANCHOR. A job entered a month after its PO with no
 * po_date would otherwise generate a fortnight of runway starting today, and the
 * board would show it comfortably on track while it is two weeks late. Null
 * anchor ⇒ null dates ⇒ the board says "No due date", which is true.
 */
export async function generateTasksForJob(job: EngJob, opts: { createdBy?: string | null } = {}) {
  const pb = await getPlaybook()
  const planned = stepsForNewJob(pb, job.complexity)
  if (!planned.length) return { inserted: 0 }

  const rows = planned.map(({ stream, step, sort }) => ({
    job_id: job.id,
    stream,
    step: step.key,
    title: step.title,
    status: 'not_started' as const,
    progress: 0,
    progress_band: step.band,
    target_hours: step.targetHours,
    due_date: job.po_date && step.cycleDays != null ? addDays(job.po_date, step.cycleDays) : null,
    priority: step.priority,
    sort_order: sort,
    created_by: opts.createdBy ?? null,
  }))

  const { data, error } = await supabaseAdmin
    .from('eng_tasks')
    .upsert(rows, { onConflict: 'job_id,stream,step', ignoreDuplicates: true })
    .select('id')
  if (error) throw new Error(error.message)
  return { inserted: data?.length ?? 0 }
}

/**
 * Re-apply the playbook's cycle days to a job's OPEN tasks after its PO date
 * moved. Separate from generation and never automatic: a due date is a promise
 * somebody made, and silently moving it is how a schedule stops meaning anything.
 * Finished tasks are left alone — their variance is history.
 */
export async function redateJob(job: EngJob) {
  if (!job.po_date) return { updated: 0 }
  const pb = await getPlaybook()
  const cycle = new Map<string, number | null>()
  for (const s of pb.streams) for (const st of s.steps) cycle.set(`${s.stream}:${st.key}`, st.cycleDays)

  const { data: tasks } = await supabaseAdmin
    .from('eng_tasks').select('id, stream, step')
    .eq('job_id', job.id).in('status', OPEN_STATUSES as unknown as string[])

  let updated = 0
  for (const t of tasks ?? []) {
    const days = cycle.get(`${t.stream}:${t.step}`)
    if (days == null) continue
    await supabaseAdmin.from('eng_tasks').update({ due_date: addDays(job.po_date, days) }).eq('id', t.id)
    updated++
  }
  return { updated }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

const TASK_COLS =
  'id, job_id, stream, step, title, assignee_id, status, progress, progress_band, target_hours, actual_hours, due_date, started_at, completed_at, priority, sort_order, blocked_reason, notes, created_at, updated_at'

/**
 * 🔴 THE OWNER EMBED MUST NAME ITS FOREIGN KEY.
 *
 * eng_tasks has TWO columns pointing at employees — `assignee_id` and
 * `created_by` — so a bare `employees(name)` is ambiguous and PostgREST refuses
 * the whole request with PGRST201: "Could not embed because more than one
 * relationship was found". Not a warning, not a partial result — every read in
 * this module returns zero rows and the section renders empty.
 *
 * It compiles, it builds, and `next build` reports nothing, because these pages
 * are force-dynamic and nothing renders them at build time. The only thing that
 * catches it is running the query. Caught pre-deploy on 2026-08-26 by doing
 * exactly that.
 */
const TASK_JOINS =
  'job:eng_jobs(job_number, customer_name), assignee:employees!eng_tasks_assignee_id_fkey(name)'

type JoinRow = EngTask & {
  job: { job_number: string; customer_name: string } | { job_number: string; customer_name: string }[] | null
  assignee: { name: string } | { name: string }[] | null
}

/** PostgREST returns an embedded to-one as an object or a one-element array
 *  depending on how it infers the relationship. Normalize once, here, rather
 *  than at seven call sites. */
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

function flatten(rows: JoinRow[]): EngTaskRow[] {
  return rows.map(r => {
    const job = one(r.job)
    const assignee = one(r.assignee)
    const { job: _j, assignee: _a, ...task } = r
    return { ...task, job_number: job?.job_number ?? null, customer_name: job?.customer_name ?? null, assignee_name: assignee?.name ?? null }
  })
}

/** Every task, with its job and owner. The section is small enough (hundreds of
 *  rows, not millions) that one read feeding several views beats five queries. */
export async function listTasks(opts: { openOnly?: boolean; assigneeId?: string; limit?: number } = {}): Promise<EngTaskRow[]> {
  let q = supabaseAdmin
    .from('eng_tasks')
    .select(`${TASK_COLS}, ${TASK_JOINS}`)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: true })
    .order('sort_order', { ascending: true })
  if (opts.openOnly) q = q.in('status', OPEN_STATUSES as unknown as string[])
  if (opts.assigneeId) q = q.eq('assignee_id', opts.assigneeId)
  if (opts.limit) q = q.limit(opts.limit)
  const { data, error } = await q
  if (error) { console.error('[eng-data] listTasks:', error.message); return [] }
  return flatten((data ?? []) as unknown as JoinRow[])
}

export async function listJobs(): Promise<EngJob[]> {
  const { data, error } = await supabaseAdmin
    .from('eng_jobs').select('*')
    .order('po_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) { console.error('[eng-data] listJobs:', error.message); return [] }
  return (data ?? []) as EngJob[]
}

export async function getJob(id: string): Promise<{ job: EngJob; tasks: EngTaskRow[] } | null> {
  const { data: job } = await supabaseAdmin.from('eng_jobs').select('*').eq('id', id).maybeSingle()
  if (!job) return null
  const { data } = await supabaseAdmin
    .from('eng_tasks')
    .select(`${TASK_COLS}, ${TASK_JOINS}`)
    .eq('job_id', id)
    .order('sort_order', { ascending: true })
  return { job: job as EngJob, tasks: flatten((data ?? []) as unknown as JoinRow[]) }
}

/**
 * Who may own an engineering task: everyone whose role holds `engineering_jobs`
 * in the LIVE matrix. Same rule as the RFQ queue — only someone who can actually
 * reach the board can be made responsible for something on it, or the board
 * quietly accumulates work assigned to people who will never see it.
 *
 * ⚠️ NOT "every active employee". `employees` is not a staff table — every
 * customer invite adds a row to it (see lib/staff.ts) — so an unfiltered picker
 * would offer customers as assignees. Nor `department = 'Engineering'`: that
 * column is free text and blank on most rows.
 *
 * Can legitimately come back EMPTY (nobody holds the perm yet). Callers show
 * that as an explainable empty state, not as a broken dropdown.
 */
export async function listAssignees(): Promise<{ id: string; name: string }[]> {
  return getEmployeesWithPerm('engineering_jobs')
}

// ─── The Status Box ──────────────────────────────────────────────────────────
//
// The whiteboard's centre panel: one tile per bucket, each showing how many are
// open, how many are behind, and the rows underneath — job number, who owns it,
// when it is due, and ahead/behind with a day count.

export type BoardTaskRow = EngTaskRow & { projection: Projection }

export type StreamTile = {
  stream: Stream
  open: number
  atRisk: number
  overdue: number
  unassigned: number
  dueThisWeek: number
  /** Completions per week over the trailing 8 weeks — the sparkline the
   *  whiteboard drew next to "trending". Oldest first. */
  trend: number[]
  rows: BoardTaskRow[]
}

export type StatusBoard = {
  tiles: StreamTile[]
  totals: { open: number; atRisk: number; overdue: number; unassigned: number; unowned: number }
  generatedAt: string
}

/**
 * The BOM tile is a union, not a stream.
 *
 * The mechanical BOM lives in the `bom` stream; the electrical BOM is a step of
 * the `electrical` stream, because that is where the Elec sheet costs it (1 hr)
 * and bands it (60%). Carrying it in both places would double-count an hour into
 * every capacity forecast — so it is carried once and SHOWN twice, here.
 * "Alert ordering as soon as a BOM is released" needs both halves in one place.
 */
const ELEC_BOM_STEP = 'elec_bom'
function tileMembership(t: EngTaskRow, stream: Stream): boolean {
  if (stream === 'bom') return t.stream === 'bom' || (t.stream === 'electrical' && t.step === ELEC_BOM_STEP)
  return t.stream === stream
}

export async function buildStatusBoard(now: Date = new Date()): Promise<StatusBoard> {
  const [open, recent] = await Promise.all([
    listTasks({ openOnly: true }),
    // Trailing 8 weeks of completions, for the sparklines. A head-count query
    // per stream per week would be 48 round trips; one bounded read is not.
    supabaseAdmin
      .from('eng_tasks').select('stream, step, completed_at')
      .eq('status', 'done')
      .gte('completed_at', new Date(now.getTime() - 56 * 86_400_000).toISOString()),
  ])

  const weekIndex = (iso: string) => {
    const d = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
    return 7 - Math.min(7, Math.floor(d / 7)) // 0 = oldest of the 8, 7 = this week
  }

  const weekEnd = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)

  const tiles: StreamTile[] = STREAMS.map(stream => {
    const rows = open
      .filter(t => tileMembership(t, stream))
      .map(t => ({ ...t, projection: projectTask(t, now) }))
      // Worst first. A board sorted by date buries the thing that is four days
      // gone behind three things due next Tuesday.
      .sort((a, b) => {
        const av = a.projection.varianceDays ?? 9999
        const bv = b.projection.varianceDays ?? 9999
        return av - bv || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
      })

    const trend = Array(8).fill(0) as number[]
    for (const r of (recent.data ?? []) as { stream: Stream; step: string; completed_at: string }[]) {
      if (!r.completed_at) continue
      if (!tileMembership({ stream: r.stream, step: r.step } as EngTaskRow, stream)) continue
      const i = weekIndex(r.completed_at)
      if (i >= 0 && i < 8) trend[i]++
    }

    return {
      stream,
      open: rows.length,
      atRisk: rows.filter(r => isAtRisk(r.projection)).length,
      overdue: rows.filter(r => r.projection.kind === 'overdue').length,
      unassigned: rows.filter(r => !r.assignee_id).length,
      dueThisWeek: rows.filter(r => r.due_date && r.due_date <= weekEnd).length,
      trend,
      rows,
    }
  })

  const all = open.map(t => ({ ...t, projection: projectTask(t, now) }))
  return {
    tiles,
    totals: {
      open: all.length,
      atRisk: all.filter(r => isAtRisk(r.projection)).length,
      overdue: all.filter(r => r.projection.kind === 'overdue').length,
      unassigned: all.filter(r => !r.assignee_id).length,
      unowned: all.filter(r => !r.assignee_id && r.projection.kind !== 'not_started').length,
    },
    generatedAt: now.toISOString(),
  }
}

// ─── Per-person workload ─────────────────────────────────────────────────────

export type PersonLoad = {
  employeeId: string | null
  name: string
  open: number
  atRisk: number
  overdue: number
  /** Sum of target_hours on open tasks. Null-target tasks are counted in
   *  `uncosted` instead of as zero — a person carrying six tasks nobody has
   *  costed must not read as having a free week. */
  targetHours: number
  uncosted: number
  dueThisWeek: number
}

export function rollUpByPerson(tasks: EngTaskRow[], now: Date = new Date()): PersonLoad[] {
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)
  const m = new Map<string, PersonLoad>()
  for (const t of tasks) {
    const key = t.assignee_id ?? '__unassigned'
    const cur = m.get(key) ?? {
      employeeId: t.assignee_id,
      name: t.assignee_name ?? 'Unassigned',
      open: 0, atRisk: 0, overdue: 0, targetHours: 0, uncosted: 0, dueThisWeek: 0,
    }
    const p = projectTask(t, now)
    cur.open++
    if (isAtRisk(p)) cur.atRisk++
    if (p.kind === 'overdue') cur.overdue++
    if (t.target_hours != null) cur.targetHours += Number(t.target_hours)
    else cur.uncosted++
    if (t.due_date && t.due_date <= weekEnd) cur.dueThisWeek++
    m.set(key, cur)
  }
  return [...m.values()].sort((a, b) => {
    // Unassigned last: it is a queue, not a person, and it belongs at the bottom
    // of a list of people.
    if (!a.employeeId) return 1
    if (!b.employeeId) return -1
    return b.atRisk - a.atRisk || b.open - a.open || a.name.localeCompare(b.name)
  })
}

// ─── Job roll-up ─────────────────────────────────────────────────────────────

export type JobRollUp = {
  job: EngJob
  progress: number
  open: number
  atRisk: number
  overdue: number
  nextDue: string | null
  byStream: { stream: Stream; progress: number; open: number; total: number }[]
}

export function rollUpJob(job: EngJob, tasks: EngTaskRow[], now: Date = new Date()): JobRollUp {
  const live = tasks.filter(t => t.status !== 'skipped')
  const byStream = STREAMS
    .map(stream => {
      const s = live.filter(t => t.stream === stream)
      return { stream, progress: streamProgress(s), open: s.filter(t => (OPEN_STATUSES as readonly string[]).includes(t.status)).length, total: s.length }
    })
    .filter(s => s.total > 0)

  const openTasks = live.filter(t => (OPEN_STATUSES as readonly string[]).includes(t.status))
  const projections = openTasks.map(t => projectTask(t, now))
  return {
    job,
    // The job bar is the mean of the streams that EXIST on it, not of all six —
    // a job with no electrical work should not sit permanently at 83%.
    progress: byStream.length ? Math.round(byStream.reduce((a, s) => a + s.progress, 0) / byStream.length) : 0,
    open: openTasks.length,
    atRisk: projections.filter(isAtRisk).length,
    overdue: projections.filter(p => p.kind === 'overdue').length,
    nextDue: openTasks.map(t => t.due_date).filter(Boolean).sort()[0] ?? null,
    byStream,
  }
}
