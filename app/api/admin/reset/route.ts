import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { RESET_TARGETS, type ResetTarget } from '@/lib/reset-targets'

// ─────────────────────────────────────────────────────────────────────────────
// Data Reset — full-admin-only bulk wipe of a single dataset. Built for clearing
// dirty pre-launch test data. DESTRUCTIVE and irreversible.
//
// Account deletes (employees, customers) go through auth.admin.deleteUser(), which
// removes the row in auth.users. That is what actually frees the email address —
// deleting only the employees/customers table row would leave the auth user
// behind and cause "an account already exists for this email" on re-invite. The
// FK cascades (profiles, employees, equipment_milestones, ticket_notes, …) clean
// up dependent rows.
//
// Safety rails:
//   • admin accounts are NEVER deleted by the employees reset (prevents lockout)
//   • the acting admin is always excluded
// ─────────────────────────────────────────────────────────────────────────────

// Staff roles that the "employees" reset is allowed to delete (everything except
// `admin`). Includes the legacy `employee` value for rows not yet migrated.
const STAFF_NON_ADMIN_ROLES = [
  'sales', 'hr', 'marketing', 'engineering', 'production_manager', 'production', 'employee',
]

// Delete-all filter: PostgREST refuses an unfiltered delete, so match every row
// with a non-null id.
const ALL_ROWS = (q: ReturnType<typeof supabaseAdmin.from>) => q.delete().not('id', 'is', null)

async function deleteAuthUsersWithRoles(
  roles: string[],
  excludeId?: string,
): Promise<{ deleted: number; failed: number }> {
  const { data: rows } = await supabaseAdmin.from('profiles').select('id').in('role', roles)
  const ids = (rows || []).map((r) => r.id).filter((id) => id !== excludeId)
  let deleted = 0
  let failed = 0
  for (const id of ids) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) failed++ // e.g. a RESTRICT FK still references this account — surface it
    else deleted++      // profiles + employees rows cascade via FK ON DELETE CASCADE
  }
  return { deleted, failed }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser() // strict: full admin only
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { target } = await req.json()
  if (!RESET_TARGETS.includes(target)) {
    return NextResponse.json({ error: 'Unknown target' }, { status: 400 })
  }

  let deleted = 0
  let failed = 0
  let errorMsg: string | null = null

  try {
    switch (target as ResetTarget) {
      case 'submissions': {
        const { data, error } = await ALL_ROWS(supabaseAdmin.from('submissions')).select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'tickets': {
        const { data, error } = await ALL_ROWS(supabaseAdmin.from('tickets')).select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'equipment': {
        const { data, error } = await ALL_ROWS(supabaseAdmin.from('equipment')).select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'pto': {
        const { data, error } = await supabaseAdmin
          .from('time_off_requests').delete().eq('type', 'pto').select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'sick': {
        const { data, error } = await supabaseAdmin
          .from('time_off_requests').delete().eq('type', 'sick').select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'customers': {
        // Remove customer logins (frees their emails) then the company rows.
        // `deleted` counts freed logins; company rows without a login are also
        // removed but not separately counted.
        const res = await deleteAuthUsersWithRoles(['customer'])
        deleted = res.deleted
        failed = res.failed
        const { error } = await ALL_ROWS(supabaseAdmin.from('customers'))
        errorMsg = error?.message ?? null
        break
      }
      case 'employees': {
        // Delete every non-admin staff login; admins (incl. the actor) are kept.
        const res = await deleteAuthUsersWithRoles(STAFF_NON_ADMIN_ROLES, admin.user.id)
        deleted = res.deleted
        failed = res.failed
        break
      }
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Delete failed'
  }

  if (errorMsg) {
    return NextResponse.json({ error: errorMsg, deleted, failed }, { status: 500 })
  }

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'data.reset',
    entityType: 'dataset',
    entityId: target,
    summary: `Reset dataset "${target}" — deleted ${deleted} record${deleted === 1 ? '' : 's'}` +
      (failed > 0 ? ` (${failed} could not be deleted)` : ''),
    metadata: { target, deleted, failed },
  })

  return NextResponse.json({ ok: true, deleted, failed })
}
