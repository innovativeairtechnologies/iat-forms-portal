import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendRequestDecisionToEmployee } from '@/lib/resend-pto'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Admin portal uses cookie-based auth, not Supabase auth
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  if (!request) {
    return NextResponse.json({ error: 'Request not found or already reviewed' }, { status: 404 })
  }

  // Fetch the employee
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', request.employee_id)
    .single()

  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // Update request status (no reviewed_by since admin has no Supabase user ID)
  await supabaseAdmin
    .from('time_off_requests')
    .update({ status: decision, reviewed_at: new Date().toISOString() })
    .eq('id', params.id)

  // Approve: deduct balance and log
  if (decision === 'approved') {
    const balanceField    = request.type === 'pto' ? 'pto_balance' : 'sick_balance'
    const currentBalance  = request.type === 'pto' ? employee.pto_balance : employee.sick_balance
    const newBalance      = Math.max(0, currentBalance - request.hours_requested)

    await supabaseAdmin
      .from('employees')
      .update({ [balanceField]: newBalance })
      .eq('id', employee.id)

    await supabaseAdmin
      .from('accrual_log')
      .insert({
        employee_id: employee.id,
        type:        request.type,
        hours_delta: -request.hours_requested,
        reason:      'request_approved',
        note:        `Request approved by admin`,
      })
  }

  // Email the employee — awaited so Vercel doesn't kill the function before Resend fires
  await sendRequestDecisionToEmployee(employee, request, decision).catch(console.error)

  return NextResponse.json({ ok: true })
}
