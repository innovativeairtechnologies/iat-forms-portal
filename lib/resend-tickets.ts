import { Resend } from 'resend'
import type { Ticket } from './supabase'
import { EMAIL_FROM } from './email-from'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = EMAIL_FROM.SUPPORT
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function shell(headerBg: string, title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
  <tr><td style="background:${headerBg};padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Innovative Air Technologies</p>
    <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">${title}</h1>
  </td></tr>
  <tr><td style="padding:28px 32px;">${body}</td></tr>
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Support · Automated notification</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function row(label: string, value: string) {
  return `<tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;width:35%;vertical-align:top;">${label}</td><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#555;vertical-align:top;">${value}</td></tr>`
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
    <p style="margin:24px 0 8px;font-weight:600;color:#333;font-size:14px;">💡 While you wait, try these steps:</p>
    <ol style="margin:0 0 6px;padding-left:20px;color:#555;font-size:14px;line-height:1.6;">
      ${recs.map(r => `<li style="margin-bottom:6px;">${esc(r)}</li>`).join('')}
    </ol>
    <p style="margin:0;color:#999;font-size:12px;">These are AI-generated suggestions — if you're unsure, wait for your service technician.</p>`
}

// ── Support-desk notification on new ticket ───────────────────────────────────
// The support-desk heads-up. A customer confirmation was removed 2026-08-03, then
// reinstated 2026-08-12 as an INERT, switch-gated path — see
// sendTicketConfirmationToCustomer in lib/resend-customer-tickets.ts (no-op unless
// CUSTOMER_TICKET_EMAILS === "on"). This function is unchanged and still desk-only.
export async function sendTicketNotificationToSupportDesk(ticket: Ticket, recipients: string[]) {
  const ticketUrl = `${APP_URL}/admin/tickets/${ticket.id}`

  const body = `
    ${ticketChip(ticket.ticket_number)}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:4px;">
      ${row('Customer', esc(ticket.customer_name))}
      ${ticket.customer_company ? row('Company', esc(ticket.customer_company)) : ''}
      ${row('Email', esc(ticket.customer_email))}
      ${ticket.customer_phone ? row('Phone', esc(ticket.customer_phone)) : ''}
      ${row('Serial #', esc(ticket.serial_number))}
      ${row('Model #', esc(ticket.model_number))}
      ${row('Voltage', esc(ticket.voltage))}
      ${row('Problem', esc(ticket.problem_description))}
    </table>
    ${aiRecsBlock(ticket.ai_recommendations)}
    <a href="${esc(ticketUrl)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-top:20px;">View Ticket in Admin Portal</a>`

  const subject = `New Support Ticket ${ticket.ticket_number} — ${ticket.customer_name}${ticket.customer_company ? ` (${ticket.customer_company})` : ''}`

  const results = await Promise.all(
    recipients.map((to) =>
      resend.emails.send({ from: FROM, to, subject, html: shell('#1a1a2e', 'New Support Ticket', body) })
    )
  )
  results.forEach((r, i) => {
    if (r.error) console.error(`[resend] ticket notification failed to ${recipients[i]}:`, r.error)
    else console.log(`[resend] ticket notification sent to ${recipients[i]}: id=${r.data?.id}`)
  })
}

// ── Desk alert when a customer writes back via /support/status ────────────────
// Anonymous customers can add a message to their own ticket (proving ownership
// with the ticket number + the email it was raised with — see
// app/api/tickets/status/message/route.ts). Without this alert their reply would
// land silently in the thread and nobody would know to look, which is exactly
// the failure mode the whole no-reply redesign exists to prevent.
export async function sendCustomerMessageAlert(
  args: { ticket_number: string; customer_name: string | null; message: string },
  recipients: string[],
) {
  const { ticket_number, customer_name, message } = args
  const url = `${APP_URL}/admin/tickets`

  const body = `
    ${ticketChip(ticket_number)}
    <p style="margin:8px 0 6px;color:#333;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">
      ${esc(customer_name || 'The customer')} added a message
    </p>
    <div style="background:#f8f9fa;border-left:3px solid #089447;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 20px;">
      <p style="margin:0;color:#333;font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(message)}</p>
    </div>
    <p style="margin:0 0 18px;color:#555;font-size:14px;line-height:1.6;">
      It is already on the ticket thread. Reply from the ticket so the whole conversation stays in one place.
    </p>
    <a href="${esc(url)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Open the ticket queue</a>`

  const results = await Promise.all(
    recipients.map(to => resend.emails.send({
      from: FROM,
      to,
      subject: `Customer reply on ${ticket_number}${customer_name ? ` — ${customer_name}` : ''}`,
      html: shell('#1a1a2e', 'Customer Reply', body),
    }))
  )
  results.forEach((r, i) => {
    if (r.error) console.error(`[resend] customer message alert failed to ${recipients[i]}:`, r.error)
    else console.log(`[resend] customer message alert sent to ${recipients[i]}: id=${r.data?.id}`)
  })
}

// ── Desk alert when a CUSTOMER says their ticket is fixed ─────────────────────
// A customer marking their own ticket resolved does NOT close it — it raises a
// hand. IAT confirms the fix and closes it formally, because "it seems fine now"
// and "the fault is gone" are different claims, and only one of them belongs in
// the record. The ticket therefore stays live and assigned until a person here
// agrees, and this email is what starts that check.
export async function sendCustomerResolvedAlert(
  args: { ticket_number: string; customer_name: string | null; note: string; ticketId: string },
  recipients: string[],
) {
  const { ticket_number, customer_name, note, ticketId } = args
  const url = `${APP_URL}/admin/tickets/${ticketId}`

  const body = `
    ${ticketChip(ticket_number)}
    <p style="margin:8px 0 6px;color:#333;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">
      ${esc(customer_name || 'The customer')} says this is resolved
    </p>
    <div style="background:#f8f9fa;border-left:3px solid #089447;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 20px;">
      <p style="margin:0;color:#333;font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(note)}</p>
    </div>
    <p style="margin:0 0 18px;color:#555;font-size:14px;line-height:1.6;">
      <strong>The ticket is still open.</strong> Confirm what they describe actually matches a fixed
      unit, then close it here — their word starts the check, it does not end it.
    </p>
    <a href="${esc(url)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Review and close the ticket</a>`

  const results = await Promise.all(
    recipients.map(to => resend.emails.send({
      from: FROM,
      to,
      subject: `Verify before closing: ${ticket_number}${customer_name ? ` — ${customer_name}` : ''}`,
      html: shell('#1a1a2e', 'Customer Marked Resolved', body),
    }))
  )
  results.forEach((r, i) => {
    if (r.error) console.error(`[resend] customer resolved alert failed to ${recipients[i]}:`, r.error)
    else console.log(`[resend] customer resolved alert sent to ${recipients[i]}: id=${r.data?.id}`)
  })
}
