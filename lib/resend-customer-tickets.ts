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
const FROM = EMAIL_FROM.SUPPORT

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
    <p style="margin:0;color:#999;font-size:12px;">These are automated suggestions — if you're unsure, wait for your service technician.</p>`
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
    <p style="margin:22px 0 0;color:#333;font-size:14px;line-height:1.6;">
      You can reply directly to this email if you have anything to add — just keep ${esc(ticket.ticket_number)}
      in the subject line so it stays with your ticket.
    </p>`

  const result = await resend.emails.send({
    from: FROM,
    to: ticket.customer_email,
    subject: `We've received your request — ticket ${ticket.ticket_number}`,
    html: shell('Support Request Received', body),
  })
  if (result.error) console.error(`[resend] customer ticket confirmation failed to ${ticket.customer_email}:`, result.error)
  else console.log(`[resend] customer ticket confirmation sent to ${ticket.customer_email}: id=${result.data?.id}`)
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
    <p style="margin:0;color:#333;font-size:14px;line-height:1.6;">
      Reply directly to this email to respond — please keep ${esc(ticket.ticket_number)} in the subject line
      so your message stays with the ticket.
    </p>`

  const result = await resend.emails.send({
    from: FROM,
    to: ticket.customer_email,
    subject: `Update on your IAT support ticket ${ticket.ticket_number}`,
    html: shell('Ticket Update', body),
  })
  if (result.error) console.error(`[resend] customer ticket reply failed to ${ticket.customer_email}:`, result.error)
  else console.log(`[resend] customer ticket reply sent to ${ticket.customer_email}: id=${result.data?.id}`)
}
