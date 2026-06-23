import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

// Activate / deactivate (offboard) an employee.
//   active=false → hide from directory, skip PTO accrual, exclude from ticket
//                  assignment, AND ban their auth user so they can't log in.
//   active=true  → reverse all of the above.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { active } = await req.json().catch(() => ({}))
  if (typeof active !== 'boolean') {
    return NextResponse.json({ error: 'Missing "active" boolean' }, { status: 400 })
  }
  if (!active && params.id === admin.user.id) {
    return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 })
  }

  const { data: target } = await supabaseAdmin
    .from('employees')
    .select('name')
    .eq('id', params.id)
    .single()

  const { error } = await supabaseAdmin
    .from('employees')
    .update({ is_active: active })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Failed to update employee status' }, { status: 500 })

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: active ? 'employee.reactivate' : 'employee.deactivate',
    entityType: 'employee',
    entityId: params.id,
    summary: `${active ? 'Reactivated' : 'Deactivated (offboarded)'} ${target?.name || params.id}`,
    metadata: { is_active: active },
  })

  // Block / restore login by banning the auth user. Best-effort: a legacy
  // employee row without a matching auth user simply has no session to ban.
  try {
    await supabaseAdmin.auth.admin.updateUserById(params.id, {
      ban_duration: active ? 'none' : '876000h',
    })
  } catch (e) {
    console.error('[employee status] auth ban update failed:', e)
  }

  return NextResponse.json({ ok: true, is_active: active })
}
