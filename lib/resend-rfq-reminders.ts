import { Resend } from 'resend'
import { EMAIL_FROM } from './email-from'

// ─── Mail about a quote request's life in the queue ──────────────────────────
//
// Four sends, all to IAT staff, all linking to one row:
//   • assignment notice  — "this one is yours now"            (action-triggered)
//   • customer message   — "they have written to you"         (action-triggered)
//   • assignee nudge     — "you own this and haven't started" (lib/rfq-reminders)
//   • unclaimed reminder — "nobody has picked these up"       (lib/rfq-reminders)
//
// A separate module from resend-rfq.ts on purpose: that file handles the mail a
// SUBMISSION triggers (desk heads-up, customer confirmation), this one handles
// everything that happens to a request AFTER it lands. Different triggers,
// different failure modes, and keeping them apart means a change to one cannot
// quietly alter the other. The three share a shell, a table and a job line so
// the same request looks the same whichever message you open it from.
//
// Neither is gated behind CUSTOMER_TICKET_EMAILS: these go to IAT staff and the
// shared desk, never to a customer, and they are the mechanism that stops a real
// quote request going quiet. Suppressing them would defeat the point.

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = EMAIL_FROM.PORTAL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

export type ReminderRow = {
  id: string
  reference: string
  company: string
  project_name: string
  application_label: string
  track: string
  created_at: string
  summary: Record<string, unknown> | null
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Same recipient chain as the submission heads-up, so one env var moves both.
 *  Exported so the public message endpoint falls back to exactly this list
 *  rather than growing a second, drifting copy of it. */
export function deskRecipients(): string[] {
  const raw = process.env.RFQ_NOTIFICATION_EMAIL
    || process.env.SUPPORT_NOTIFICATION_EMAIL
    || 'iatsupport@dehumidifiers.com'
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function ageDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5))
}

/** The one line that says whether this is a big job or a small one. */
function jobLine(r: ReminderRow): string {
  const s = r.summary ?? {}
  if (!s.complete) return r.application_label || 'Not yet estimated'
  return r.track === 'room'
    ? `${s.total_lb_per_hr ?? '—'} lb/hr · ${Number(s.dry_air_cfm ?? 0).toLocaleString()} cfm`
    : `${Number(s.cfm ?? 0).toLocaleString()} cfm @ ${s.leaving_grains ?? '—'} gr/lb`
}

const TH = 'padding:8px 14px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:left;'
const TD = 'padding:10px 14px;border-top:1px solid #f0f0f0;font-size:13px;color:#555;vertical-align:top;'

function table(rows: ReminderRow[]): string {
  const body = rows.map(r => {
    const age = ageDays(r.created_at)
    return `<tr>
      <td style="${TD}font-family:monospace;">
        <a href="${esc(APP_URL)}/admin/rfq/${esc(r.id)}" style="color:#089447;text-decoration:none;">${esc(r.reference)}</a>
      </td>
      <td style="${TD}color:#333;">${esc(r.company || '—')}<br><span style="color:#999;font-size:12px;">${esc(r.project_name || 'Unnamed project')}</span></td>
      <td style="${TD}">${esc(jobLine(r))}</td>
      <td style="${TD}white-space:nowrap;">${age} day${age === 1 ? '' : 's'}</td>
    </tr>`
  }).join('')

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:18px 0;">
    <tr style="background:#f8f9fa;">
      <td style="${TH}">Reference</td><td style="${TH}">Company</td><td style="${TH}">The job</td><td style="${TH}">Waiting</td>
    </tr>${body}</table>`
}

/** Footer for the two scheduled chasers — says how to make them stop. */
const CHASER_FOOTER = 'IAT Portal · Automated reminder. Moving a request off "New" stops these.'

function shell(headerBg: string, title: string, sub: string, inner: string, footer = CHASER_FOOTER): string {
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
    <p style="margin:0;color:#aaa;font-size:12px;">${esc(footer)}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function cta(label: string, href: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">${esc(label)}</a>`
}

