import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { sendCustomerMessageAlert } from '@/lib/resend-tickets'

/* Lets a customer who is NOT signed in add a message to their own ticket.

   Why this exists: portal mail now sends from noreply@, and the confirmation
   tells customers not to reply to it. Without a way to write back, anyone with a
   follow-up question would be pushed to phone or to a mailbox, and the thread
   would fragment across places nobody is looking — which is the exact problem
   the no-reply change is meant to solve. So the "do not reply" instruction and
   this endpoint have to ship together.

   ── How a stranger is allowed to write to a ticket ──────────────────────────
   Ownership is proved the same way the status lookup proves it: the ticket
   NUMBER plus the EMAIL the ticket was submitted with must both match one row.
   The number alone is guessable; the pair is not, and it is exactly what the
   customer already had to supply to see the ticket at all.

   Hardening on top of that, because this is a public write:
     • reCAPTCHA, same as the other public POSTs
     • a tight rate limit — this writes rows and sends mail
     • the message is stored ESCAPED, never as caller-supplied HTML
     • visibility/author_type are hardcoded, never read from the body, so a
       crafted request cannot post an "internal" note or impersonate staff
     • the reply is attached to the ticket the pair resolves to, so a caller
       cannot aim a note at some other ticket's id */

const MAX_MESSAGE = 4000

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, c => `\\${c}`)
}

/** Customer text is never HTML. Escape it, then rebuild the paragraph breaks. */
function toSafeHtml(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  return esc
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`)
    .join('')
}

export async function POST(req: NextRequest) {
  // Tighter than the status lookup (20): this one writes a row and sends mail.
  const limited = await rateLimit(req, { name: 'ticket-status-message', max: 8, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json().catch(() => ({}))

    // Stricter than every other public endpoint, deliberately.
    //
    // failClosed: elsewhere a missing secret or a Google outage lets the request
    // through, because losing a real customer's submission is worse than
    // admitting a bot. Here the opposite holds: this is an anonymous WRITE into
    // an existing record, reCAPTCHA is the only thing gating it, and failing open
    // would mean one missing env var silently turns it into an open door that
    // nobody notices. A customer blocked here still has the phone and the ticket.
    //
    // minScore 0.7 rather than the 0.5 default: the account this protects is a
    // guessable pair (sequential ticket number + an often-public email), so the
    // bar for automation should be higher than for a first-time submission.
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, 'ticket_message', {
      failClosed: true,
      minScore: 0.7,
    })
    if (!recaptcha.ok) {
      console.warn('[status/message] reCAPTCHA check failed:', recaptcha.reason)
      return NextResponse.json({ error: 'Please try again.' }, { status: 400 })
    }

    const ticketNumber = String(body.ticket_number ?? '').trim()
    const email = String(body.email ?? '').trim()
    const message = String(body.message ?? '').trim().slice(0, MAX_MESSAGE)

    if (!ticketNumber || !email) {
      return NextResponse.json({ error: 'Ticket number and email are both required.' }, { status: 400 })
    }
    if (!message) {
      return NextResponse.json({ error: 'Please write a message before sending.' }, { status: 400 })
    }

    // The ownership check. Same escaping as the status route so a wildcard in
    // either field cannot be used to walk other people's tickets.
    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, customer_name, customer_email, status')
      .ilike('ticket_number', escapeLike(ticketNumber))
      .ilike('customer_email', escapeLike(email))
      .maybeSingle()

    if (!ticket) {
      return NextResponse.json(
        { error: 'No ticket found matching that number and email. Double-check both and try again.' },
        { status: 404 }
      )
    }

    // visibility/author_type are hardcoded, NOT taken from the body — a customer
    // note is always public and always attributed to the customer.
    const insert: Record<string, unknown> = {
      ticket_id: ticket.id,
      content: toSafeHtml(message),
      visibility: 'public',
      author_type: 'customer',
      author_name: ticket.customer_name || 'Customer',
    }

    let { error } = await supabaseAdmin.from('ticket_notes').insert(insert)

    // Migration 054 not applied → author columns absent. Save unattributed
    // rather than lose the customer's message; the same fallback the admin
    // notes route uses.
    if (error && (error.code === 'PGRST204' || error.code === '42703')) {
      console.warn('[status/message] migration 054 not applied — saving without attribution:', error.message)
      const { author_name, ...withoutAuthor } = insert
      ;({ error } = await supabaseAdmin.from('ticket_notes').insert(withoutAuthor))
    }

    if (error) {
      console.error('[status/message] insert failed:', error)
      return NextResponse.json({ error: 'We could not save your message. Please try again.' }, { status: 500 })
    }

    // Tell the desk. Awaited so Vercel cannot kill the function mid-send, but a
    // mail failure never fails the request — the message is already on the
    // ticket and visible in /admin/tickets either way.
    const recipients = (process.env.SUPPORT_NOTIFICATION_EMAIL || 'iatsupport@dehumidifiers.com')
      .split(',').map(s => s.trim()).filter(Boolean)
    if (recipients.length) {
      await sendCustomerMessageAlert(
        { ticket_number: ticket.ticket_number, customer_name: ticket.customer_name, message },
        recipients,
      ).catch(err => console.error('[status/message] desk alert failed:', err))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[status/message] route error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
