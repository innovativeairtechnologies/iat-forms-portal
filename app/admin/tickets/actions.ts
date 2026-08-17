'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getTicketsActor } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import type { Ticket } from '@/lib/supabase'
import {
  sendTicketClosedToCustomer,
  sendTicketStatusChangeToCustomer,
} from '@/lib/resend-customer-tickets'

/** Statuses a customer experiences as "done". Both require closing remarks, and
 *  both send those remarks to the person who raised the ticket. */
const TERMINAL: readonly string[] = ['resolved', 'closed']

export async function updateTicket(
  ticketId: string,
  data: {
    status: Ticket['status']
    priority: Ticket['priority']
    owner_id: string | null
    resolved_reason?: string | null
    /** Required when moving into resolved/closed — see the guard below. */
    closing_note?: string | null
  }
): Promise<{ error: string | null }> {
  // Service-role write — guard the caller explicitly. Perm-scoped, not admin-only:
  // everyone middleware lets onto the ticket page holds `tickets` and works the
  // queue, so they may set status / priority / owner here.
  const actor = await getTicketsActor()
  if (!actor) return { error: 'Forbidden' }

  // Snapshot prior values so we only log genuine transitions (status / priority / owner).
  const { data: prior } = await supabaseAdmin
    .from('tickets')
    .select('status, priority, owner_id, ticket_number, customer_name, customer_email, assigned_at')
    .eq('id', ticketId)
    .single()

  const statusChanged = !!prior && prior.status !== data.status
  const closing = statusChanged && TERMINAL.includes(String(data.status))
  const remarks = (data.closing_note ?? '').trim()

  // Closing a ticket requires saying why, in the engineer's own words.
  //
  // The resolution-reason dropdown does not cover this: it is fifteen fixed
  // phrases chosen for reporting, and "Replacement part installed" tells the
  // customer nothing about their machine. These remarks are what gets emailed to
  // the person who raised the ticket, so a ticket cannot reach a terminal state
  // without something worth sending. Enforced here rather than only in the UI
  // because this is a server action and the client cannot be trusted to have run
  // its own check.
  if (closing && remarks.length < 10) {
    return { error: 'Add closing notes before resolving or closing — the customer is sent what you write here.' }
  }

  // Whitelist the fields this action may set — never forward the whole client
  // object, or a tickets-scoped caller could set customer_email, ids, brand, etc.
  const patch: Record<string, unknown> = {
    status: data.status,
    priority: data.priority,
    owner_id: data.owner_id,
  }
  if ('resolved_reason' in data) patch.resolved_reason = data.resolved_reason ?? null

  // Stamp when a ticket becomes someone's, so the reminder sweep can ask how long
  // it has been theirs (migration 090). Only on a genuine change of owner —
  // re-saving the same person must not reset their clock and dodge the nudge.
  const ownerChanged = !!prior && (prior.owner_id ?? null) !== (data.owner_id ?? null)
  if (ownerChanged) {
    patch.assigned_at = data.owner_id ? new Date().toISOString() : null
    // A reassigned ticket starts its chase clock over; leaving the old stamp
    // would suppress the first nudge to the new owner.
    patch.assignee_nudged_at = null
  }

  const { error } = await supabaseAdmin
    .from('tickets')
    .update(patch)
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

    // ── Closing remarks onto the thread, then out to the customer ──
    // Written as a PUBLIC note authored by the closing employee: the customer is
    // about to be emailed these exact words, so hiding them from the thread the
    // customer can read would put the record and the email out of step.
    if (closing) {
      const { error: noteErr } = await supabaseAdmin.from('ticket_notes').insert({
        ticket_id: ticketId,
        content: remarks,
        visibility: 'public',
        author_type: 'admin',
        author_name: actor.displayName,
      })
      if (noteErr) console.error('[updateTicket] closing note insert failed:', noteErr)
    }

    // Customer notifications. Awaited so Vercel cannot kill the action mid-send,
    // but never allowed to fail the update — the status change is already
    // committed above and is what the desk and the status page both read. A lost
    // email must not turn a saved triage decision into an error the operator
    // retries, re-sending everything a second time.
    if (statusChanged && prior.customer_email) {
      const t = {
        ticket_number: prior.ticket_number,
        customer_name: prior.customer_name,
        customer_email: prior.customer_email,
      }
      try {
        if (closing) {
          await sendTicketClosedToCustomer(
            t, remarks, data.status as 'resolved' | 'closed', data.resolved_reason ?? null,
          )
        } else {
          await sendTicketStatusChangeToCustomer(t, String(data.status))
        }
      } catch (mailErr) {
        console.error('[updateTicket] customer notification failed:', mailErr)
      }
    }
  }
  return { error: error?.message ?? null }
}
