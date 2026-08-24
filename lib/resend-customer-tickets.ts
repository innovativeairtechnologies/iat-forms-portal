import { Resend } from 'resend'
import type { Ticket } from './supabase'
import { EMAIL_FROM } from './email-from'

// ─────────────────────────────────────────────────────────────────────────────
// Customer-facing ticket email (SHIPPED INERT — off by default).
//
// These are the two customer notifications requested 2026-08-12: a confirmation
// when a ticket is created, and a copy of an admin's "Reply to customer" note.
// A customer confirmation used to exist and was deliberately removed 2026-08-03
// ("the desk contacts the customer, not the app"); the owner has since asked to
// bring it back, but ONLY once the email domain work is finished — so it ships
// dormant behind a single switch and changes nothing until that switch is on.
//
//   CUSTOMER_TICKET_EMAILS = "on"   → these emails send
//   (unset / anything else)         → every function below is a no-op
//
// With the switch unset, nothing sends, no extra DB read happens, and the portal
// UX for both the customer submitting a ticket and the admin reviewing it is
// byte-for-byte identical to today. Turn it on ONLY after the domain is verified
// in Resend and RESEND_FROM_SUPPORT is set in Vercel (otherwise mail would go out
// from the onboarding@resend.dev sandbox, which only reaches the account owner).
// ─────────────────────────────────────────────────────────────────────────────

export function customerTicketEmailsEnabled(): boolean {
  return process.env.CUSTOMER_TICKET_EMAILS === 'on'
}

const resend = new Resend(process.env.RESEND_API_KEY)
// PORTAL (noreply@), never SUPPORT (iatsupport@). Customer-facing mail must not
// invite a reply: an emailed reply lands in a mailbox, not on the ticket, and the
// thread fragments across two places nobody reconciles. Every one of these emails
// tells the customer not to reply and links them back into the portal instead.
const FROM = EMAIL_FROM.PORTAL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

/** Deep link to the status page with the reference prefilled. The customer still
 *  has to supply the email the ticket was raised with before anything is shown. */
function portalLink(reference: string) {
  return `${APP_URL}/support/status?ticket=${encodeURIComponent(reference)}`
}

/** The call to action that replaces "just reply to this email". */
function replyBlock(reference: string, verb: string) {
  return `
    <div style="background:#f0faf4;border:1px solid rgba(8,148,71,0.25);border-radius:10px;padding:18px 20px;margin:24px 0 0;">
      <p style="margin:0 0 12px;color:#333;font-size:14px;line-height:1.6;">
        Need to add something, or ${esc(verb)}? Use the link below. It keeps everything on your ticket
        where our team will see it.
      </p>
      <a href="${esc(portalLink(reference))}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">View your ticket &amp; send a message</a>
    </div>
    <p style="margin:18px 0 0;color:#999;font-size:12px;line-height:1.5;">
      Please do not reply to this email. It is sent from an unmonitored address and replies are not read.
    </p>`
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function shell(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
  <tr><td style="background:#1a1a2e;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Innovative Air Technologies</p>
    <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">${title}</h1>
  </td></tr>
  <tr><td style="padding:28px 32px;">${body}</td></tr>
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Technical Support · Please keep the ticket number in your subject line so replies stay together.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function ticketChip(ticketNumber: string) {
  return `<div style="background:#f0faf4;border:1px solid rgba(8,148,71,0.25);border-radius:10px;padding:12px 20px;margin-bottom:20px;display:inline-block;">
    <p style="margin:0;color:#888;font-size:11px;">Ticket number</p>
    <p style="margin:2px 0 0;color:#089447;font-size:19px;font-weight:700;font-family:monospace;letter-spacing:1px;">${esc(ticketNumber)}</p>
  </div>`
}

function aiRecsBlock(recs: string[] | null) {
  if (!recs?.length) return ''
  return `
    <p style="margin:24px 0 8px;font-weight:600;color:#333;font-size:14px;">💡 While you wait, a few things worth checking:</p>
    <ol style="margin:0 0 6px;padding-left:20px;color:#555;font-size:14px;line-height:1.6;">
      ${recs.map(r => `<li style="margin-bottom:6px;">${esc(r)}</li>`).join('')}
    </ol>
    <p style="margin:0;color:#999;font-size:12px;">These are automated suggestions. If you're unsure, wait for your service technician.</p>`
}

// ── Confirmation to the customer when a ticket is created ─────────────────────
export async function sendTicketConfirmationToCustomer(ticket: Ticket): Promise<void> {
  if (!customerTicketEmailsEnabled()) return
  if (!ticket.customer_email) return

  const greeting = ticket.customer_name ? `Hi ${esc(ticket.customer_name)},` : 'Hello,'
  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;">
      Thanks for reaching out to Innovative Air Technologies support. We've logged your request and our
      team will follow up. Please keep the ticket number below for your records.
    </p>
    ${ticketChip(ticket.ticket_number)}
    ${ticket.problem_description ? `
    <p style="margin:8px 0 6px;color:#333;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">What you told us</p>
    <p style="margin:0 0 4px;color:#555;font-size:15px;line-height:1.55;white-space:pre-wrap;">${esc(ticket.problem_description)}</p>` : ''}
    ${aiRecsBlock(ticket.ai_recommendations)}
    ${replyBlock(ticket.ticket_number, 'have a question')}`

  const result = await resend.emails.send({
    from: FROM,
    to: ticket.customer_email,
    subject: `We've received your request: ticket ${ticket.ticket_number}`,
    html: shell('Support Request Received', body),
  })
  if (result.error) console.error(`[resend] customer ticket confirmation failed to ${ticket.customer_email}:`, result.error)
  else console.log(`[resend] customer ticket confirmation sent to ${ticket.customer_email}: id=${result.data?.id}`)
}

