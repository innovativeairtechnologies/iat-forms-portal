'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import {
  AUCKLAND_TASKS, BLANK_TASKS, withIds, nid, normalizeChart,
  type GanttChart, type GanttTask, type GanttAssumption, type TaskRisk, type GanttBaseline,
} from '@/lib/gantt'

/* Gantt mutations. Run with the service-role key (bypasses RLS), so each guards
   the caller with getAdminUser() rather than trusting only the /admin layout —
   same model as the presentations / org-chart actions. */

async function requireAdmin() {
  const admin = await getAdminUser()
  if (!admin) throw new Error('Forbidden')
  return admin
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const clamp = (v: unknown, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)))

function sanitizeRisks(risks: unknown): TaskRisk[] | undefined {
  if (!Array.isArray(risks) || risks.length === 0) return undefined
  return risks.slice(0, 8).map((r) => {
    const delayMin = clamp((r as TaskRisk).delayMin, 0, 104)
    return {
      id: String((r as TaskRisk).id || nid()).slice(0, 40),
      prob: clamp((r as TaskRisk).prob, 0, 100),
      delayMin,
      delayMax: Math.max(delayMin, clamp((r as TaskRisk).delayMax, 0, 104)),
      note: (r as TaskRisk).note ? String((r as TaskRisk).note).slice(0, 200) : undefined,
      fired: !!(r as TaskRisk).fired,
    }
  })
}

function sanitizeTasks(tasks: GanttTask[]): GanttTask[] {
  return tasks.slice(0, 60).map((t) => {
    const status = t.status === 'in_progress' || t.status === 'done' ? t.status : undefined
    // Actuals are ABSOLUTE dates (recorded facts) — validate shape + a sane year
    // band; the client clamps range against the chart axis.
    const actual =
      status === 'done' &&
      typeof t.actualEnd === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(t.actualEnd) &&
      +t.actualEnd.slice(0, 4) >= 2000 &&
      +t.actualEnd.slice(0, 4) <= 2100
        ? t.actualEnd
        : undefined
    return {
      ...t,
      name: String(t.name ?? '').slice(0, 140),
      owner: t.owner ? String(t.owner).slice(0, 80) : undefined,
      durMin: clamp(t.durMin, 0, 208),
      durMax: clamp(t.durMax, 0, 208),
      risks: sanitizeRisks(t.risks),
      status,
      actualEnd: actual,
    }
  })
}

function sanitizeAssumptions(assumptions: unknown): GanttAssumption[] {
  if (!Array.isArray(assumptions)) return []
  return assumptions.slice(0, 30).map((a) => ({
    id: String((a as GanttAssumption).id || nid()).slice(0, 40),
    text: String((a as GanttAssumption).text ?? '').slice(0, 300),
  }))
}

export async function createChart(kind: 'blank' | 'auckland'): Promise<{ id: string }> {
  const admin = await requireAdmin()
  const isAuck = kind === 'auckland'
  const name = isAuck ? 'Auckland custom unit' : 'New project'
  const { data, error } = await supabaseAdmin
    .from('gantt_charts')
    .insert({
      name,
      customer: isAuck ? 'Auckland project' : null,
      status: 'active',
      start_date: isAuck ? '2026-07-07' : todayISO(),
      tasks: withIds(isAuck ? AUCKLAND_TASKS : BLANK_TASKS),
      assumptions: [],
      // Risks live on tasks now — zero the deprecated legacy contingency columns
      // so normalizeChart() never synthesizes a phantom risk on new charts.
      failure: false,
      reset_weeks: 0,
      created_by: admin.user.id,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message || 'Could not create chart.')

  revalidatePath('/admin/gantt')
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'gantt.create', entityType: 'gantt_chart', entityId: data.id,
    summary: `Created project timeline "${name}"`,
  })
  return { id: data.id }
}

type ChartPatch = Partial<
  Pick<GanttChart, 'name' | 'customer' | 'status' | 'start_date' | 'tasks' | 'assumptions'>