/**
 * "This one is yours now." Sent once, the moment a survey is assigned to a
 * person — the only message here that is triggered by an action rather than a
 * schedule.
 *
 * Until this existed, being handed a quote request was silent: the first thing
 * an owner heard about it was the 24-hour nudge telling them they were already
 * late. The nudge is the second message now, not the first.
 *
 * Two things the caller decides, not this function: it is NOT sent when someone
 * assigns a row to themselves (you know what you just did, and self-addressed
 * mail trains people to ignore the sender), and a failure here is logged rather
 * than thrown. The assignment is already written — it is the record, and the
 * mail is a courtesy. Losing the courtesy must never roll back the record.
 */
export async function sendRfqAssignmentNotice(
  to: string,
  name: string,
  row: ReminderRow,
  assignedBy: string,
): Promise<void> {
  const first = (name || '').trim().split(' ')[0]
  const by = (assignedBy || '').trim()

  const inner = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${first ? `Hi ${esc(first)},` : 'Hello,'}</p>
    <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">
      ${by ? `<strong>${esc(by)}</strong> assigned this quote request to you.` : 'A quote request has been assigned to you.'}
      It is yours to price.
    </p>
    <p style="margin:10px 0 0;color:#555;font-size:14px;line-height:1.6;">
      Move it to <strong>Reviewing</strong> once you have had a look. That is all it takes to stop
      the reminders. Otherwise a nudge follows in 24 hours.
    </p>
    ${table([row])}
    ${cta('Open the request', `${APP_URL}/admin/rfq/${row.id}`)}`

  const subject = `Quote request ${row.reference} is yours`
    + (row.company ? ` (${row.company})` : '')

  const res = await resend.emails.send({
    from: FROM, to, subject,
    html: shell(
      '#0a2e1e', 'Assigned to you', 'A new quote request to price', inner,
      'IAT Portal · Sent once, when a request is assigned to you.',
    ),
  })
  if (res.error) throw new Error(`resend rfq assignment notice: ${JSON.stringify(res.error)}`)
  console.log(`[resend] rfq assignment notice sent to ${to}: id=${res.data?.id}`)
}

/**
 * "The customer has written to you." Sent the moment someone adds a message to
 * their own quote request from /support/status.
 *
 * This is the half of the write-back that makes it worth having. The message is
 * already on the trail by the time this runs and is visible in /admin/rfq either
 * way — but nobody refreshes a quote request they are not thinking about, so
 * without a push the customer's reply sits unread and the silence they wrote to
 * break gets longer. A mail failure is logged, never thrown: losing the alert
 * must not cost us the message.
 *
 * Recipients are the caller's decision — the assignee when the request has one,
 * the shared desk when it does not. Deliberately not both: a request with an
 * owner has someone whose job this is, and copying the desk on every message
 * teaches the desk to filter the folder.
 *
 * The message is quoted in full rather than summarised. It is at most 4000
 * characters, and asking someone to click through to read two sentences is how
 * an alert becomes something people skim past.
 */
export async function sendRfqCustomerMessageAlert(
  args: { id: string; reference: string; company: string; contactName: string; message: string },
  recipients: string[],
): Promise<void> {
  if (!recipients.length) {
    console.log('[resend] rfq customer message: no recipient configured — skipped')
    return
  }
  const { id, reference, company, contactName, message } = args
  const who = contactName || 'The customer'

  const inner = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
      <strong>${esc(who)}</strong>${company ? ` at ${esc(company)}` : ''} added a message to quote
      request <strong style="font-family:monospace;">${esc(reference)}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;color:#333;font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(message)}</td></tr>
    </table>
    <p style="margin:0 0 18px;color:#555;font-size:14px;line-height:1.6;">
      It is on the request's note trail, marked as coming from them. Reply by email or phone;
      the portal does not send your answer back to them.
    </p>
    ${cta('Open the request', `${APP_URL}/admin/rfq/${id}`)}`

  const subject = `${who} replied on quote request ${reference}`
    + (company ? ` (${company})` : '')

  const results = await Promise.all(
    recipients.map(to => resend.emails.send({
      from: FROM, to, subject,
      html: shell(
        '#0a2e1e', 'A customer replied', 'On a quote request', inner,
        'IAT Portal · Sent when a customer adds a message to their quote request.',
      ),
    })),
  )
  results.forEach((r, i) => {
    if (r.error) console.error(`[resend] rfq customer message alert failed to ${recipients[i]}:`, r.error)
    else console.log(`[resend] rfq customer message alert sent to ${recipients[i]}: id=${r.data?.id}`)
  })
}

