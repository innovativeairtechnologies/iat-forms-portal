'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getTicketsActor } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import type { Ticket } from '@/lib/supabase'

export async function updateTicket(
  ticketId: string,
  data: { status: Ticket['status']; priority: Ticket['priority']; owner_id: string | null; resolved_reason?: string | null }
): Promise<{ error: string | null }> {
  // Service-role write — guard the caller explicitly. Perm-scoped, not admin-only:
  // everyone middleware lets onto the ticket page holds `tickets` and works the
  // queue, so they may set status / priority / owner here.
  const actor = await getTicketsActor()
  if (!actor) return { error: 'Forbidden' }

  // Snapshot prior values so we only log genuine transitions (status / priority / owner).
  const { data: prior } = await supabaseAdmin
    .from('tickets')
    .select('status, priority, owner_id, ticket_number, customer_name')
    .eq('id', ticketId)
    .single()

  const { error } = await supabaseAdmin
    .from('tickets')
    .update(data)
    .eq('id', ticketId)
  if (!error && prior) {
    revalidatePath('/admin/tickets')
    revalidatePath(`/admin/tickets/${ticketId}`)

    const auditActor = { id: actor.user.id, name: actor.displayName }
    const who = prior.customer_name || 'Unknown'
    const tkt = prior.ticket_number

    if (prior.status !== data.status) {
      await logAudit({
        actor: auditActor,
        action: 'ticket.status',
        entityType: 'ticket',
        entityId: ticketId,
        summary: `Set ticket ${tkt} (${who}) to ${String(data.status).replace('_', ' ')}`,
        metadata: { from: prior.status, to: data.status },
      })
    }

    if (prior.priority !== data.priority) {
      await logAudit({
        actor: auditActor,
        action: 'ticket.priority',
        entityType: 'ticket',
        entityId: ticketId,
        summary: `Changed ticket ${tkt} (${who}) priority from ${prior.priority ?? 'none'} to ${data.priority ?? 'none'}`,
        metadata: { from: prior.priority, to: data.priority },
      })
    }

    if ((prior.owner_id ?? null) !== (data.owner_id ?? null)) {
      // Resolve the before/after owner names for a readable trail entry.
      const ids = [prior.owner_id, data.owner_id].filter(Boolean) as string[]
      const names: Record<string, string> = {}
      if (ids.length) {
        const { data: emps } = await supabaseAdmin.from('employees').select('id, name').in('id', ids)
        for (const e of emps || []) names[e.id] = e.name
      }
      const fromName = prior.owner_id ? names[prior.owner_id] || 'someone' : 'Unassigned'
      const toName = data.owner_id ? names[data.owner_id] || 'someone' : 'Unassigned'
      await logAudit({
        actor: auditActor,
        action: 'ticket.owner',
        entityType: 'ticket',
        entityId: ticketId,
        summary: `Reassigned ticket ${tkt} (${who}) from ${fromName} to ${toName}`,
        metadata: { from: prior.owner_id, to: data.owner_id },
      })
    }
  }
  return { error: error?.message ?? null }
}