// ── Status moved ──────────────────────────────────────────────────────────────
// Every move except into a terminal state, which gets the richer close email
// below instead. Deliberately short: the customer asked for their unit fixed,
// not for a workflow diary, so this says what changed and offers the link.
const STATUS_WORDS: Record<string, { label: string; blurb: string }> = {
  open:        { label: 'Received',    blurb: 'Your ticket is in the queue and waiting to be picked up.' },
  in_progress: { label: 'In Progress', blurb: 'An IAT engineer has started work on your ticket.' },
  // The one status whose whole purpose is to prompt the customer, so it asks
  // rather than reports. The chase emails that follow (7 days, then 24 hours out)
  // come from lib/ticket-waiting.ts; this is the first thing they hear.
  waiting_on_customer: {
    label: 'Waiting on You',
    blurb: 'We need something from you before we can carry on — use the link below to reply.',
  },
  resolved:    { label: 'Resolved',    blurb: 'Your ticket has been marked resolved.' },
  closed:      { label: 'Closed',      blurb: 'Your ticket has been closed.' },
}

export async function sendTicketStatusChangeToCustomer(
  ticket: Pick<Ticket, 'ticket_number' | 'customer_name' | 'customer_email'>,
  to: string,
): Promise<void> {
  if (!customerTicketEmailsEnabled()) return
  if (!ticket.customer_email) return

  const words = STATUS_WORDS[to]
  // An unknown status would produce an email saying nothing. Better to send
  // nothing than to tell a customer their ticket is now "undefined".
  if (!words) {
    console.warn(`[resend] status-change email skipped — unknown status "${to}"`)
    return
  }

  const greeting = ticket.customer_name ? `Hi ${esc(ticket.customer_name)},` : 'Hello,'
  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6;">
      There is an update on your support ticket. It is now
      <strong>${esc(words.label)}</strong>: ${esc(words.blurb)}
    </p>
    ${ticketChip(ticket.ticket_number)}
    ${replyBlock(ticket.ticket_number, 'have a question')}`

  const result = await resend.emails.send({
    from: FROM,
    to: ticket.customer_email,
    subject: `Your IAT ticket ${ticket.ticket_number} is now ${words.label}`,
    html: shell('Ticket Update', body),
  })
  if (result.error) console.error(`[resend] status change failed to ${ticket.customer_email}:`, result.error)
  else console.log(`[resend] status change (${to}) sent to ${ticket.customer_email}: id=${result.data?.id}`)
}

// ── Closed, with the closing remarks ──────────────────────────────────────────
// The one email on this ticket a customer is most likely to keep. It carries the
// engineer's own words rather than a status word, because "Resolved" on its own
// tells someone whose equipment was broken nothing about what was done to it.
//
// `remarks` is the plain text the closing employee typed — escaped here, never
// treated as markup.
/**
 * ⚠️ `shareNotes` decides whether the customer sees the engineer's closing
 * remarks, and it is REQUIRED rather than defaulted for a reason.
 *
 * Until 2026-08-24 the remarks were always sent verbatim, which made the field a
 * trap: it is the internal record of what was actually wrong and what was done,
 * and it can contain a diagnosis, a commercial note or a candid assessment that
 * is entirely correct internally and wrong to put in front of the customer. The
 * person closing the ticket now chooses, per ticket, in a confirmation dialog —
 * and the default there is NOT to send them.
 *
 * There is no default here on purpose: a new caller must state its intent, so
 * this can never quietly go back to leaking notes.
 *
 * When false, the resolution reason is withheld too — it is one of fifteen fixed
 * phrases chosen for internal reporting ("Replacement part installed"), which is
 * the same category of internal vocabulary and tells the customer nothing useful.
 */
export async function sendTicketClosedToCustomer(
  ticket: Pick<Ticket, 'ticket_number' | 'customer_name' | 'customer_email'>,
  remarks: string,
  status: 'resolved' | 'closed',
  shareNotes: boolean,
  resolvedReason?: string | null,
): Promise<void> {
  if (!customerTicketEmailsEnabled()) return
  if (!ticket.customer_email) return

  const greeting = ticket.customer_name ? `Hi ${esc(ticket.customer_name)},` : 'Hello,'
  const word = status === 'resolved' ? 'resolved' : 'closed'

  // The notes block, and the lead-in that promises it, appear together or not at
  // all — a "here is what our engineer recorded" with nothing under it would read
  // as a broken email.
  const notesBlock = shareNotes
    ? `<p style="margin:8px 0 6px;color:#333;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Closing notes</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;margin-bottom:18px;">
      <tr><td style="padding:16px 20px;color:#333;font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(remarks)}</td></tr>
    </table>
    ${resolvedReason ? `<p style="margin:0 0 18px;color:#777;font-size:13px;">Resolution: ${esc(resolvedReason)}</p>` : ''}`
    : ''

  const lead = shareNotes
    ? `Your support ticket has been <strong>${esc(word)}</strong>. Here is what our engineer recorded:`
    : `Your support ticket has been <strong>${esc(word)}</strong>. Thank you for working through it with us.`

  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6;">
      ${lead}
    </p>
    ${ticketChip(ticket.ticket_number)}
    ${notesBlock}
    <p style="margin:0 0 4px;color:#555;font-size:14px;line-height:1.6;">
      ${shareNotes
        ? `If this is not fixed, or the problem comes back, use the link below and tell us. It reopens
           the conversation on the same ticket rather than starting again from scratch.`
        : `If the problem comes back, or you have any questions about what was done, use the link
           below and tell us. It reopens the conversation on the same ticket rather than starting
           again from scratch, and we are happy to talk through the details.`}
    </p>
    ${replyBlock(ticket.ticket_number, 'need to reopen this')}`

  const result = await resend.emails.send({
    from: FROM,
    to: ticket.customer_email,
    subject: `Your IAT support ticket ${ticket.ticket_number} has been ${word}`,
    html: shell(status === 'resolved' ? 'Ticket Resolved' : 'Ticket Closed', body),
  })
  if (result.error) console.error(`[resend] close email failed to ${ticket.customer_email}:`, result.error)
  else console.log(`[resend] close email sent to ${ticket.customer_email}: id=${result.data?.id}`)
}

