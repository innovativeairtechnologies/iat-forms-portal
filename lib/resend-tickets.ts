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

// ── Customer confirmation on ticket creation ──────────────────────────────────
export async function sendTicketConfirmationToCustomer(ticket: Ticket) {
  const statusUrl = `${APP_URL}/support/status?ticket=${encodeURIComponent(ticket.ticket_number)}`

  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi ${esc(ticket.customer_name)},</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;">
      We've received your support ticket. An IAT engineer will review your details and reach out within <strong>1 business day</strong>.
    </p>
    ${ticketChip(ticket.ticket_number)}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:4px;">
      ${row('Serial #', esc(ticket.serial_number))}
      ${row('Model #', esc(ticket.model_number))}
      ${row('Reported issue', esc(ticket.problem_description))}
    </table>
    ${aiRecsBlock(ticket.ai_recommendations)}
    <a href="${esc(statusUrl)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-top:20px;">Check Ticket Status</a>
    <p style="margin:10px 0 0;color:#999;font-size:12px;">You'll need this email address (${esc(ticket.customer_email)}) to look up your ticket.</p>
    <p style="margin:14px 0 0;color:#666;font-size:13px;line-height:1.5;">Want to track all your equipment and requests in one place? Check your ticket status above, then look for <strong>&ldquo;Request portal access&rdquo;</strong> once you've confirmed your details.</p>`

  const result = await resend.emails.send({
    from: FROM,
    to: ticket.customer_email,
    subject: `IAT Support — Ticket ${ticket.ticket_number} received`,
    html: shell('#1a1a2e', 'Ticket Received', body),
  })
  if (result.error) console.error(`[resend] ticket confirmation failed to ${ticket.customer_email}:`, result.error)
  else console.log(`[resend] ticket confirmation sent to ${ticket.customer_email}: id=${result.data?.id}`)
}

// ── Staff notification on new ticket ──────────────────────────────────────────
export async function sendTicketNotificationToAdmins(ticket: Ticket, adminEmails: string[]) {
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
    adminEmails.map((to) =>
      resend.emails.send({ from: FROM, to, subject, html: shell('#1a1a2e', 'New Support Ticket', body) })
    )
  )
  results.forEach((r, i) => {
    if (r.error) console.error(`[resend] ticket notification failed to ${adminEmails[i]}:`, r.error)
    else console.log(`[resend] ticket notification sent to ${adminEmails[i]}: id=${r.data?.id}`)
  })
}
