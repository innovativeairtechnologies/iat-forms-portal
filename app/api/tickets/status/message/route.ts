import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { sendCustomerMessageAlert, sendTicketReopenedAlert } from '@/lib/resend-tickets'
import { ticketAlertRecipients } from '@/lib/ticket-recipients'
import { REOPEN_WINDOW_DAYS, reopenDecision, WAITING_STATUS } from '@/lib/ticket-history'
import { logAudit } from '@/lib/audit'

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
      .select('id, ticket_number, customer_name, customer_email, status, owner_id')
      .ilike('ticket_number', escapeLike(ticketNumber))
      .ilike('customer_email', escapeLike(email))
      .maybeSingle()

    if (!ticket) {
      return NextResponse.json(
        { error: 'No ticket found matching that number and email. Double-check both and try again.' },
        { status: 404 }
      )
    }

    // ── The reopen window ──
    // A closed ticket accepts a reply for REOPEN_WINDOW_DAYS after it was closed;
    // past that the customer is asked to raise a fresh one. A machine that fails
    // again two months later is a new fault with new symptoms, and appending it
    // to a closed thread buries that under an old diagnosis.
    //
    // Checked BEFORE the note is written, so a blocked customer does not leave a
    // message nobody will read. reopenDecision fails open on every uncertainty —
    // see lib/ticket-history.ts.
    const reopen = await reopenDecision(ticket.id, ticket.status)
    if (!reopen.allowed) {
      return NextResponse.json(
        {
          error: `This ticket was closed ${reopen.daysSinceClose} days ago, and we close conversations after ${REOPEN_WINDOW_DAYS} days. Please open a new ticket and describe what is happening now — it helps to include the current symptoms, since they may have changed.`,
          code: 'reopen_window_closed',
          newTicketUrl: '/support/equipment-support',
        },
        { status: 409 }
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

    // Tell the desk AND whoever owns the ticket. The shared mailbox on its own
    // is how a customer reply gets seen by everyone and actioned by nobody; the
    // owner's own inbox is what makes it somebody's job. Unassigned tickets fall
    // back to the desk alone, which is why the desk is never dropped.
    //
    // Awaited so Vercel cannot kill the function mid-send, but a mail failure
    // never fails the request — the message is already on the ticket and visible
    // in /admin/tickets either way.
    // ── Reopen, if this landed on a closed ticket ──
    // Inside the window a reply puts the ticket back to OPEN rather than leaving
    // it closed with a message hanging off it — which is what used to happen, and
    // meant the reply was invisible in every queue view.
    //
    // Back to `open`, not `in_progress`: it is work that needs triage, and it
    // should surface in Open/Unassigned rather than looking like something
    // already in hand. The owner is deliberately KEPT, so the ticket stays with
    // whoever knows it and no assignment alert re-fires.
    //
    // ⚠️ The audit row is not decoration — lib/ticket-history.ts derives the whole
    // lifecycle (close time, reopen count, and therefore the 30-day gate itself)
    // from these rows. Skip it and this ticket's next reopen check reads the
    // ORIGINAL close date.
    const wasClosed = ticket.status === 'closed'
    if (wasClosed) {
      const { error: reopenErr } = await supabaseAdmin
        .from('tickets')
        .update({ status: 'open' })
        .eq('id', ticket.id)

      if (reopenErr) {
        console.error('[status/message] reopen failed:', reopenErr)
      } else {
        await logAudit({
          actor: { id: null, name: ticket.customer_name || 'Customer' },
          action: 'ticket.status',
          entityType: 'ticket',
          entityId: ticket.id,
          summary: `Ticket ${ticket.ticket_number} reopened by the customer`,
          metadata: { from: 'closed', to: 'open', via: 'status-page-reply' },
        })
      }
    }

    // ── The customer answered a ticket we were waiting on ──
    // This is the half of the waiting feature that makes it safe to automate the
    // other half: the moment they reply, the 14-day auto-resolve clock has to
    // stop. Without this a customer could answer on day 8 and still have their
    // ticket resolved out from under them on day 14.
    //
    // Back to `in_progress`, NOT `open` like a reopen above: nobody needs to
    // triage this. Someone was already working it, chose to park it, and now has
    // their answer — it goes back to being their live work. The owner is kept for
    // the same reason.
    //
    // ⚠️ The audit row is what clears `waitingSince` in lib/ticket-history.ts and
    // what makes the sweep's "already chased" check start over if it is ever
    // parked again. Skipping it would leave the ticket looking like it had been
    // waiting since the original park.
    const wasWaiting = ticket.status === WAITING_STATUS
    if (wasWaiting) {
      const { error: resumeErr } = await supabaseAdmin
        .from('tickets')
        .update({ status: 'in_progress' })
        .eq('id', ticket.id)
        // Only if it is still waiting — do not stamp on top of a status somebody
        // changed while this request was in flight.
        .eq('status', WAITING_STATUS)

      if (resumeErr) {
        console.error('[status/message] resume from waiting failed:', resumeErr)
      } else {
        await logAudit({
          actor: { id: null, name: ticket.customer_name || 'Customer' },
          action: 'ticket.status',
          entityType: 'ticket',
          entityId: ticket.id,
          summary: `Ticket ${ticket.ticket_number} — the customer replied, no longer waiting on them`,
          metadata: { from: WAITING_STATUS, to: 'in_progress', via: 'status-page-reply' },
        })
      }
    }

    // Tell the desk AND whoever owns the ticket. The shared mailbox on its own
    // is how a customer reply gets seen by everyone and actioned by nobody; the
    // owner's own inbox is what makes it somebody's job. Unassigned tickets fall
    // back to the desk alone, which is why the desk is never dropped.
    //
    // Awaited so Vercel cannot kill the function mid-send, but a mail failure
    // never fails the request — the message is already on the ticket and visible
    // in /admin/tickets either way.
    const recipients = await ticketAlertRecipients(ticket.owner_id)
    if (recipients.length) {
      const send = wasClosed
        ? sendTicketReopenedAlert(
            {
              ticket_number: ticket.ticket_number,
              ticketId: ticket.id,
              customer_name: ticket.customer_name,
              message,
              closedAt: reopen.closedAt ?? null,
            },
            recipients,
          )
        : sendCustomerMessageAlert(
            { ticket_number: ticket.ticket_number, customer_name: ticket.customer_name, message, ticketId: ticket.id },
            recipients,
          )
      await send.catch(err => console.error('[status/message] desk alert failed:', err))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[status/message] route error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
