import { Resend } from 'resend'
import { EMAIL_FROM } from './email-from'

// ─── "Nobody has picked this up" — the leadership escalation ─────────────────
//
// One message, covering BOTH support tickets and quote requests, sent when
// something has been sitting unassigned for 24 hours. It is the last line of a
// three-step chase, and each step exists because the one before it can fail:
//
//   1. the desk sweep  tells the shared mailbox      — a mailbox can go unread
//   2. the owner nudge tells the person who has it   — needs someone to have it
//   3. THIS           tells two named people          — someone whose job is to
//                                                       decide who it belongs to
//
// The first two are about work that has an owner or an inbox. This one fires
// precisely when neither is true, which is the case that otherwise goes quiet
// forever: an unassigned row is nobody's to nudge.
//
// ── Why one email covering both kinds ───────────────────────────────────────
// A ticket and a quote request that nobody has picked up are the same problem
// wearing different clothes, and the decision they need is identical — hand it
// to a person. Two separate emails would arrive minutes apart, each carrying
// half the picture, and the reader would merge them by hand.
//
// ── Why an individual send per recipient ────────────────────────────────────
// Not a shared To: line with both names on it. A message addressed to two people
// is a message addressed to nobody — each assumes the other has it, which is the
// exact failure this email is trying to break. Each recipient gets their own
// copy, addressed to them, and neither can see the other on it.
//
// Never gated behind CUSTOMER_TICKET_EMAILS: this goes to IAT leadership, never
// to a customer, and suppressing it would defeat the point.

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = EMAIL_FROM.PORTAL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

/** The two people who decide who work belongs to. Overridable from Vercel
 *  (comma-separated) without a deploy — a name changing must not need a commit. */
const DEFAULT_LEADERSHIP = 'kacy@dehumidifiers.com,crystal@dehumidifiers.com'

export function leadershipRecipients(): string[] {
  return (process.env.LEADERSHIP_ESCALATION_EMAIL || DEFAULT_LEADERSHIP)
    .split(',').map(s => s.trim()).filter(Boolean)
}

export type EscalationItem = {
  kind: 'ticket' | 'rfq'
  id: string
  reference: string
  /** Who it is for — customer name, or company on a quote request. */
  who: string
  /** One line of what it is: the problem, or the size of the job. */
  what: string
  createdAt: string
}

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function ageHours(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 36e5))
}

function ageLabel(iso: string): string {
  const h = ageHours(iso)
  if (h < 48) return `${h} hours`
  return `${Math.floor(h / 24)} days`
}

const TH = 'padding:8px 14px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:left;'
const TD = 'padding:10px 14px;border-top:1px solid #f0f0f0;font-size:13px;color:#555;vertical-align:top;'

function table(items: EscalationItem[]): string {
  const rows = items.map(it => {
    const href = it.kind === 'ticket'
      ? `${APP_URL}/admin/tickets/${it.id}`
      : `${APP_URL}/admin/rfq/${it.id}`
    return `<tr>
      <td style="${TD}white-space:nowrap;">
        <span style="display:inline-block;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;${
          it.kind === 'ticket'
            ? 'background:#eef4ff;color:#3557b7;'
            : 'background:#f0faf4;color:#089447;'
        }">${it.kind === 'ticket' ? 'Ticket' : 'Quote'}</span>
      </td>
      <td style="${TD}font-family:monospace;">
        <a href="${esc(href)}" style="color:#089447;text-decoration:none;">${esc(it.reference)}</a>
      </td>
      <td style="${TD}color:#333;">${esc(it.who || '—')}<br><span style="color:#999;font-size:12px;">${esc(it.what || '')}</span></td>
      <td style="${TD}white-space:nowrap;">${esc(ageLabel(it.createdAt))}</td>
    </tr>`
  }).join('')

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:18px 0;">
    <tr style="background:#f8f9fa;">
      <td style="${TH}">Kind</td><td style="${TH}">Reference</td><td style="${TH}">Who</td><td style="${TH}">Waiting</td>
    </tr>${rows}</table>`
}

function shell(title: string, sub: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
  <tr><td style="background:#7c2d12;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Innovative Air Technologies</p>
    <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">${esc(title)}</h1>
    <p style="margin:4px 0 0;color:#f5d0b5;font-size:13px;">${esc(sub)}</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">${inner}</td></tr>
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Portal · Sent when something has been unassigned for 24 hours. Assigning it to a person stops these.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

/**
 * Tell leadership what nobody has picked up. One email per recipient.
 *
 * Throws on a send failure so the caller can decline to stamp the rows and try
 * again on the next sweep — the opposite of the "log and continue" posture used
 * for courtesy mail. This message IS the mechanism; silently losing it would
 * leave the rows marked as escalated with nobody having been told.
 */
export async function sendUnassignedEscalation(items: EscalationItem[]): Promise<void> {
  if (!items.length) return
  const recipients = leadershipRecipients()
  if (!recipients.length) {
    console.log('[resend] escalation: no leadership recipient configured — skipped')
    return
  }

  const tickets = items.filter(i => i.kind === 'ticket').length
  const quotes = items.length - tickets
  const parts = [
    tickets ? `${tickets} support ticket${tickets === 1 ? '' : 's'}` : '',
    quotes ? `${quotes} quote request${quotes === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' and ')

  const inner = `
    <p style="margin:0 0 6px;color:#333;font-size:15px;line-height:1.6;">
      <strong>${esc(parts)}</strong> ${items.length === 1 ? 'has' : 'have'} been waiting more than
      24 hours with <strong>nobody assigned</strong>.
    </p>
    <p style="margin:0;color:#555;font-size:14px;line-height:1.6;">
      The shared desk has already been told. This is the second ask, to someone who can decide
      who ${items.length === 1 ? 'it belongs' : 'they belong'} to.
    </p>
    ${table(items)}
    <p style="margin:0;color:#777;font-size:13px;line-height:1.6;">
      Assigning an owner stops the reminders for that row. Anything still unassigned will be
      raised again in 48 hours.
    </p>`

  const subject = `Unassigned after 24 hours — ${parts}`

  // Sent one at a time, each addressed to a single person. Failures are collected
  // rather than short-circuited: one bad address must not stop the other person
  // being told. Throws at the end only if EVERY send failed.
  const results = await Promise.all(
    recipients.map(to => resend.emails.send({
      from: FROM, to, subject,
      html: shell('Nobody has picked this up', 'Waiting more than 24 hours, unassigned', inner),
    }).then(
      r => ({ to, error: r.error ? JSON.stringify(r.error) : null, id: r.data?.id }),
      e => ({ to, error: e instanceof Error ? e.message : String(e), id: undefined }),
    )),
  )

  const failed = results.filter(r => r.error)
  results.forEach(r => {
    if (r.error) console.error(`[resend] escalation failed to ${r.to}:`, r.error)
    else console.log(`[resend] escalation sent to ${r.to}: id=${r.id}`)
  })

  if (failed.length === results.length) {
    throw new Error(`escalation: every send failed (${failed.map(f => f.to).join(', ')})`)
  }
}
