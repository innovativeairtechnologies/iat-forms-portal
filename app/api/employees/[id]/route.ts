import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Whitelist updatable fields. NOTE: role/is_admin is intentionally NOT editable
  // here — all role changes go through /api/admin/users/[id]/role, which validates
  // the full role vocabulary and keeps profiles.role + employees.is_admin in sync.
  // (This route used to sync profiles.role from an is_admin boolean, which wrote
  // the legacy 'employee' value and could clobber a scoped role — removed.)
  const allowed = ['name', 'email', 'job_title', 'department', 'phone', 'bio',
                   'pto_balance', 'sick_balance', 'hire_date']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Snapshot the prior row when we're touching balances, for the accrual_log
  // deltas and the audit trail.
  const touchesAudited = 'pto_balance' in update || 'sick_balance' in update
  type EmpSnap = { name: string | null; pto_balance: number; sick_balance: number }
  let current: EmpSnap | null = null
  if (touchesAudited) {
    const { data } = await supabaseAdmin
      .from('employees')
      .select('name, pto_balance, sick_balance')
      .eq('id', params.id)
      .single()
    current = data as EmpSnap | null
  }

  // Log manual balance adjustments to the accrual ledger
  if (('pto_balance' in update || 'sick_balance' in update) && current) {
    const logs = []
    if ('pto_balance' in update) {
      const delta = (update.pto_balance as number) - current.pto_balance
      if (delta !== 0) logs.push({ employee_id: params.id, type: 'pto', hours_delta: delta, reason: 'manual_adjustment', note: 'Admin balance update' })
    }
    if ('sick_balance' in update) {
      const delta = (update.sick_balance as number) - current.sick_balance
      if (delta !== 0) logs.push({ employee_id: params.id, type: 'sick', hours_delta: delta, reason: 'manual_adjustment', note: 'Admin balance update' })
    }
    if (logs.length) await supabaseAdmin.from('accrual_log').insert(logs)
  }

  const { error } = await supabaseAdmin.from('employees').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit trail — balance adjustments.
  if (current) {
    const who = current.name || params.id
    const actor = { id: admin.user.id, name: admin.displayName }
    for (const kind of ['pto', 'sick'] as const) {
      const field = `${kind}_balance` as 'pto_balance' | 'sick_balance'
      if (field in update) {
        const next = update[field] as number
        const delta = next - current[field]
        if (delta !== 0) {
          await logAudit({
            actor,
            action: 'accrual.adjust',
            entityType: 'employee',
            entityId: params.id,
            summary: `Adjusted ${who}'s ${kind.toUpperCase()} balance by ${delta > 0 ? '+' : ''}${delta}h (to ${next}h)`,
            metadata: { type: kind, from: current[field], to: next, delta },
          })
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}

// Permanently delete an employee account. Removes the Supabase auth user (which
// cascades the employees + profiles rows and frees the email for re-invite). Use
// the status endpoint to deactivate/offboard a real employee instead; this is for
// removing a record entirely (e.g. clearing test data). The acting admin cannot
// delete their own account.
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (params.id === admin.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 })
  }

  const { data: emp } = await supabaseAdmin
    .from('employees')
    .select('name, email')
    .eq('id', params.id)
    .single()

  // Deleting the auth user cascades employees + profiles + related rows.
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(params.id)
  if (authErr) {
    const notFound = authErr.status === 404 || /not.?found/i.test(authErr.message || '')
    if (notFound) {
      // Genuinely no auth user (orphan employees row) — remove the row directly.
      const { error: rowErr } = await supabaseAdmin.from('employees').delete().eq('id', params.id)
      if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 })
    } else {
      // A real auth-API failure against an existing user. Do NOT delete the
      // employees row — that would orphan the login and keep the email occupied.
      // Surface the error so the admin can retry against an intact record.
      return NextResponse.json({ error: authErr.message }, { status: 500 })
    }
  }

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'employee.delete',
    entityType: 'employee',
    entityId: params.id,
    summary: `Deleted employee ${emp?.name || emp?.email || params.id}`,
    metadata: { email: emp?.email ?? null },
  })

  return NextResponse.json({ success: true })
}
