import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

// Permanently delete a ticket (and its notes/attachments via FK cascade).
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('ticket_number, customer_name')
    .eq('id', params.id)
    .single()

  // Remove child notes first (the ticket_notes FK predates the numbered
  // migrations and may not cascade), then the ticket itself.
  await supabaseAdmin.from('ticket_notes').delete().eq('ticket_id', params.id)
  const { error } = await supabaseAdmin.from('tickets').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'ticket.delete',
    entityType: 'ticket',
    entityId: params.id,
    summary: `Deleted ticket ${ticket?.ticket_number || params.id}` +
      (ticket?.customer_name ? ` (${ticket.customer_name})` : ''),
  })

  return NextResponse.json({ success: true })
}
