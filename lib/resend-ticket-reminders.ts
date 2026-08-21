import { Resend } from 'resend'
import { EMAIL_FROM } from './email-from'

// ─── Chasing support tickets that have stalled ───────────────────────────────
//
// Two sends, both to IAT staff, both linking to one row:
//   • assignee nudge     — "you own this and nothing has happened" (cron)
//   • unclaimed reminder — "nobody has picked these up"            (cron)
//
// The leadership escalation that follows an unclaimed ticket lives in
// lib/resend-escalation.ts, because it covers quote requests too.
//
// A separate module from resend-tickets.ts on purpose: that file handles the
// mail a SUBMISSION triggers (desk heads-up, customer message alert), this one
// handles what happens to a ticket afterwards. Same split as RFQ, and for the
// same reason — different triggers, different failure modes, and a change to one
// cannot quietly alter the other.
//
// Never gated behind CUSTOMER_TICKET_EMAILS: these go to IAT staff and the
// shared desk, never to a customer, and they are the mechanism that stops a real
// support ticket going quiet.

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = EMAIL_FROM.PORTAL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

export type TicketReminderRow = {
  id: string
  ticket_number: string
  customer_name: string | null
  customer_company: string | null
  serial_number: string | null
  problem_description: string | null
  priority: string | null
  status: string
  created_at: string
  /** Newest activity on the row — a note, or the raise if there are none. */
  last_activity_at: string
}

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Same recipient chain as the ticket submission heads-up, so one env var moves both. */
export function ticketDeskRecipients(): string[] {
  const raw = process.env.SUPPORT_NOTIFICATION_EMAIL || 'iatsupport@dehumidifiers.com'
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function ageDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5))
}

function ageLabel(iso: string): string {
  const h = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 36e5))
  return h < 48 ? `${h} hours` : `${Math.floor(h / 24)} days`
}

/** One line of what the ticket is, short enough to scan in a table cell. */
function problemLine(r: TicketReminderRow): string {
  const p = (r.problem_description || '').replace(/\s+/g, ' ').trim()
  if (!p) return r.serial_number ? `S/N ${r.serial_number}` : 'No description'
  return p.length > 96 ? `${p.slice(0, 95)}…` : p
}

const TH = 'padding:8px 14px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:left;'
const TD = 'padding:10px 14px;border-top:1px solid #f0f0f0;font-size:13px;color:#555;vertical-align:top;'

const PRIORITY_CHIP: Record<string, string> = {
  high: 'background:#fdecec;color:#c0392b;',
  med: 'background:#fef6e7;color:#a06400;',
  low: 'background:#f0faf4;color:#089447;',
}

function table(rows: TicketReminderRow[], ageFrom: (r: TicketReminderRow) => string): string {
  const body = rows.map(r => `<tr>
    <td style="${TD}font-family:monospace;white-space:nowrap;">
      <a href="${esc(APP_URL)}/admin/tickets/${esc(r.id)}" style="color:#089447;text-decoration:none;">${esc(r.ticket_number)}</a>
      ${r.priority ? `<br><span style="display:inline-block;margin-top:4px;padding:1px 6px;border-radius:99px;font-size:10px;font-weight:700;text-transform:uppercase;${PRIORITY_CHIP[r.priority] ?? PRIORITY_CHIP.med}">${esc(r.priority)}</span>` : ''}
    </td>
    <td style="${TD}color:#333;">${esc(r.customer_name || '—')}${r.customer_company ? `<br><span style="color:#999;font-size:12px;">${esc(r.customer_company)}</span>` : ''}</td>
    <td style="${TD}">${esc(problemLine(r))}</td>
    <td style="${TD}white-space:nowrap;">${esc(ageFrom(r))}</td>
  </tr>`).join('')

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:18px 0;">
    <tr style="background:#f8f9fa;">
      <td style="${TH}">Ticket</td><td style="${TH}">Customer</td><td style="${TH}">The problem</td><td style="${TH}">Quiet for</td>
    </tr>${body}</table>`
}

const FOOTER = 'IAT Portal · Automated reminder. Any note on the ticket, or resolving it, stops these.'

function shell(headerBg: string, title: string, sub: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
  <tr><td style="background:${headerBg};padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Innovative Air Technologies</p>
    <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">${esc(title)}</h1>
    <p style="margin:4px 0 0;color:#cfd8d3;font-size:13px;">${esc(sub)}</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">${inner}</td></tr>
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">${esc(FOOTER)}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function cta(label: string, href: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">${esc(label)}</a>`
}

