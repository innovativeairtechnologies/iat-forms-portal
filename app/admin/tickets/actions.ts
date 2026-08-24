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
import { sendTicketAssignedAlert } from '@/lib/resend-tickets'

/** Statuses a customer experiences as "done". Both require closing remarks and an
 *  owner; whether those remarks reach the customer is chosen per ticket — see
 *  `share_closing_note`. */
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
    /**
     * Whether the customer's close email includes the closing remarks.
     *
     * ⚠️ Defaults to FALSE — omitting it must never leak the notes. The closing
     * dialog sets it explicitly; the queue's bulk actions cannot reach a terminal
     * status at all, so they never carry it.
     */
    share_closing_note?: boolean
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
    .select('status, priority, owner_id, ticket_number, customer_name, customer_email, assigned_at, customer_company, problem_description')
    .eq('id', ticketId)
    .single()

  const statusChanged = !!prior && prior.status !== data.status
  const closing = statusChanged && TERMINAL.includes(String(data.status))
  const remarks = (data.closing_note ?? '').trim()

  // Closing a ticket requires saying why, in the engineer's own words.
  //
  // The resolution-reason dropdown does not cover this: it is fifteen fixed
  // phrases chosen for reporting, and "Replacement part installed" records nothing
  // about the actual machine. So a ticket cannot reach a terminal state without a
  // real account of what happened.
  //
  // ⚠️ These remarks are the INTERNAL record first. Until 2026-08-24 they were
  // always emailed to the customer verbatim, which quietly made the field
  // customer-facing and unsafe for a candid note; that is now a per-ticket choice
  // (`share_closing_note`) and the requirement to write them is unchanged. Do not
  // reword this guard back into a promise about what the customer sees.
  //
  // Enforced here rather than only in the UI because this is a server action and
  // the client cannot be trusted to have run its own check.
  if (closing && remarks.length < 10) {
    return { error: 'Add closing notes before resolving or closing — they are the record of what was done.' }
  }

  // A ticket cannot reach a terminal state with nobody's name on it.
  //
  // Tickets were being closed while still unassigned, which loses the one fact
  // every later question needs: who handled this. It is unrecoverable after the
  // fact — `audit_log` records that the status changed and who clicked, but an
  // owner that was never set is simply absent, so time-to-close by engineer,
  // workload, and "who do I ask about this?" all silently degrade.
  //
  // Applied to resolved AND closed, matching the closing-note guard directly
  // above rather than inventing a second rule. Resolved is the more important of
  // the two if anything: per the queue's Active/Closed split a resolved ticket is
  // still live work awaiting formal closure, so an unowned one is a job with
  // nobody on the hook to finish it.
  //
  // Server-side because this is a server action and the client cannot be trusted
  // to have run its own check; the UI disables the button for the same reason it
  // does for closing notes, to explain rather than merely refuse.
  if (closing && !data.owner_id) {
    return { error: 'Assign an owner before resolving or closing — a finished ticket needs a name on it.' }
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
        // On a close, record whether the customer was sent the remarks. "Did they
        // see what I wrote?" is otherwise unanswerable after the fact, and it is
        // exactly the question that gets asked when a customer quotes something
        // back — or when a colleague wonders why they did not.
        //
        // ⚠️ Only stamped on a terminal transition; `via` and `from` keep their
        // meaning for the dashboard's customer-reopen filter, which reads these
        // same rows (components/dashboards/dept-cards.tsx).
        metadata: closing
          ? { from: prior.status, to: data.status, notes_shared: data.share_closing_note === true }
          : { from: prior.status, to: data.status },
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

      // ── Tell the new owner ──
      // Assignment used to be silent: a ticket landed in someone's name and the
      // only way they found out was opening the queue and looking.
      //
      // Three deliberate limits:
      //   - the NEW owner only, never the desk. The desk hears about everything
      //     customer-facing already; "Kacy now owns this" in a shared mailbox is
      //     noise, and noise in that mailbox is what the whole alert redesign
      //     exists to reduce.
      //   - nothing on UNassignment (data.owner_id null) — there is nobody to tell.
      //   - nothing when you assign to YOURSELF. You were just there.
      //
      // The lookup mirrors ticketAlertRecipients' guards, and for the same
      // reason: this mail quotes the customer's problem verbatim, so a
      // misdelivery is a disclosure rather than noise. is_active is required and
      // a blank address is treated as "nobody to notify" — the employees table is
      // not staff-only, every customer invite adds a row.
      //
      // Never allowed to fail the update: the assignment is already committed and
      // is what the queue reads. A lost email must not turn a saved triage
      // decision into an error the operator has to retry.
      if (data.owner_id) {
        try {
          const { data: newOwner } = await supabaseAdmin
            .from('employees')
            .select('email, is_active')
            .eq('id', data.owner_id)
            .maybeSingle()

          const addr = typeof newOwner?.email === 'string' ? newOwner.email.trim() : ''
          const selfAssigned = addr.toLowerCase() === (actor.user.email ?? '').trim().toLowerCase()

          if (newOwner?.is_active && addr && !selfAssigned) {
            await sendTicketAssignedAlert({
              ticket_number: tkt,
              ticketId,
              customer_name: prior.customer_name ?? null,
              customer_company: prior.customer_company ?? null,
              problem_description: prior.problem_description ?? null,
              status: String(data.status),
              priority: data.priority ?? null,
              assignedBy: actor.displayName,
            }, addr)
          }
        } catch (err) {
          console.error('[updateTicket] assignment alert failed:', err)
        }
      }
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
          // `=== true` rather than a truthy check: an absent flag from any caller
          // must mean "do not send the notes", never "unspecified, so send them".
          await sendTicketClosedToCustomer(
            t, remarks, data.status as 'resolved' | 'closed',
            data.share_closing_note === true,
            data.resolved_reason ?? null,
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
