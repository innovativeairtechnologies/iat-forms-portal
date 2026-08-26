import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { median, rangeFor, type RangeKey } from './report-shared'
import {
  OPEN_STATUSES, STREAMS, isAtRisk, projectTask,
  type EngTaskRow, type Stream,
} from './engineering'
import { listTasks } from './eng-data'
import type {
  EngReport, EngReportRow, PersonPerformance, StepPerformance, StreamPerformance,
} from './eng-report-types'

/* ────────────────────────────────────────────────────────────────────────────
   lib/eng-report.ts — the leadership view of engineering.

   ── The three rules this report is built on ────────────────────────────────

   1. MEDIAN, never mean. One task left open across a shutdown drags a mean into
      uselessness, and this data is full of those. Same rule as every other
      report in the portal (lib/report-shared.ts).

   2. Every hours figure carries its COVERAGE. Target hours are null wherever no
      source publishes one, and actual hours are null until somebody logs them.
      A median over four of nineteen tasks is a real number about a small sample,
      and printed without saying so it becomes a claim about the department.
      Nothing here reports an hours figure without also reporting how much of the
      work it could see.

   3. A task with no due date is EXCLUDED from on-time percentages, not counted
      as on time. Silently scoring undated work as a success would make the
      easiest way to improve the number "stop setting dates".
   ──────────────────────────────────────────────────────────────────────────── */

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY)
const pctOrNull = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null)

function flattenRow(t: EngTaskRow): EngReportRow {
  const due = t.due_date ? new Date(`${t.due_date}T23:59:59`) : null
  const done = t.completed_at ? new Date(t.completed_at) : null
  return {
    id: t.id,
    jobNumber: t.job_number ?? '',
    customer: t.customer_name ?? '',
    stream: t.stream,
    step: t.step,
    title: t.title,
    owner: t.assignee_name ?? 'Unassigned',
    status: t.status,
    dueDate: t.due_date ?? '',
    completedAt: t.completed_at?.slice(0, 10) ?? '',
    varianceDays: due && done ? dayDiff(due, done) : null,
    targetHours: t.target_hours == null ? null : Number(t.target_hours),
    actualHours: t.actual_hours == null ? null : Number(t.actual_hours),
    // Null, not zero, when there is no start. Zero would read as "finished the
    // instant it began", which is a claim; null reads as "we do not know", which
    // is the truth.
    cycleDays: t.started_at && done ? Math.max(0, dayDiff(done, new Date(t.started_at))) : null,
  }
}

/** On-time counting, in one place so the five tables cannot disagree. Undated
 *  work is not scored at all — see rule 3 above. */
function onTimeOf(rows: EngReportRow[]) {
  const dated = rows.filter(r => r.varianceDays != null)
  const onTime = dated.filter(r => (r.varianceDays as number) >= 0).length
  return { dated: dated.length, onTime, pct: pctOrNull(onTime, dated.length) }
}