/**
 * "You own these and nothing has happened on them."
 *
 * One email per owner, not per ticket: someone with four stalled tickets has one
 * problem, not four, and four separate emails is how a person learns to filter
 * the sender.
 *
 * "Nothing has happened" means no note since the ticket became theirs — not
 * merely that the status has not moved. A ticket somebody is actively working
 * leaves a trail; one that does not is the case this exists to catch.
 */
export async function sendTicketAssigneeNudge(to: string, name: string, rows: TicketReminderRow[]): Promise<void> {
  const first = (name || '').trim().split(' ')[0]
  const n = rows.length

  const inner = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${first ? `Hi ${esc(first)},` : 'Hello,'}</p>
    <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">
      ${n === 1 ? 'This support ticket is' : `These ${n} support tickets are`} assigned to you and
      ${n === 1 ? 'has' : 'have'} had no activity for over 24 hours.
    </p>
    <p style="margin:10px 0 0;color:#555;font-size:14px;line-height:1.6;">
      Adding a note is enough to stop the reminder. Even "waiting on parts" or "customer has not
      called back". The trail is what tells everyone else the ticket is alive.
    </p>
    ${table(rows, r => ageLabel(r.last_activity_at))}
    ${cta(n === 1 ? 'Open the ticket' : 'Open the queue', n === 1 ? `${APP_URL}/admin/tickets/${rows[0].id}` : `${APP_URL}/admin/tickets`)}`

  const subject = n === 1
    ? `Ticket ${rows[0].ticket_number} has gone quiet`
    : `${n} of your support tickets have gone quiet`

  const res = await resend.emails.send({
    from: FROM, to, subject,
    html: shell('#0a2e1e', 'Waiting on you', n === 1 ? 'A ticket with no recent activity' : 'Tickets with no recent activity', inner),
  })
  if (res.error) throw new Error(`resend ticket assignee nudge: ${JSON.stringify(res.error)}`)
  console.log(`[resend] ticket assignee nudge sent to ${to}: id=${res.data?.id}`)
}

/** "Nobody has picked these up." One email to the shared desk, listing all of them. */
export async function sendTicketUnclaimedReminder(rows: TicketReminderRow[]): Promise<void> {
  const recipients = ticketDeskRecipients()
  if (!recipients.length) {
    console.log('[resend] ticket unclaimed reminder: no desk recipient configured — skipped')
    return
  }
  const n = rows.length

  const inner = `
    <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">
      ${n === 1 ? 'This support ticket has' : `These ${n} support tickets have`} been open for more
      than 24 hours with <strong>nobody assigned</strong>.
    </p>
    <p style="margin:10px 0 0;color:#555;font-size:14px;line-height:1.6;">
      Assigning an owner is what stops this. An unassigned ticket has nobody to chase, so it is the
      one thing the rest of the reminders cannot help with.
    </p>
    ${table(rows, r => ageLabel(r.created_at))}
    ${cta('Open the queue', `${APP_URL}/admin/tickets`)}`

  const subject = `REMINDER: ${n} unassigned support ticket${n === 1 ? '' : 's'}`

  const results = await Promise.all(
    recipients.map(to => resend.emails.send({
      from: FROM, to, subject,
      html: shell('#7c2d12', 'Nobody has picked these up', `Unassigned for over 24 hours · ${ageDays(rows[0].created_at)}+ days on the oldest`, inner),
    })),
  )
  results.forEach((r, i) => {
    if (r.error) console.error(`[resend] ticket unclaimed reminder failed to ${recipients[i]}:`, r.error)
    else console.log(`[resend] ticket unclaimed reminder sent to ${recipients[i]}: id=${r.data?.id}`)
  })
  if (results.every(r => r.error)) {
    throw new Error('ticket unclaimed reminder: every send failed')
  }
}
