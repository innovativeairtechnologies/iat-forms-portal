import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerUser } from '@/lib/customer-auth'
import { sendCustomerResolvedAlert } from '@/lib/resend-tickets'

/** Floor for the customer's "why do you think it is fixed" note. Their word
 *  starts a verification, so it has to say enough to verify against. */
const MIN_CUSTOMER_NOTE = 10

// Lets a logged-in customer signal that THEIR OWN ticket is resolved, from the
// customer ticket-detail page. This is an ADVISORY flag only — it never changes
// the staff-owned status enum (moving to 'resolved'/'closed' still requires a
// staff action + resolved_reason + audit log). Staff see the flag as a badge in
// the queue/detail and close the ticket out. The customer can un-mark it if they
// clicked by mistake or the issue recurs.
//
// Ownership check mirrors the customer_id/customer_email match used by the
// contact + notes routes / app/customer/page.tsx. Customer-only (admins use the
// admin ticket flow). The update object is an explicit allow-list — the raw body
// is never spread into .update().

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getCustomerUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id, customer_id, customer_email, status, customer_marked_resolved')
    .eq('id', params.id)
    .maybeSingle()
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const email = (session.user.email || session.customer.contact_email || '').toLowerCase()
  const owns =
    ticket.customer_id === session.customerId ||
    (!!ticket.customer_email && ticket.customer_email.toLowerCase() === email)
  if (!owns) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // A ticket staff already closed can't be (un)marked — avoids a confusing
  // double-signal after it's been formally closed out.
  if (ticket.status === 'closed') {
    return NextResponse.json({ error: 'This ticket is already closed.' }, { status: 409 })
  }

  // Default true; pass { resolved: false } to un-mark.
  const body = await req.json().catch(() => null)
  const resolved = body?.resolved !== false
  const note = String(body?.note ?? '').trim().slice(0, 4000)

  // Marking it fixed requires saying what "fixed" looks like. A bare flag gives
  // the engineer who has to verify it nothing to check against, and this claim
  // is the thing that starts a verification rather than ending one. Un-marking
  // needs no note — withdrawing a claim is not a claim.
  if (resolved && !ticket.customer_marked_resolved && note.length < MIN_CUSTOMER_NOTE) {
    return NextResponse.json(
      { error: 'Please tell us what changed, so our team can confirm the fix before closing the ticket.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .update({
      customer_marked_resolved: resolved,
      customer_resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq('id', params.id)
    .select('customer_marked_resolved, customer_resolved_at')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })

  // Drop a visible note in the shared thread so staff see the signal in context
  // — only on the transition into resolved, to avoid duplicate notes on re-taps.
  if (resolved && !ticket.customer_marked_resolved) {
    await supabaseAdmin.from('ticket_notes').insert({
      ticket_id: params.id,
      content: `Customer marked this ticket as resolved.\n\n${note}`,
      visibility: 'public',
      author_type: 'customer',
    })

    // Tell the desk to go and check. The ticket is deliberately still open: a
    // customer saying "it seems fine now" and an engineer confirming the fault is
    // gone are different claims, and only the second one should close a record.
    // Never fails the request — the flag and the note are already committed and
    // visible in /admin/tickets either way.
    try {
      const { data: full } = await supabaseAdmin
        .from('tickets')
        .select('ticket_number, customer_name')
        .eq('id', params.id)
        .maybeSingle()
      const recipients = (process.env.SUPPORT_NOTIFICATION_EMAIL || 'iatsupport@dehumidifiers.com')
        .split(',').map(s => s.trim()).filter(Boolean)
      if (full && recipients.length) {
        await sendCustomerResolvedAlert(
          {
            ticket_number: full.ticket_number as string,
            customer_name: (full.customer_name as string | null) ?? null,
            note,
            ticketId: params.id,
          },
          recipients,
        )
      }
    } catch (mailErr) {
      console.error('[customer/resolve] desk alert failed:', mailErr)
    }
  }

  return NextResponse.json(data)
}
