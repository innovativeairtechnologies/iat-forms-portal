import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { getBridgeTicket } from '@/lib/bridge-ticket-access'
import { sendCustomerResolvedAlert } from '@/lib/resend-tickets'
import { ticketAlertRecipients } from '@/lib/ticket-recipients'

export const dynamic = 'force-dynamic'

/**
 * Bridge: customer marks their own ticket resolved.
 *
 * ADVISORY ONLY. This never touches the staff-owned `status` enum — moving a
 * ticket to resolved/closed still requires a staff action with a reason and an
 * audit entry. It sets customer_marked_resolved so staff see the signal in the
 * queue and close it out themselves. The customer can un-mark it.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/ticket-resolve')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  const ticketId = requireString(auth.body, 'ticketId')
  if (!customerId || !ticketId) {
    return NextResponse.json({ error: 'Missing customerId or ticketId' }, { status: 400 })
  }

  const ticket = await getBridgeTicket(customerId, ticketId)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Already formally closed by staff — a second signal would just be confusing.
  if (ticket.status === 'closed') {
    return NextResponse.json({ error: 'This ticket is already closed.' }, { status: 409 })
  }

  const resolved = auth.body.resolved !== false // default true; pass false to un-mark

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .update({
      customer_marked_resolved: resolved,
      customer_resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq('id', ticketId)
    .select('customer_marked_resolved, customer_resolved_at')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })

  // Leave a visible note so staff see the signal in thread context — only on the
  // false→true transition, so re-taps don't spam the thread.
  //
  // ⚠️ The note is OPTIONAL here, unlike /api/customer/tickets/[id]/resolve which
  // requires one. Not an oversight: this endpoint's client is the separate
  // iat-customer app, in another repo and on another deploy, and enforcing a
  // field its UI does not send would break marking-resolved there rather than
  // improving it. Add `note` to that app's request, then tighten this to match —
  // in that order, or the feature breaks between the two deploys.
  if (resolved && !ticket.customer_marked_resolved) {
    const note = String(auth.body.note ?? '').trim().slice(0, 4000)
    await supabaseAdmin.from('ticket_notes').insert({
      ticket_id: ticketId,
      content: note ? `Customer marked this ticket as resolved.\n\n${note}` : 'Customer marked this ticket as resolved.',
      visibility: 'public',
      author_type: 'customer',
    })

    // The desk still has to verify and formally close, so it still has to be
    // told. Never fails the request — the flag and note are already committed.
    try {
      // getBridgeTicket selects only the ownership fields, so the display ones
      // are read here rather than widening a helper three other routes share.
      const { data: full } = await supabaseAdmin
        .from('tickets')
        .select('ticket_number, customer_name, owner_id')
        .eq('id', ticketId)
        .maybeSingle()
      const recipients = await ticketAlertRecipients(full?.owner_id as string | null)
      if (full && recipients.length) {
        await sendCustomerResolvedAlert(
          {
            ticket_number: full.ticket_number as string,
            customer_name: (full.customer_name as string | null) ?? null,
            note: note || 'No detail given.',
            ticketId,
          },
          recipients,
        )
      }
    } catch (mailErr) {
      console.error('[bridge/ticket-resolve] desk alert failed:', mailErr)
    }
  }

  return NextResponse.json(data)
}
