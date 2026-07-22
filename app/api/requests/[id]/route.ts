import { NextRequest, NextResponse } from 'next/server'
import { getTimeOffActor } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

// Permanently delete a time-off request (PTO or sick). Note: this removes the
// request record only; it does NOT reverse any balance change from an approval.
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getTimeOffActor()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: reqRow } = await supabaseAdmin
    .from('time_off_requests')
    .select('type, start_date, employee_id')
    .eq('id', params.id)
    .single()

  let employeeName: string | null = null
  if (reqRow?.employee_id) {
    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('name')
      .eq('id', reqRow.employee_id)
      .single()
    employeeName = emp?.name ?? null
  }

  const { error } = await supabaseAdmin.from('time_off_requests').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const kind = reqRow?.type === 'sick' ? 'sick time' : 'PTO'
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'time_off.delete',
    entityType: 'time_off_request',
    entityId: params.id,
    summary: `Deleted ${employeeName ? `${employeeName}'s ` : ''}${kind} request` +
      (reqRow?.start_date ? ` (${reqRow.start_date})` : ''),
  })

  return NextResponse.json({ success: true })
}
