import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { PERM_LABELS, ROLE_LABELS, NON_DELEGATABLE_PERMS, type Perm, type StaffRole } from '@/lib/roles'

// Grant/revoke one scoped role's permission (migration 045). Full-admin only
// (getAdminUser is strict). The matrix page POSTs here per toggle.
//
// Guards: only the 5 editable scoped roles (admin is all-access in code;
// production/customer are barred from /admin); only known permissions; and the
// privilege-sensitive NON_DELEGATABLE perms ('permissions', 'customer_jerry',
// 'knowledge') can never be delegated — that closes the escalation hole where a
// scoped role could be granted the ability to edit permissions.

const EDITABLE_ROLES: string[] = ['sales', 'hr', 'marketing', 'engineering', 'production_manager']
const ALL_PERMS = Object.keys(PERM_LABELS) as Perm[]

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const role = typeof body?.role === 'string' ? body.role : ''
  const perm = typeof body?.perm === 'string' ? (body.perm as Perm) : ('' as Perm)
  const granted = body?.granted

  if (!EDITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'That role is not editable here.' }, { status: 400 })
  }
  if (!ALL_PERMS.includes(perm)) {
    return NextResponse.json({ error: 'Unknown permission.' }, { status: 400 })
  }
  if (NON_DELEGATABLE_PERMS.includes(perm)) {
    return NextResponse.json({ error: 'That permission is admin-only and cannot be delegated.' }, { status: 400 })
  }
  if (typeof granted !== 'boolean') {
    return NextResponse.json({ error: 'granted must be a boolean.' }, { status: 400 })
  }

  if (granted) {
    const { error } = await supabaseAdmin
      .from('role_permissions')
      .upsert({ role, perm }, { onConflict: 'role,perm', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: 'Failed to grant permission.' }, { status: 500 })
  } else {
    const { error } = await supabaseAdmin
      .from('role_permissions')
      .delete()
      .eq('role', role)
      .eq('perm', perm)
    if (error) return NextResponse.json({ error: 'Failed to revoke permission.' }, { status: 500 })
  }

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'permission.update',
    entityType: 'role',
    entityId: role,
    summary: `${granted ? 'Granted' : 'Revoked'} "${PERM_LABELS[perm]}" ${granted ? 'to' : 'from'} ${ROLE_LABELS[role as StaffRole]}`,
    metadata: { role, perm, granted },
  })

  return NextResponse.json({ ok: true, role, perm, granted })
}
