import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ProductionDepartment, ProductionTask } from '@/lib/supabase'
import { shopDate } from '@/lib/production'
import ProductionClient from './ProductionClient'

// /admin/production — the manager's side of the public shop boards (055).
// Page authz is middleware's job (canAccessAdminPath → `production_board`), so
// there's no guard call here; that's the house pattern (see tool-crib/page.tsx).

export const dynamic = 'force-dynamic'

export type DeptRow = ProductionDepartment & { tasks: ProductionTask[] }

export default async function ProductionPage() {
  const [{ data: depts }, { data: tasks }] = await Promise.all([
    supabaseAdmin.from('production_departments').select('*').order('sort_order', { ascending: true }),
    supabaseAdmin.from('production_tasks').select('*').is('archived_at', null),
  ])

  // Stitch in memory rather than a nested select: the whole set is a handful of
  // rows, and the flat query keeps the board-progress maths in one place.
  const byDept = new Map<string, ProductionTask[]>()
  for (const t of (tasks ?? []) as ProductionTask[]) {
    const list = byDept.get(t.department_id)
    if (list) list.push(t)
    else byDept.set(t.department_id, [t])
  }

  const rows: DeptRow[] = ((depts ?? []) as ProductionDepartment[]).map((d) => ({
    ...d,
    tasks: byDept.get(d.id) ?? [],
  }))

  // The manager's page is the ONE place the tokens are legitimately exposed —
  // it's how the QR codes get printed. It's perm-gated by middleware and
  // rendered server-side to a signed-in manager.
  return <ProductionClient departments={rows} today={shopDate()} />
}