export async function buildEngReport(rangeKey: RangeKey): Promise<EngReport> {
  const now = new Date()
  const range = rangeFor(rangeKey, now)

  const [all, { data: jobs }] = await Promise.all([
    listTasks(),
    supabaseAdmin.from('eng_jobs').select('id, status'),
  ])

  const open = all.filter(t => (OPEN_STATUSES as readonly string[]).includes(t.status))

  // Finished work INSIDE the range. `skipped` is excluded on purpose — a task
  // marked "not required" was a correct decision, not a delivery, and counting
  // it as one would make skipping things the cheapest way to raise the score.
  const finished = all
    .filter(t => t.status === 'done' && t.completed_at)
    .filter(t => !range.from || new Date(t.completed_at as string) >= range.from)

  const rows = finished.map(flattenRow)
  const totalsOnTime = onTimeOf(rows)
  const loggedHours = rows.filter(r => r.actualHours != null)

  // ── Per bucket ────────────────────────────────────────────────────────────
  const byStream: StreamPerformance[] = STREAMS.map(stream => {
    const list = rows.filter(r => r.stream === stream)
    const ot = onTimeOf(list)
    const costed = list.filter(r => r.targetHours != null)
    const logged = list.filter(r => r.actualHours != null)
    return {
      stream,
      completed: list.length,
      onTime: ot.onTime,
      onTimePct: ot.pct,
      medianVarianceDays: median(list.filter(r => r.varianceDays != null).map(r => r.varianceDays as number)),
      medianActualHours: median(logged.map(r => r.actualHours as number)),
      targetHours: costed.length ? Math.round(costed.reduce((a, r) => a + (r.targetHours as number), 0) * 100) / 100 : null,
      costedOf: { costed: costed.length, total: list.length },
    }
  }).filter(s => s.completed > 0)

  // ── Per step — "how long does a submittal package ACTUALLY take" ──────────
  //
  // The department's own milestones on the training board are exactly this
  // question: "lead-times less than 4 hours on average", then "less than 2".
  // Ad-hoc tasks (step keys prefixed `custom:`) are excluded so one-off work
  // cannot distort a standard step's figure.
  const stepMap = new Map<string, EngReportRow[]>()
  for (const r of rows) {
    if (r.step.startsWith('custom:') || r.step === 'custom') continue
    const k = `${r.stream}:${r.step}`
    stepMap.set(k, [...(stepMap.get(k) ?? []), r])
  }
  const bySteps: StepPerformance[] = [...stepMap.entries()]
    .map(([k, list]) => {
      const [stream] = k.split(':') as [Stream]
      const logged = list.filter(r => r.actualHours != null)
      const medianActual = median(logged.map(r => r.actualHours as number))
      // The target is per-step and identical across the tasks, so the first
      // non-null one IS the standard. Reading it off the tasks rather than the
      // live playbook is deliberate: a task snapshots its target when it is
      // created, so this compares each job against the standard that applied
      // when it started, not against one edited afterwards.
      const target = list.find(r => r.targetHours != null)?.targetHours ?? null
      return {
        stream,
        step: k.split(':').slice(1).join(':'),
        title: list[0].title,
        completed: list.length,
        targetHours: target,
        medianActualHours: medianActual,
        gapHours: target != null && medianActual != null ? Math.round((medianActual - target) * 100) / 100 : null,
        onTimePct: onTimeOf(list).pct,
      }
    })
    .sort((a, b) => b.completed - a.completed || a.title.localeCompare(b.title))

  // ── Per person ────────────────────────────────────────────────────────────
  const names = new Set([...rows.map(r => r.owner), ...open.map(t => t.assignee_name ?? 'Unassigned')])
  const byPerson: PersonPerformance[] = [...names]
    .map(name => {
      const list = rows.filter(r => r.owner === name)
      const ot = onTimeOf(list)
      const openMine = open.filter(t => (t.assignee_name ?? 'Unassigned') === name)
      const logged = list.filter(r => r.actualHours != null)
      return {
        name,
        completed: list.length,
        onTime: ot.onTime,
        onTimePct: ot.pct,
        medianVarianceDays: median(list.filter(r => r.varianceDays != null).map(r => r.varianceDays as number)),
        actualHours: logged.length ? Math.round(logged.reduce((a, r) => a + (r.actualHours as number), 0) * 100) / 100 : null,
        openNow: openMine.length,
        atRiskNow: openMine.filter(t => isAtRisk(projectTask(t, now))).length,
      }
    })
    .filter(p => p.completed > 0 || p.openNow > 0)
    // Unassigned last: it is a queue, not a person, and it belongs at the bottom
    // of a list of people.
    .sort((a, b) => {
      if (a.name === 'Unassigned') return 1
      if (b.name === 'Unassigned') return -1
      return b.completed - a.completed || a.name.localeCompare(b.name)
    })

  // ── Monthly ───────────────────────────────────────────────────────────────
  const months = new Map<string, { created: number; completed: number; late: number }>()
  const bump = (key: string, field: 'created' | 'completed' | 'late') => {
    const cur = months.get(key) ?? { created: 0, completed: 0, late: 0 }
    cur[field]++
    months.set(key, cur)
  }
  for (const t of all) {
    if (range.from && new Date(t.created_at) < range.from) continue
    bump(t.created_at.slice(0, 7), 'created')
  }
  for (const r of rows) {
    if (!r.completedAt) continue
    bump(r.completedAt.slice(0, 7), 'completed')
    if (r.varianceDays != null && r.varianceDays < 0) bump(r.completedAt.slice(0, 7), 'late')
  }
  const monthly = [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, ...v }))

  // ── Job-level risk ────────────────────────────────────────────────────────
  const activeJobIds = new Set((jobs ?? []).filter(j => j.status === 'active').map(j => j.id as string))
  const riskJobIds = new Set(
    open.filter(t => t.job_id && activeJobIds.has(t.job_id) && isAtRisk(projectTask(t, now)))
      .map(t => t.job_id as string),
  )

  return {
    rangeKey: range.key,
    rangeLabel: range.label,
    generatedAt: now.toISOString(),
    totals: {
      completed: rows.length,
      onTime: totalsOnTime.onTime,
      onTimePct: totalsOnTime.pct,
      medianVarianceDays: median(rows.filter(r => r.varianceDays != null).map(r => r.varianceDays as number)),
      medianCycleDays: median(rows.filter(r => r.cycleDays != null).map(r => r.cycleDays as number)),
      hoursCoverage: { logged: loggedHours.length, total: rows.length },
      medianActualHours: median(loggedHours.map(r => r.actualHours as number)),
      openNow: open.length,
      atRiskNow: open.filter(t => isAtRisk(projectTask(t, now))).length,
      overdueNow: open.filter(t => projectTask(t, now).kind === 'overdue').length,
      unassignedNow: open.filter(t => !t.assignee_id).length,
      activeJobs: activeJobIds.size,
      jobsAtRisk: riskJobIds.size,
    },
    byStream,
    bySteps,
    byPerson,
    monthly,
    rows,
  }
}

// ⚠️ Deliberately NOT re-exporting STREAM_LABELS (or any other constant) from
// here for the client's convenience. This module imports supabase-admin, so a
// value import of anything it exports ships the service-role client to the
// browser. The client imports labels straight from lib/engineering.ts, which is
// dependency-free for exactly this reason.
