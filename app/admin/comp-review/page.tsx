export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import type { CompCycle, CompReviewLine } from '@/lib/comp-review'
import CompReviewClient, { type RosterPerson } from './CompReviewClient'

/* The annual compensation review (migration 078) — the "Sample Annual Review
   Spreadsheet" workbook, moved into the portal. Page authz is middleware's job
   (canAccessAdminPath → 'compensation'), so there's no guard call here; that's
   the house pattern (rep-scorecard/page.tsx, territories/page.tsx).

   getAdminSurfaceUser is read only for the ROLE: line edits are admin/hr and
   cycle constants are admin-only, both enforced server-side by
   requireCompReviewAuth. canEdit/canAdmin just keep the UI honest.

   The employees roster comes along for two reasons: hire_date computes the
   tenure column the workbook typed by hand, and the "add person" picker needs
   somebody to pick. Customers are dropped from it — handle_new_user (001) puts
   EVERY auth user in `employees`, including customer invitees, and they have no
   business on a payroll sheet. */

export default async function CompReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const wanted = Number(yearParam)
  const validYear = Number.isInteger(wanted) && wanted >= 2000 && wanted <= 2100 ? wanted : null

  const [surfaceUser, cyclesQ, employeesQ, profilesQ] = await Promise.all([
    getAdminSurfaceUser(),
    supabaseAdmin.from('comp_cycles').select('*').order('year', { ascending: false }),
    supabaseAdmin.from('employees').select('id, name, hire_date, job_title, department').order('name'),
    supabaseAdmin.from('profiles').select('id, role'),
  ])

  const cycles = (cyclesQ.data ?? []) as CompCycle[]
  // Default to the requested year, else the most recent cycle. Null means no
  // cycle exists yet and the client renders its empty state.
  const cycle = (validYear !== null ? cycles.find((c) => c.year === validYear) : cycles[0]) ?? null

  const linesQ = cycle
    ? await supabaseAdmin.from('comp_review_lines').select('*').eq('cycle_id', cycle.id).order('person_name')
    : { data: [] as CompReviewLine[] }
  const lines = (linesQ.data ?? []) as CompReviewLine[]

  const customerIds = new Set((profilesQ.data ?? []).filter((p) => p.role === 'customer').map((p) => p.id))
  const roster: RosterPerson[] = (employeesQ.data ?? [])
    .filter((e) => !customerIds.has(e.id) && (e.name ?? '').trim())
    .map((e) => ({
      id: e.id,
      name: e.name,
      hireDate: e.hire_date ?? null,
      jobTitle: e.job_title ?? null,
      department: e.department ?? null,
    }))

  const role = surfaceUser?.role
  const canEdit = role === 'admin' || role === 'hr'
  const canAdmin = role === 'admin'

  return (
    <CompReviewClient
      cycle={cycle}
      cycles={cycles.map((c) => ({ id: c.id, year: c.year, status: c.status }))}
      initialLines={lines}
      roster={roster}
      canEdit={canEdit}
      canAdmin={canAdmin}
    />
  )
}
