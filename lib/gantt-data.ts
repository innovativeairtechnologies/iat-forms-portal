import { supabaseAdmin } from './supabase-admin'
import type { GanttChart } from './gantt'

/* ────────────────────────────────────────────────────────────────────────────
   Gantt — server-side data access. Everything runs through the service-role
   client (the table is RLS-on / no-policies, admin-only). Import ONLY from
   server components / server actions — never a client component (it pulls in
   supabaseAdmin, which must never reach the browser bundle).
   ──────────────────────────────────────────────────────────────────────────── */

/** All active charts, newest-edited first. */
export async function listCharts(): Promise<GanttChart[]> {
  const { data } = await supabaseAdmin
    .from('gantt_charts')
    .select('*')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
  return (data as GanttChart[] | null) ?? []
}

/** A single chart, or null if it doesn't exist. */
export async function getChart(id: string): Promise<GanttChart | null> {
  const { data } = await supabaseAdmin.from('gantt_charts').select('*').eq('id', id).single()
  return (data as GanttChart | null) ?? null
}