// ── A copy of an admin's "Reply to customer" note ─────────────────────────────
// `replyHtml` is the note content already sanitized by the notes route
// (sanitizeNoteHtml) before storage, so it is safe to embed here.
export async function sendTicketReplyToCustomer(
  ticket: Pick<Ticket, 'ticket_number' | 'customer_name' | 'customer_email' | 'brand'>,
  replyHtml: string,
): Promise<void> {
  if (!customerTicketEmailsEnabled()) return
  if (!ticket.customer_email) return

  const greeting = ticket.customer_name ? `Hi ${esc(ticket.customer_name)},` : 'Hello,'
  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 18px;color:#333;font-size:15px;">
      Our team added an update to your support ticket <strong>${esc(ticket.ticket_number)}</strong>:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;color:#333;font-size:15px;line-height:1.6;">${replyHtml}</td></tr>
    </table>
    ${replyBlock(ticket.ticket_number, 'want to respond')}`

  const result = await resend.emails.send({
    from: FROM,
    to: ticket.customer_email,
    subject: `Update on your IAT support ticket ${ticket.ticket_number}`,
    html: shell('Ticket Update', body),
  })
  if (result.error) console.error(`[resend] customer ticket reply failed to ${ticket.customer_email}:`, result.error)
  else console.log(`[resend] customer ticket reply sent to ${ticket.customer_email}: id=${result.data?.id}`)
}

// ── Chasing a customer we are waiting on ──────────────────────────────────────
//
// Both of these are sent by the waiting sweep (lib/ticket-waiting.ts) to a ticket
// parked in `waiting_on_customer`. They are the ONLY automated mail a customer
// gets while a ticket is open, so they stay short and say exactly what happens
// next — a chaser that does not name a deadline gets ignored, and one that
// threatens without a way back is worse than silence.
//
// ⚠️ Neither mentions the closing notes or any internal detail. A customer being
// chased has not been told anything about the diagnosis and must not be here.

/** Day 7 of silence: a nudge, naming the date the ticket closes itself. */
export async function sendWaitingNudgeToCustomer(
  ticket: Pick<Ticket, 'ticket_number' | 'customer_name' | 'customer_email'>,
  closesOn: string,
): Promise<void> {
  if (!customerTicketEmailsEnabled()) return
  if (!ticket.customer_email) return

  const greeting = ticket.customer_name ? `Hi ${esc(ticket.customer_name)},` : 'Hello,'
  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6;">
      We are still waiting to hear back from you on your support ticket, so it has not moved
      forward on our side.
    </p>
    ${ticketChip(ticket.ticket_number)}
    <p style="margin:0 0 4px;color:#555;font-size:14px;line-height:1.6;">
      If you still need help, reply using the link below and we will pick it straight back up.
      If we do not hear from you, this ticket will close automatically on
      <strong>${esc(closesOn)}</strong> — you can always open a new one later.
    </p>
    ${replyBlock(ticket.ticket_number, 'want to carry on')}`

  const result = await resend.emails.send({
    from: FROM,
    to: ticket.customer_email,
    subject: `Still waiting on you — IAT support ticket ${ticket.ticket_number}`,
    html: shell('Waiting on You', body),
  })
  if (result.error) console.error(`[resend] waiting nudge failed to ${ticket.customer_email}:`, result.error)
  else console.log(`[resend] waiting nudge sent to ${ticket.customer_email}: id=${result.data?.id}`)
}

