'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { AUCKLAND_TASKS, BLANK_TASKS, withIds, type GanttChart, type GanttTask } from '@/lib/gantt'

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
      scenario: 'likely',
      failure: false,
      reset_weeks: 8,
      tasks: withIds(isAuck ? AUCKLAND_TASKS : BLANK_TASKS),
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
  Pick<GanttChart, 'name' | 'customer' | 'status' | 'start_date' | 'scenario' | 'failure' | 'reset_weeks' | 'tasks'>
>

export async function updateChart(id: string, patch: ChartPatch): Promise<void> {
  await requireAdmin()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) update.name = String(patch.name).slice(0, 140) || 'Untitled project'
  if (patch.customer !== undefined) update.customer = patch.customer ? String(patch.customer).slice(0, 140) : null
  if (patch.status !== undefined) update.status = patch.status
  if (patch.start_date !== undefined) update.start_date = patch.start_date
  if (patch.scenario !== undefined) update.scenario = patch.scenario
  if (patch.failure !== undefined) update.failure = !!patch.failure
  if (patch.reset_weeks !== undefined) update.reset_weeks = Math.max(0, Math.min(104, Math.round(Number(patch.reset_weeks) || 0)))
  if (patch.tasks !== undefined) update.tasks = patch.tasks

  const { error } = await supabaseAdmin.from('gantt_charts').update(update).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gantt')
  revalidatePath(`/admin/gantt/${id}`)
}

export async function duplicateChart(id: string): Promise<{ id: string }> {
  const admin = await requireAdmin()
  const { data: src } = await supabaseAdmin.from('gantt_charts').select('*').eq('id', id).single()
  if (!src) throw new Error('Chart not found.')
  const s = src as GanttChart
  const strippedTasks = (s.tasks || []).map((t: GanttTask) => ({
    name: t.name, kind: t.kind, cat: t.cat, owner: t.owner, durMin: t.durMin, durMax: t.durMax, anchor: t.anchor,
  }))

  const { data, error } = await supabaseAdmin
    .from('gantt_charts')
    .insert({
      name: `${s.name} (copy)`.slice(0, 140),
      customer: s.customer,
      status: s.status,
      start_date: s.start_date,
      scenario: s.scenario,
      failure: s.failure,
      reset_weeks: s.reset_weeks,
      tasks: withIds(strippedTasks),
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
