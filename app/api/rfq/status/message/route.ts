import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { sendRfqCustomerMessageAlert, deskRecipients } from '@/lib/resend-rfq-reminders'

/* Lets a customer who is NOT signed in add a message to their own quote request.

   The ticket twin of this (app/api/tickets/status/message) exists because the
   confirmation emails tell customers not to reply, and telling someone not to
   reply while giving them nowhere to write is worse than the mailbox it
   replaced. The RFQ confirmation said exactly that and had no write path, so its
   button was reworded to stop promising one. This restores the promise properly,
   and the wording goes back with it.

   ── How a stranger is allowed to write to a quote request ───────────────────
   Ownership is proved the same way the status lookup proves it: the REFERENCE
   plus the EMAIL the survey was submitted with must both match one row. The
   reference alone is sequential and therefore guessable; the pair is not, and it
   is exactly what the customer already had to supply to see the request at all.

   Hardening on top of that, because this is a public write — identical posture
   to the ticket endpoint, for identical reasons:
     • reCAPTCHA fail-CLOSED at minScore 0.7, stricter than every other public
       endpoint (see the block below)
     • a tight rate limit — this writes a row and sends mail
     • author_type/author_name are hardcoded, never read from the body, so a
       crafted request cannot post a note that reads as staff
     • the note is attached to the row the pair resolves to, so a caller cannot
       aim a message at some other request's id

   ── Plain text, NOT html ────────────────────────────────────────────────────
   rfq_notes.body is rendered with `whitespace-pre-wrap` in TriageCard, i.e. as
   TEXT. The ticket endpoint escapes to HTML because ticket_notes.content is
   rendered as markup. Storing HTML here would show the customer's message with
   visible <p> tags. Do not copy toSafeHtml() across. */

const MAX_MESSAGE = 4000

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, c => `\\${c}`)
}

export async function POST(req: NextRequest) {
  // Tighter than the status lookup (20): this one writes a row and sends mail.
  const limited = await rateLimit(req, { name: 'rfq-status-message', max: 8, windowSeconds: 600 })
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
    // nobody notices. A customer blocked here still has the phone.
    //
    // minScore 0.7 rather than the 0.5 default: the credential this protects is a
    // guessable pair (a sequential reference plus an often-public email), so the
    // bar for automation should be higher than for a first-time submission.
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, 'rfq_message', {
      failClosed: true,
      minScore: 0.7,
    })
    if (!recaptcha.ok) {
      console.warn('[rfq/status/message] reCAPTCHA check failed:', recaptcha.reason)
      return NextResponse.json({ error: 'Please try again.' }, { status: 400 })
    }

    const reference = String(body.ticket_number ?? body.reference ?? '').trim()
    const email = String(body.email ?? '').trim()
    const message = String(body.message ?? '').trim().slice(0, MAX_MESSAGE)

    if (!reference || !email) {
      return NextResponse.json({ error: 'Reference number and email are both required.' }, { status: 400 })
    }
    if (!message) {
      return NextResponse.json({ error: 'Please write a message before sending.' }, { status: 400 })
    }

    // The ownership check. Same escaping as the status route so a wildcard in
    // either field cannot be used to walk other people's requests.
    const { data: rfq } = await supabaseAdmin
      .from('rfq_requests')
      .select('id, reference, company, contact_name, assignee_id')
      .ilike('reference', escapeLike(reference))
      .ilike('email', escapeLike(email))
      .maybeSingle()

    if (!rfq) {
      return NextResponse.json(
        { error: 'No request found matching that reference and email. Double-check both and try again.' },
        { status: 404 }
      )
    }

    // author_type is hardcoded, NOT taken from the body — a customer message is
    // always attributed to the customer. author_name is a snapshot of the contact
    // on the survey, matching how staff notes snapshot their author (088).
    const insert: Record<string, unknown> = {
      rfq_id: rfq.id,
      body: message,
      author_type: 'customer',
      author_name: rfq.contact_name || 'Customer',
    }

    let { error } = await supabaseAdmin.from('rfq_notes').insert(insert)

    // Migration 089 not applied → author_type absent. Save the message rather
    // than lose it; it will read as a staff note until the column lands, which
    // is worse than a badge and far better than a customer being told their
    // message failed. Same fallback shape as the ticket endpoint uses for 054.
    if (error && (error.code === 'PGRST204' || error.code === '42703')) {
      console.warn('[rfq/status/message] migration 089 not applied — saving without author_type:', error.message)
      const { author_type, ...withoutType } = insert
      void author_type
      ;({ error } = await supabaseAdmin.from('rfq_notes').insert(withoutType))
    }

    if (error) {
      console.error('[rfq/status/message] insert failed:', error)
      return NextResponse.json({ error: 'We could not save your message. Please try again.' }, { status: 500 })
    }

    // Touch the parent so the queue's "updated" reflects the activity — same as
    // the admin notes route. A customer writing in is exactly the kind of thing
    // that should move a request up a list sorted by recency.
    await supabaseAdmin
      .from('rfq_requests')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', rfq.id)

    // Tell whoever owns it. The assignee when there is one, the shared desk when
    // there is not — never both; see sendRfqCustomerMessageAlert. Awaited so
    // Vercel cannot kill the function mid-send, but a mail failure never fails
    // the request: the message is already on the trail and visible in /admin/rfq.
    let recipients: string[] = []
    if (rfq.assignee_id) {
      const { data: owner } = await supabaseAdmin
        .from('employees')
        .select('email')
        .eq('id', rfq.assignee_id)
        // is_active, matching the assignment notice: someone who has left still
        // owns the row historically, but mailing their dead address is how a
        // customer's message goes to nobody.
        .eq('is_active', true)
        .maybeSingle()
      if (owner?.email) recipients = [owner.email]
    }
    // No owner, or an owner with no working address — the desk still has to hear
    // about it, or the message lands in a queue nobody is watching.
    if (!recipients.length) recipients = deskRecipients()

    await sendRfqCustomerMessageAlert(
      {
        id: rfq.id,
        reference: rfq.reference,
        company: rfq.company ?? '',
        contactName: rfq.contact_name ?? '',
        message,
      },
      recipients,
    ).catch(err => console.error('[rfq/status/message] desk alert failed:', err))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[rfq/status/message] route error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
