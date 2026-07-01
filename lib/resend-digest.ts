import { Resend } from 'resend'
import type { DigestTicket } from '@/lib/admin-digest'

// Internal admin email (daily digest + on-demand test-send). Kept separate
// from resend-customer.ts, which is scoped to customer-facing emails.
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'IAT Portal <onboarding@resend.dev>'

// Same derivation pattern as lib/resend-tickets.ts / resend-pto.ts: this cron
// route has no incoming request to read an origin from, so we fall back to
// the deployed prod URL if NEXT_PUBLIC_APP_URL isn't set.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

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
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Portal · Automated daily digest</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function ticketList(tickets: DigestTicket[], emptyText: string): string {
  if (!tickets.length) {
    return `<p style="margin:0 0 20px;color:#999;font-size:13px;">${esc(emptyText)}</p>`
  }
  const rows = tickets.map(t => {
    const url = `${APP_URL}/admin/tickets/${t.id}`
    return `<tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;vertical-align:top;width:30%;">
        <a href="${esc(url)}" style="color:#089447;font-weight:600;font-family:monospace;text-decoration:none;">${esc(t.ticket_number)}</a>
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#555;vertical-align:top;">
        ${t.customer_company ? `<strong style="color:#333;">${esc(t.customer_company)}</strong><br/>` : ''}
        <span style="font-size:13px;">${esc(t.problem_description).slice(0, 140)}${t.problem_description.length > 140 ? '…' : ''}</span>
      </td>
    </tr>`
  }).join('')

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px;">${rows}</table>`
}

export type DigestEmailOpts = {
  to: string
  adminName: string
  briefing: string
  assignedTickets: DigestTicket[]
  agingTickets: DigestTicket[]
  overdueTickets: DigestTicket[]
}

/** Sends one admin's daily digest email: the shared AI briefing paragraph,
 *  tickets recently assigned to them, and their aging/overdue open tickets. */
export async function sendAdminDigestEmail(opts: DigestEmailOpts) {
  const { to, adminName, briefing, assignedTickets, agingTickets, overdueTickets } = opts
  const dashboardUrl = `${APP_URL}/admin`

  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi ${esc(adminName)},</p>

    <div style="background:#f0faf4;border:1px solid rgba(8,148,71,0.2);border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;color:#089447;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">Today's Briefing</p>
      <p style="margin:0;color:#333;font-size:14px;line-height:1.6;">${esc(briefing)}</p>
    </div>

    <p style="margin:0 0 8px;color:#333;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Newly Assigned to You</p>
    ${ticketList(assignedTickets, 'No new tickets assigned to you in the last 24 hours.')}

    <p style="margin:0 0 8px;color:#333;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Needs Attention — Aging (3+ days)</p>
    ${ticketList(agingTickets, 'No aging tickets on your queue.')}

    <p style="margin:0 0 8px;color:#c0392b;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Needs Attention — Overdue (7+ days)</p>
    ${ticketList(overdueTickets, 'No overdue tickets on your queue.')}

    <a href="${esc(dashboardUrl)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-top:4px;">Open Admin Dashboard</a>`

  const result = await resend.emails.send({
    from: FROM,
    to,
    subject: `Your daily digest — ${assignedTickets.length} new, ${overdueTickets.length} overdue`,
    html: shell('Daily Admin Digest', body),
  })
  if (result.error) console.error(`[resend] admin digest failed to ${to}:`, result.error)
  else console.log(`[resend] admin digest sent to ${to}: id=${result.data?.id}`)
  return result
}
