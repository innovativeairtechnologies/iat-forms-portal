import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null

  // Guarded on status='pending' so a double-click (or denying an already-decided
  // request) is a clean no-op rather than clobbering a prior decision.
  const { data: reqRow, error } = await supabaseAdmin
    .from('customer_portal_requests')
    .update({
      status: 'denied',
      decided_by: admin.user.id,
      decided_at: new Date().toISOString(),
      deny_reason: reason,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, requested_email, requested_company')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!reqRow) return NextResponse.json({ error: 'Request not found or already decided.' }, { status: 404 })

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'customer_portal_request.deny',
    entityType: 'customer_portal_request',
    entityId: id,
    summary: `Denied portal access request from ${reqRow.requested_company || reqRow.requested_email}`,
    metadata: { reason },
  })

  return NextResponse.json({ ok: true })
}