>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function updateChart(id: string, patch: ChartPatch): Promise<void> {
  await requireAdmin()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) update.name = String(patch.name).slice(0, 140) || 'Untitled project'
  if (patch.customer !== undefined) update.customer = patch.customer ? String(patch.customer).slice(0, 140) : null
  if (patch.status !== undefined) update.status = patch.status
  // Ignore an empty/partial date — a cleared native date input emits ''. Writing
  // it would make Postgres reject the row and silently strand every later autosave.
  if (patch.start_date !== undefined && ISO_DATE.test(patch.start_date)) update.start_date = patch.start_date
  if (patch.assumptions !== undefined) update.assumptions = sanitizeAssumptions(patch.assumptions)
  if (patch.tasks !== undefined) {
    update.tasks = sanitizeTasks(patch.tasks)
    // Commit the lazy legacy migration: once the risks live in `tasks`, neutralize
    // the deprecated columns so normalizeChart() can never re-synthesize a risk the
    // user has deleted (they'd otherwise reappear on every reload).
    update.failure = false
    update.reset_weeks = 0
  }

  const { error } = await supabaseAdmin.from('gantt_charts').update(update).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gantt')
  revalidatePath(`/admin/gantt/${id}`)
}

/** Set or clear the baseline — a dedicated, explicitly audit-logged act (kept OUT
 *  of the debounced autosave, which would otherwise log a baseline event on every
 *  keystroke). */
export async function saveBaseline(id: string, baseline: GanttBaseline | null): Promise<void> {
  const admin = await requireAdmin()
  const { error } = await supabaseAdmin
    .from('gantt_charts')
    .update({ baseline, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gantt')
  revalidatePath(`/admin/gantt/${id}`)
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: baseline ? 'gantt.baseline.set' : 'gantt.baseline.clear',
    entityType: 'gantt_chart', entityId: id,
    summary: baseline ? `Set schedule baseline (plan ship ${baseline.ship.likely})` : 'Cleared schedule baseline',
  })
}

export async function duplicateChart(id: string): Promise<{ id: string }> {
  const admin = await requireAdmin()
  const { data: src } = await supabaseAdmin.from('gantt_charts').select('*').eq('id', id).single()
  if (!src) throw new Error('Chart not found.')
  // Normalize first so a legacy contingency (chart-level failure/reset_weeks never
  // materialized into tasks) is copied as a real risk instead of being dropped.
  const s = normalizeChart(src as GanttChart)

  // Spread-with-id-drop (NOT a field whitelist) so future task fields survive the
  // copy. Fresh ids; a copy is a NEW PLAN, so ALL execution state is stripped:
  // what-if `fired` flags reset, completion status/actuals cleared, and the
  // baseline intentionally not copied.
  const tasks: GanttTask[] = (s.tasks || []).map(({ id: _id, status: _st, actualEnd: _ae, ...rest }) => ({
    ...rest,
    id: nid(),
    risks: rest.risks?.map(({ id: _rid, ...rr }) => ({ ...rr, id: nid(), fired: false })),
  }))

  const { data, error } = await supabaseAdmin
    .from('gantt_charts')
    .insert({
      name: `${s.name} (copy)`.slice(0, 140),
      customer: s.customer,
      status: s.status,
      start_date: s.start_date,
      tasks,
      assumptions: s.assumptions ?? [],
      baseline: null,
      // Migration already committed into `tasks` above (via normalizeChart) — keep
      // the deprecated columns zeroed so normalizeChart never re-fires on the copy.
      failure: false,
      reset_weeks: 0,
      created_by: admin.user.id,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message || 'Could not duplicate.')
  revalidatePath('/admin/gantt')
  return { id: data.id }
}

export async function deleteChart(id: string): Promise<void> {
  const admin = await requireAdmin()
  const { error } = await supabaseAdmin.from('gantt_charts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gantt')
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'gantt.delete', entityType: 'gantt_chart', entityId: id,
    summary: 'Deleted a project timeline',
  })
}
