import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendRequestDecisionToEmployee } from '@/lib/resend-pto'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is an admin (Supabase auth user)
  const { data: reviewer } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!reviewer?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { decision } = await req.json() as { decision: 'approved' | 'denied' }
  if (!['approved', 'denied'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  // Fetch the request
  const { data: request } = await supabaseAdmin
    .from('time_off_requests')
    .select('*')
    .eq('id', params.id)
    .eq('status', 'pending')
    .single()

  if (!request) return NextResponse.json({ error: 'Request not found or already reviewed' }, { status: 404 })

  // Fetch the employee
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', request.employee_id)
    .single()

  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // Update request status
  await supabaseAdmin
    .from('time_off_requests')
    .update({ status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', params.id)

  // Deduct balance and log if approved
  if (decision === 'approved') {
    const balanceField = request.type === 'pto' ? 'pto_balance' : 'sick_balance'
    const currentBalance = request.type === 'pto' ? employee.pto_balance : employee.sick_balance
    const newBalance = Math.max(0, currentBalance - request.hours_requested)

    await supabaseAdmin
      .from('employees')
      .update({ [balanceField]: newBalance })
      .eq('id', employee.id)

    await supabaseAdmin
      .from('accrual_log')
      .insert({
        employee_id: employee.id,
        type: request.type,
        hours_delta: -request.hours_requested,
        reason: 'request_approved',
        note: `Request ${params.id} approved by ${reviewer.name || reviewer.email}`,
      })
  }

  // Email the employee
  sendRequestDecisionToEmployee(employee, request, decision).catch(console.error)

  return NextResponse.json({ ok: true })
}
