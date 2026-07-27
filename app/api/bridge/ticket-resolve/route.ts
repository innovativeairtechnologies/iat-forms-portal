import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { getBridgeTicket } from '@/lib/bridge-ticket-access'

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
  if (resolved && !ticket.customer_marked_resolved) {
    await supabaseAdmin.from('ticket_notes').insert({
      ticket_id: ticketId,
      content: 'Customer marked this ticket as resolved.',
      visibility: 'public',
      author_type: 'customer',
    })
  }

  return NextResponse.json(data)
}
