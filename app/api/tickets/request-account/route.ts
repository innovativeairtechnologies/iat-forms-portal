import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'

// Neutralize LIKE/ILIKE wildcards so a value like "%" can't match every row.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, c => `\\${c}`)
}

export async function POST(req: NextRequest) {
  // State-changing action (not a read like /api/tickets/status) — its own bucket.
  const limited = await rateLimit(req, { name: 'ticket-request-account', max: 10, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json().catch(() => ({}))
    const ticketNumber = String(body.ticket_number ?? '').trim()
    const email = String(body.email ?? '').trim()

    if (!ticketNumber || !email) {
      return NextResponse.json({ error: 'Ticket number and email are both required.' }, { status: 400 })
    }

    // Re-prove ownership exactly like /api/tickets/status.
    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .select('id, customer_id, serial_number')
      .ilike('ticket_number', escapeLike(ticketNumber))
      .ilike('customer_email', escapeLike(email))
      .maybeSingle()

    if (!ticket) {
      return NextResponse.json(
        { error: 'No ticket found matching that number and email. Double-check both and try again.' },
        { status: 404 }
      )
    }

    // Already linked to a customer account — nothing to request.
    if (ticket.customer_id) {
      return NextResponse.json({ status: 'already_linked' })
    }

    // A pending request already exists for this ticket — idempotent no-op.
    const { data: existingPending } = await supabaseAdmin
      .from('customer_portal_requests')
      .select('id')
      .eq('ticket_id', ticket.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (existingPending) {
      return NextResponse.json({ status: 'already_pending' })
    }

    // Snapshot the requester's details off the ticket (not the client body) so
    // the request row can't be spoofed with different contact info.
    const { data: fullTicket } = await supabaseAdmin
      .from('tickets')
      .select('customer_company, customer_name, customer_phone')
      .eq('id', ticket.id)
      .single()

    // Suggested existing customer: is this ticket's equipment already linked
    // to a customer? Helps the approving admin avoid creating a duplicate
    // company when a second contact from an existing customer requests access.
    let suggestedCustomerId: string | null = null
    if (ticket.serial_number) {
      const { data: eq } = await supabaseAdmin
        .from('equipment')
        .select('customer_id')
        .eq('serial_number', ticket.serial_number)
        .maybeSingle()
      suggestedCustomerId = eq?.customer_id ?? null
    }

    const { error } = await supabaseAdmin
      .from('customer_portal_requests')
      .insert({
        ticket_id: ticket.id,
        requested_email: email.toLowerCase(),
        requested_company: fullTicket?.customer_company ?? null,
        requested_contact_name: fullTicket?.customer_name ?? null,
        requested_phone: fullTicket?.customer_phone ?? null,
        suggested_customer_id: suggestedCustomerId,
      })

    // Unique-violation from a concurrent double-submit — treat as success, not an error.
    if (error?.code === '23505') {
      return NextResponse.json({ status: 'already_pending' })
    }
    if (error) {
      console.error('[request-account] insert failed:', error)
      return NextResponse.json({ error: 'Could not submit the request.' }, { status: 500 })
    }

    return NextResponse.json({ status: 'submitted' }, { status: 201 })
  } catch (err) {
    console.error('[request-account] route error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
