'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

/* Org-chart mutations. These run with the service-role key (bypasses RLS), so —
   like the submissions/tickets actions — each guards the caller explicitly with
   getAdminUser() rather than trusting only the middleware that gates /admin. */

async function requireAdmin() {
  const admin = await getAdminUser()
  if (!admin) throw new Error('Forbidden')
  return admin
}

async function nameOf(id: string): Promise<string> {
  const { data } = await supabaseAdmin.from('employees').select('name').eq('id', id).single()
  return data?.name || 'an employee'
}

/** Set (or clear, when managerId is null) who an employee reports to. Optionally move
 *  them to a new department in the same write (used to recolor on reassignment). */
export async function setManager(employeeId: string, managerId: string | null, department?: string): Promise<void> {
  const admin = await requireAdmin()

  if (managerId === employeeId) throw new Error('An employee cannot report to themselves.')

  // Walk up the prospective manager's chain — if we reach the employee being moved,
  // this reassignment would create a reporting loop. Reject it.
  if (managerId) {
    let cursor: string | null = managerId
    const seen = new Set<string>()
    while (cursor) {
      if (cursor === employeeId) throw new Error('That would create a reporting loop.')
      if (seen.has(cursor)) break
      seen.add(cursor)
      const { data }: { data: { manager_id: string | null } | null } = await supabaseAdmin
        .from('employees')
        .select('manager_id')
        .eq('id', cursor)
        .single()
      cursor = data?.manager_id ?? null
    }
  }

  const patch: { manager_id: string | null; department?: string } = { manager_id: managerId }
  if (department !== undefined) patch.department = department
  const { error } = await supabaseAdmin
    .from('employees')
    .update(patch)
    .eq('id', employeeId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/org-chart')

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'org.reassign',
    entityType: 'employee',
    entityId: employeeId,
    summary: managerId
      ? `Set ${await nameOf(employeeId)} to report to ${await nameOf(managerId)}`
      : `Moved ${await nameOf(employeeId)} to the top of the org (no manager)`,
    metadata: { manager_id: managerId },
  })
}

/** The permission-gated "erase": hide/restore someone on the chart, non-destructively. */
export async function setVisibility(employeeId: string, visible: boolean): Promise<void> {
  const admin = await requireAdmin()

  const { error } = await supabaseAdmin
    .from('employees')
    .update({ org_visible: visible })
    .eq('id', employeeId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/org-chart')

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: visible ? 'org.show' : 'org.hide',
    entityType: 'employee',
    entityId: employeeId,
    summary: `${visible ? 'Restored' : 'Hid'} ${await nameOf(employeeId)} ${visible ? 'on' : 'from'} the org chart`,
  })
}

/** Replace an employee's interest tags (trimmed, de-duped, capped). */
export async function setInterests(employeeId: string, interests: string[]): Promise<void> {
  await requireAdmin()

  const clean = Array.from(new Set(interests.map((s) => s.trim()).filter(Boolean)))
    .slice(0, 12)
    .map((s) => s.slice(0, 40))

  const { error } = await supabaseAdmin
    .from('employees')
    .update({ interests: clean })
    .eq('id', employeeId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/org-chart')
}

/** Free-layout: persist one node's hand-placed position on the shared org canvas.
 *  Global (one canonical chart), so admin-gated — not a per-user write. */
export async function saveOrgPosition(employeeId: string, x: number, y: number): Promise<void> {
  await requireAdmin()

  const { error } = await supabaseAdmin
    .from('employees')
    .update({ org_x: x, org_y: y })
    .eq('id', employeeId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/org-chart')
}

/** Free-layout: clear every hand-placed position → the chart falls back to the
 *  computed tidy-tree layout. */
export async function resetOrgLayout(): Promise<void> {
  const admin = await requireAdmin()

  const { error } = await supabaseAdmin
    .from('employees')
    .update({ org_x: null, org_y: null })
    .not('id', 'is', null) // all rows (Supabase requires a filter on update)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/org-chart')

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'org.layout_reset',
    entityType: 'employee',
    entityId: 'all',
    summary: 'Reset the org chart to the automatic layout',
  })
}
