import { Resend } from 'resend'
import { EMAIL_FROM, internalFrom } from './email-from'
import { deskRecipients } from './ticket-recipients'

// ─── "A customer asked for portal access" — the immediate alert ──────────────
//
// Until this existed, a self-serve access request was written to
// customer_portal_requests and told NOBODY. The customer was shown "we'll review
// it and email you once it's approved" while the only thing that could surface
// the request was an admin happening to open /admin/customers and click a tab
// they had no reason to click. Two requests sat unactioned for days that way.
//
// Two things fixed it, and they are deliberately different in kind:
//   • THIS — fires the moment the request lands, so it is seen the same day.
//   • the daily digest section (lib/admin-digest.ts) — a standing count, so a
//     request that slips past this email is raised again every afternoon.
// One is the nudge, the other is the net. Neither replaces the other: an alert
// can be missed and a digest can be skimmed, but a request has to survive both
// to go quiet.
//
// ── Who hears about it ──────────────────────────────────────────────────────
// The shared support desk, plus the three admins who can actually act. Both,
// for the same reason lib/ticket-recipients.ts gives: the desk is the monitored
// record that survives someone being away, and the named people are the ones
// who will do something about it. Approving is a strict-admin action
// (getAdminUser in /api/admin/customers/invite), so alerting a scoped role
// would be telling someone about a button they cannot press.
//
// ── Why the customer's own words are NOT in this email ──────────────────────
// Deliberate, not an oversight. Staff-bound mail is filtered by an Exchange
// rule ("Block Bulk / Sales Emails") that quarantines any external message
// containing phrases like "act now" or "limited time" — and SCL -1 does not
// exempt it. Ticket alerts quote the customer's problem description verbatim
// and are exposed to exactly that. This email has no reason to carry free text:
// the decision it asks for is "is this person who they say they are", which
// needs identity fields and a link, not a repair narrative. So it carries only
// short structured values and stays out of the rule's way.
//
// Never gated behind CUSTOMER_TICKET_EMAILS: this goes to IAT staff, never to a
// customer, and suppressing it would defeat the point.

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = internalFrom(EMAIL_FROM.PORTAL)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

/** The admins who can approve or deny. Overridable from Vercel
 *  (comma-separated) so a roster change never needs a commit — the same escape
 *  hatch leadershipRecipients() uses. */
const DEFAULT_APPROVERS = 'kacy@dehumidifiers.com,crystal@dehumidifiers.com,lee.childers@dehumidifiers.com'

export function portalAccessApprovers(): string[] {
  return (process.env.PORTAL_ACCESS_ALERT_EMAIL || DEFAULT_APPROVERS)
    .split(',').map(s => s.trim()).filter(Boolean)
}

/** Desk + approvers, de-duplicated case-insensitively — the desk address and an
 *  approver's address differing only by capitalization would otherwise send the
 *  same mailbox two copies. */
export function portalAccessRecipients(): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const addr of [...deskRecipients(), ...portalAccessApprovers()]) {
    const key = addr.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(addr)
  }
  return out
}

export type PortalAccessAlert = {
  /** customer_portal_requests.id — for the log line, not shown. */
  requestId: string
  email: string
  company: string | null
  contactName: string | null
  phone: string | null
  ticketNumber: string
  /** Company name of the customer this ticket's serial already belongs to, if
   *  any — the "attach to this account instead of creating a duplicate" hint the
   *  queue shows. Worth repeating here because it changes the decision. */
  suggestedCompany: string | null
}

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TH = 'padding:9px 16px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:left;white-space:nowrap;width:34%;vertical-align:top;'
const TD = 'padding:9px 16px;font-size:13px;color:#333;border-top:1px solid #f0f0f0;vertical-align:top;'

function row(label: string, value: string): string {
  return `<tr><td style="${TH}">${esc(label)}</td><td style="${TD}">${value}</td></tr>`
}

function shell(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
  <tr><td style="background:#1a1a2e;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Innovative Air Technologies</p>
    <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">${esc(title)}</h1>
  </td></tr>
  <tr><td style="padding:28px 32px;">${body}</td></tr>
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Portal · Sent when a customer requests portal access. Approving or denying the request stops it appearing in the daily digest.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

/**
 * Tell the desk and the approvers that a request is waiting. One email per
 * recipient, matching the ticket-alert convention.
 *
 * NEVER THROWS. The caller is the public request route, and the customer's
 * request is already committed by the time this runs — failing their submission
 * because our own mail relay hiccuped would turn a notification problem into a
 * customer-facing one. A send that fails is logged and the request still sits in
 * the queue, where the daily digest will raise it. That is what the digest half
 * is for.
 */
export async function sendPortalAccessRequestAlert(alert: PortalAccessAlert): Promise<void> {
  const recipients = portalAccessRecipients()
  if (!recipients.length) {
    console.log('[resend] portal-access alert: no recipient configured — skipped')
    return
  }

  const who = alert.company || alert.contactName || alert.email
  const queueUrl = `${APP_URL}/admin/customers?tab=requests`

  const rows = [
    row('Company', alert.company ? `<strong>${esc(alert.company)}</strong>` : '<span style="color:#999;">Not given</span>'),
    row('Contact', esc(alert.contactName || '—')),
    row('Email', `<a href="mailto:${esc(alert.email)}" style="color:#089447;text-decoration:none;">${esc(alert.email)}</a>`),
    row('Phone', esc(alert.phone || '—')),
    row('From ticket', `<span style="font-family:monospace;">${esc(alert.ticketNumber)}</span>`),
  ].join('')

  const suggestion = alert.suggestedCompany
    ? `<div style="background:#f0faf4;border:1px solid rgba(8,148,71,0.2);border-radius:10px;padding:14px 18px;margin:0 0 20px;">
         <p style="margin:0;color:#333;font-size:13px;line-height:1.6;">
           The equipment on this ticket is already owned by
           <strong>${esc(alert.suggestedCompany)}</strong>. Attach this contact to that account rather than
           creating a second company for them.
         </p>
       </div>`
    : ''

  const body = `
    <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6;">
      <strong>${esc(who)}</strong> asked for access to the customer portal after submitting a support
      ticket. They have been told IAT will review it and email them once it is approved — nothing
      reaches them until someone here decides.
    </p>
    ${suggestion}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:0 0 22px;">${rows}</table>
    <a href="${esc(queueUrl)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Review the request</a>`

  const subject = `Portal access requested: ${who}`
  const html = shell('Portal Access Request', body)

  // One send per recipient, failures collected rather than short-circuited: one
  // bad address must not stop everyone else being told.
  const results = await Promise.all(
    recipients.map(to => resend.emails.send({ from: FROM, to, subject, html }).then(
      r => ({ to, error: r.error ? JSON.stringify(r.error) : null, id: r.data?.id }),
      e => ({ to, error: e instanceof Error ? e.message : String(e), id: undefined }),
    )),
  )

  results.forEach(r => {
    if (r.error) console.error(`[resend] portal-access alert failed to ${r.to} (request ${alert.requestId}):`, r.error)
    else console.log(`[resend] portal-access alert sent to ${r.to} (request ${alert.requestId}): id=${r.id}`)
  })
}
