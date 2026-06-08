import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Whitelist updatable fields
  const allowed = ['name', 'email', 'job_title', 'department', 'phone', 'bio',
                   'pto_balance', 'sick_balance', 'pto_accrual_rate', 'sick_accrual_rate',
                   'hire_date', 'is_admin']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Log manual balance adjustments
  if ('pto_balance' in update || 'sick_balance' in update) {
    const { data: current } = await supabaseAdmin
      .from('employees')
      .select('pto_balance, sick_balance')
      .eq('id', params.id)
      .single()

    const logs = []
    if ('pto_balance' in update && current) {
      const delta = (update.pto_balance as number) - current.pto_balance
      if (delta !== 0) logs.push({ employee_id: params.id, type: 'pto', hours_delta: delta, reason: 'manual_adjustment', note: 'Admin balance update' })
    }
    if ('sick_balance' in update && current) {
      const delta = (update.sick_balance as number) - current.sick_balance
      if (delta !== 0) logs.push({ employee_id: params.id, type: 'sick', hours_delta: delta, reason: 'manual_adjustment', note: 'Admin balance update' })
    }
    if (logs.length) await supabaseAdmin.from('accrual_log').insert(logs)
  }

  const { error } = await supabaseAdmin.from('employees').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
