import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Whitelist updatable fields
  const allowed = ['name', 'email', 'job_title', 'department', 'phone', 'bio',
                   'pto_balance', 'sick_balance', 'hire_date', 'is_admin']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Snapshot the prior row when we're touching balances or the admin flag, both
  // for the accrual_log deltas and the audit trail.
  const touchesAudited = 'pto_balance' in update || 'sick_balance' in update || 'is_admin' in update
  type EmpSnap = { name: string | null; pto_balance: number; sick_balance: number; is_admin: boolean }
  let current: EmpSnap | null = null
  if (touchesAudited) {
    const { data } = await supabaseAdmin
      .from('employees')
      .select('name, pto_balance, sick_balance, is_admin')
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

  // Keep profiles.role in sync when is_admin changes
  if ('is_admin' in update) {
    await supabaseAdmin
      .from('profiles')
      .upsert({ id: params.id, role: update.is_admin ? 'admin' : 'employee' })
  }

  // Audit trail — balance adjustments and admin-flag changes.
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
    if ('is_admin' in update && update.is_admin !== current.is_admin) {
      await logAudit({
        actor,
        action: 'role.update',
        entityType: 'employee',
        entityId: params.id,
        summary: `Changed ${who}'s role to ${update.is_admin ? 'admin' : 'employee'}`,
        metadata: { from: current.is_admin ? 'admin' : 'employee', to: update.is_admin ? 'admin' : 'employee' },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