/** 24 hours before the auto-resolve. Last chance, and says so plainly. */
export async function sendWaitingFinalWarningToCustomer(
  ticket: Pick<Ticket, 'ticket_number' | 'customer_name' | 'customer_email'>,
): Promise<void> {
  if (!customerTicketEmailsEnabled()) return
  if (!ticket.customer_email) return

  const greeting = ticket.customer_name ? `Hi ${esc(ticket.customer_name)},` : 'Hello,'
  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6;">
      We have not heard back about your support ticket, so it will be closed
      <strong>tomorrow</strong> — about 24 hours from now.
    </p>
    ${ticketChip(ticket.ticket_number)}
    <p style="margin:0 0 4px;color:#555;font-size:14px;line-height:1.6;">
      If the problem is sorted, there is nothing to do; the ticket will close itself. If you do
      still need us, reply using the link below today and it stays open.
    </p>
    ${replyBlock(ticket.ticket_number, 'still need help')}`

  const result = await resend.emails.send({
    from: FROM,
    to: ticket.customer_email,
    subject: `Closing tomorrow — IAT support ticket ${ticket.ticket_number}`,
    html: shell('Closing Tomorrow', body),
  })
  if (result.error) console.error(`[resend] waiting final warning failed to ${ticket.customer_email}:`, result.error)
  else console.log(`[resend] waiting final warning sent to ${ticket.customer_email}: id=${result.data?.id}`)
}
