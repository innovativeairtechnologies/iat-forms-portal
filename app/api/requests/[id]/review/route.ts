import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendRequestDecisionToEmployee } from '@/lib/resend-pto'
import { logAudit } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser()
  if (!admin) {
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

  const balanceField   = request.type === 'pto' ? 'pto_balance' : 'sick_balance'
  const currentBalance = request.type === 'pto' ? employee.pto_balance : employee.sick_balance

  // Block over-balance approvals rather than silently flooring the balance to 0
  // (which previously lost hours and produced a wrong balance).
  if (decision === 'approved' && request.hours_requested > currentBalance) {
    const label = request.type === 'pto' ? 'PTO' : 'sick'
    return NextResponse.json(
      { error: `Insufficient ${label} balance: requesting ${request.hours_requested}h but only ${currentBalance}h available. Adjust the balance first, or deny the request.` },
      { status: 400 }
    )
  }

  // Record the decision and who made it. reviewed_by references employees.id
  // (= the admin's auth user id via the signup trigger); fall back to omitting it
  // for any legacy admin row without a matching employees record, so approvals
  // never break.
  let { error: updErr } = await supabaseAdmin
    .from('time_off_requests')
    .update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: admin.user.id })
    .eq('id', params.id)

  if (updErr) {
    console.error('[review] update with reviewed_by failed, retrying without it:', updErr.message)
    ;({ error: updErr } = await supabaseAdmin
      .from('time_off_requests')
      .update({ status: decision, reviewed_at: new Date().toISOString() })
      .eq('id', params.id))
    if (updErr) return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }

  // Approve: deduct balance and log (approver captured in the note for audit)
  if (decision === 'approved') {
    const newBalance = currentBalance - request.hours_requested

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
        note:        `Request approved by ${admin.displayName}`,
      })
  }

  const label = request.type === 'pto' ? 'PTO' : 'sick'
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'request.review',
    entityType: 'time_off_request',
    entityId: params.id,
    summary: `${decision === 'approved' ? 'Approved' : 'Denied'} ${label} request for ${employee.name} (${request.hours_requested}h)`,
    metadata: { decision, type: request.type, hours: request.hours_requested, employee_id: employee.id },
  })

  // Email the employee — awaited so Vercel doesn't kill the function before Resend fires
  await sendRequestDecisionToEmployee(employee, request, decision).catch(console.error)

  return NextResponse.json({ ok: true })
}
