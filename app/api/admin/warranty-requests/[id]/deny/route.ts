import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { sendWarrantyDecisionEmail } from '@/lib/resend-customer'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null

  // Guarded on status='pending' so a double-click (or denying an already-decided
  // request) is a clean no-op rather than clobbering a prior decision.
  const { data: reqRow, error } = await supabaseAdmin
    .from('warranty_requests')
    .update({
      status: 'denied',
      decided_by: admin.user.id,
      decided_at: new Date().toISOString(),
      deny_reason: reason,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, customer_id, equipment_id, serial_number')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!reqRow) return NextResponse.json({ error: 'Request not found or already decided.' }, { status: 404 })

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('company_name, primary_contact_name, contact_email')
    .eq('id', reqRow.customer_id)
    .maybeSingle()

  // Best-effort — an email hiccup must not undo the denial.
  if (customer?.contact_email) {
    try {
      const res = await sendWarrantyDecisionEmail({
        to: customer.contact_email,
        contactName: customer.primary_contact_name,
        companyName: customer.company_name,
        serialNumber: reqRow.serial_number,
        outcome: 'denied',
        denyReason: reason ?? undefined,
        appUrl: req.nextUrl.origin,
      })
      if (res.error) console.error('[warranty-requests/deny] decision email failed:', res.error)
    } catch (e) {
      console.error('[warranty-requests/deny] decision email threw:', e)
    }
  }

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'warranty_request.deny',
    entityType: 'warranty_request',
    entityId: id,
    summary: `Denied warranty claim for ${customer?.company_name || reqRow.customer_id} (${reqRow.serial_number})`,
    metadata: { reason },
  })

  return NextResponse.json({ ok: true })
}
