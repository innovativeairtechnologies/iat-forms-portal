'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import type { Ticket } from '@/lib/supabase'

export async function updateTicket(
  ticketId: string,
  data: { status: Ticket['status']; priority: Ticket['priority']; owner_id: string | null; resolved_reason?: string | null }
): Promise<{ error: string | null }> {
  // Service-role write — guard the caller explicitly.
  const admin = await getAdminUser()
  if (!admin) return { error: 'Forbidden' }

  // Snapshot prior status so we only log genuine status transitions.
  const { data: prior } = await supabaseAdmin
    .from('tickets')
    .select('status, ticket_number, customer_name')
    .eq('id', ticketId)
    .single()

  const { error } = await supabaseAdmin
    .from('tickets')
    .update(data)
    .eq('id', ticketId)
  if (!error) {
    revalidatePath('/admin/tickets')
    revalidatePath(`/admin/tickets/${ticketId}`)

    if (prior && prior.status !== data.status) {
      await logAudit({
        actor: { id: admin.user.id, name: admin.displayName },
        action: 'ticket.status',
        entityType: 'ticket',
        entityId: ticketId,
        summary: `Set ticket ${prior.ticket_number} (${prior.customer_name || 'Unknown'}) to ${String(data.status).replace('_', ' ')}`,
        metadata: { from: prior.status, to: data.status },
      })
    }
  }
  return { error: error?.message ?? null }
}