/** "You own these and have not started them." One email per owner, not per row. */
export async function sendRfqAssigneeNudge(to: string, name: string, rows: ReminderRow[]): Promise<void> {
  const first = (name || '').trim().split(' ')[0]
  const many = rows.length > 1
  const href = many ? `${APP_URL}/admin/rfq` : `${APP_URL}/admin/rfq/${rows[0].id}`

  const inner = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${first ? `Hi ${esc(first)},` : 'Hello,'}</p>
    <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">
      ${many ? `${rows.length} quote requests are` : 'A quote request is'} assigned to you and still sitting at
      <strong>New</strong>. If you have ${many ? 'them' : 'it'} in hand, move ${many ? 'them' : 'it'} to
      <strong>Reviewing</strong>. That is all it takes to stop these reminders.
    </p>
    ${table(rows)}
    ${cta(many ? 'Open the quote queue' : 'Open the request', href)}`

  const subject = many
    ? `${rows.length} quote requests assigned to you still need a first look`
    : `Quote request ${rows[0].reference} still needs a first look`

  const res = await resend.emails.send({
    from: FROM, to, subject,
    html: shell('#0a2e1e', 'Waiting on you', 'Assigned, not yet started', inner),
  })
  // Thrown, not logged: the caller only stamps assignee_nudged_at on success, so
  // a failure here means the next run tries again rather than going quiet.
  if (res.error) throw new Error(`resend assignee nudge: ${JSON.stringify(res.error)}`)
  console.log(`[resend] rfq assignee nudge sent to ${to}: id=${res.data?.id}`)
}

/** "Nobody has picked these up." Shared desk, REMINDER up front in the subject. */
export async function sendRfqUnclaimedReminder(rows: ReminderRow[]): Promise<void> {
  const recipients = deskRecipients()
  if (!recipients.length) {
    console.log('[resend] no rfq reminder recipient configured — unclaimed reminder skipped')
    return
  }
  const many = rows.length > 1
  const oldest = Math.max(...rows.map(r => ageDays(r.created_at)))

  const inner = `
    <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">
      ${many ? `${rows.length} quote requests have` : 'A quote request has'} come in and
      <strong>nobody has picked ${many ? 'them' : 'it'} up.</strong>
      The oldest has been waiting <strong>${oldest} day${oldest === 1 ? '' : 's'}</strong>.
    </p>
    <p style="margin:10px 0 0;color:#555;font-size:14px;line-height:1.6;">
      Assign ${many ? 'each one' : 'it'} to someone in the portal. That is what stops this reminder and
      starts the clock on the person who owns it.
    </p>
    ${table(rows)}
    ${cta('Assign in the portal', `${APP_URL}/admin/rfq`)}`

  const subject = `REMINDER: ${rows.length} quote request${many ? 's' : ''} waiting to be picked up`
    + (oldest > 0 ? `, oldest ${oldest} day${oldest === 1 ? '' : 's'} old` : '')

  const results = await Promise.all(
    recipients.map(to => resend.emails.send({
      from: FROM, to, subject,
      html: shell('#7a2e12', 'Nobody has picked these up', 'Unassigned quote requests', inner),
    }))
  )
  results.forEach((r, i) => {
    if (r.error) console.error(`[resend] rfq unclaimed reminder failed to ${recipients[i]}:`, r.error)
    else console.log(`[resend] rfq unclaimed reminder sent to ${recipients[i]}: id=${r.data?.id}`)
  })
  // Only a total failure throws — one bad address out of several should still
  // let the rows be stamped, or the good recipients get chased again tomorrow.
  if (results.every(r => r.error)) throw new Error('every unclaimed reminder send failed')
}
