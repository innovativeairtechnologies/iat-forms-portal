import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role } = await req.json()
  if (role !== 'admin' && role !== 'employee') {
    return NextResponse.json({ error: 'role must be admin or employee' }, { status: 400 })
  }

  // Capture the prior role + target name for the audit trail before we overwrite.
  const [{ data: prior }, { data: target }] = await Promise.all([
    supabaseAdmin.from('profiles').select('role').eq('id', params.id).single(),
    supabaseAdmin.from('employees').select('name, email').eq('id', params.id).single(),
  ])

  // Update profiles table (source of truth for auth)
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: params.id, role })

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  // Keep employees.is_admin in sync for the existing employee detail UI
  await supabaseAdmin
    .from('employees')
    .update({ is_admin: role === 'admin' })
    .eq('id', params.id)

  const who = target?.name || target?.email || params.id
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'role.update',
    entityType: 'employee',
    entityId: params.id,
    summary: `Changed ${who}'s role to ${role}`,
    metadata: { from: prior?.role ?? null, to: role },
  })

  return NextResponse.json({ ok: true, role })
}
