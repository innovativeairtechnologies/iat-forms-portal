import { Resend } from 'resend'
import { EMAIL_FROM, internalFrom } from './email-from'

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
const FROM = internalFrom(EMAIL_FROM.PORTAL)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

/** The three admins who decide who work belongs to, and who are accountable for
 *  nothing being left unattended. Overridable from Vercel (comma-separated)
 *  without a deploy — a name changing must not need a commit. */
const DEFAULT_LEADERSHIP =
  'kacy@dehumidifiers.com,crystal@dehumidifiers.com,lee.childers@dehumidifiers.com'

export function leadershipRecipients(): string[] {
  return (process.env.LEADERSHIP_ESCALATION_EMAIL || DEFAULT_LEADERSHIP)
    .split(',').map(s => s.trim()).filter(Boolean)
}

/* Sales, added only when the email actually contains a quote request.
   ⚠️ `jacob@` is Jacob REAGAN (Inside Sales Engineer). `jacob.younker@` is a
   different person — the roster holds several Jacobs and they must not be
   conflated. Overridable via SALES_ESCALATION_EMAIL. */
const DEFAULT_SALES = 'mike.payton@dehumidifiers.com,jacob@dehumidifiers.com'

export function salesRecipients(): string[] {
  return (process.env.SALES_ESCALATION_EMAIL || DEFAULT_SALES)
    .split(',').map(s => s.trim()).filter(Boolean)
}

/* `stalled` is assigned-but-untouched, and it is here rather than in its own
   email for a reason. The owner already gets their own nudge; this is the
   oversight copy, and an admin asking "is anything being dropped?" wants one
   list, not two arriving minutes apart with half the picture each.

   It also closes a real hole. The owner nudge needs an active roster row to
   reach anybody, so a ticket assigned to someone who has left was chased by
   NOBODY — the unassigned sweeps skip it because it has an owner. This list
   does not depend on the owner being reachable, so it surfaces regardless. */
/* Two axes, deliberately separate. WHAT it is, and WHY it is here. Folding them
   into one field worked while there were two combinations; there are now four,
   and a single `kind` would have to spell each one out — which is how a fifth
   gets forgotten. */
export type EscalationItem = {
  entity: 'ticket' | 'rfq'
  state: 'unassigned' | 'stalled'
  id: string
  reference: string
  /** Who it is for — customer name, or company on a quote request. */
  who: string
  /** One line of what it is: the problem, or the size of the job. */
  what: string
  createdAt: string
  /** `stalled` only — who holds it, so an admin can see where it is stuck. */
  owner?: string | null
  /** `stalled` only — when it last had any activity, which is what "quiet" means. */
  quietSince?: string | null
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

const ENTITY_LABEL: Record<EscalationItem['entity'], string> = {
  ticket: 'Ticket',
  rfq: 'Quote',
}
const STATE_STYLE: Record<EscalationItem['state'], string> = {
  unassigned: 'background:#eef4ff;color:#3557b7;',
  stalled: 'background:#fdf3e7;color:#8a5a00;',
}

function table(items: EscalationItem[]): string {
  const rows = items.map(it => {
    const href = it.entity === 'rfq'
      ? `${APP_URL}/admin/rfq/${it.id}`
      : `${APP_URL}/admin/tickets/${it.id}`
    const label = it.state === 'stalled'
      ? `${ENTITY_LABEL[it.entity]} · stalled`
      : ENTITY_LABEL[it.entity]
    // For a stalled row the useful age is how long it has been QUIET, not how
    // old the row is. A three-week ticket touched yesterday is fine; a two-day
    // ticket nobody has written on since Monday is not.
    const age = it.state === 'stalled' ? (it.quietSince ?? it.createdAt) : it.createdAt
    const held = it.state === 'stalled'
      ? `<br><span style="color:#8a5a00;font-size:12px;">with ${esc(it.owner || 'an owner who has no active account')}</span>`
      : ''
    return `<tr>
      <td style="${TD}white-space:nowrap;">
        <span style="display:inline-block;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;${STATE_STYLE[it.state]}">${label}</span>
      </td>
      <td style="${TD}font-family:monospace;">
        <a href="${esc(href)}" style="color:#089447;text-decoration:none;">${esc(it.reference)}</a>
      </td>
      <td style="${TD}color:#333;">${esc(it.who || '—')}<br><span style="color:#999;font-size:12px;">${esc(it.what || '')}</span>${held}</td>
      <td style="${TD}white-space:nowrap;">${esc(ageLabel(age))}</td>
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
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Portal · Sent when something has gone 24 hours unassigned, or 24 hours with an owner but no activity. Assigning it, or writing a note on it, stops these.</p>
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
export async function sendOversightEscalation(items: EscalationItem[]): Promise<void> {
  if (!items.length) return

  // Admins always. Sales only when there is actually a quote request in the
  // email — a rep copied on ticket-only mail learns to skim past it, and the
  // one time it does concern them is the time they will not read it.
  const hasRfq = items.some(i => i.entity === 'rfq')
  const seen = new Set<string>()
  const recipients = [...leadershipRecipients(), ...(hasRfq ? salesRecipients() : [])]
    .filter(a => {
      const k = a.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

  if (!recipients.length) {
    console.log('[resend] escalation: no leadership recipient configured — skipped')
    return
  }

  const unowned = items.filter(i => i.state === 'unassigned')
  const stalledItems = items.filter(i => i.state === 'stalled')
  const tickets = unowned.filter(i => i.entity === 'ticket').length
  const quotes = unowned.filter(i => i.entity === 'rfq').length
  const stalled = stalledItems.length

  const unownedParts = [
    tickets ? `${tickets} support ticket${tickets === 1 ? '' : 's'}` : '',
    quotes ? `${quotes} quote request${quotes === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' and ')

  const subject = [
    unowned.length ? `${unowned.length} unassigned` : '',
    stalled ? `${stalled} stalled` : '',
  ].filter(Boolean).join(', ')

  // Unassigned first: it is the work nobody owns, so it is most likely to be
  // forgotten. Stalled at least has a name against it. Tickets before quotes
  // within each group, so the order is stable run to run.
  const rank = (i: EscalationItem) =>
    (i.state === 'unassigned' ? 0 : 2) + (i.entity === 'ticket' ? 0 : 1)
  const sorted = [...items].sort((a, b) => rank(a) - rank(b))

  const unownedLine = unownedParts
    ? `<p style="margin:0 0 6px;color:#333;font-size:15px;line-height:1.6;">
        <strong>${esc(unownedParts)}</strong> ${tickets + quotes === 1 ? 'has' : 'have'} been waiting
        more than 24 hours with <strong>nobody assigned</strong>. The shared desk has already been
        told; this is the second ask, to someone who can decide who it belongs to.
      </p>`
    : ''

  const st = stalledItems.filter(i => i.entity === 'ticket').length
  const sq = stalled - st
  const stalledParts = [
    st ? `${st} support ticket${st === 1 ? '' : 's'}` : '',
    sq ? `${sq} quote request${sq === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' and ')

  const stalledLine = stalled
    ? `<p style="margin:${unownedParts ? '10px' : '0'} 0 6px;color:#333;font-size:15px;line-height:1.6;">
        <strong>${esc(stalledParts)}</strong> ${stalled === 1 ? 'has' : 'have'} an owner but
        <strong>no movement for 24 hours</strong>. The owner has been nudged separately. This copy is
        so nothing sits unattended without you knowing.
      </p>`
    : ''

  const inner = `
    ${unownedLine}
    ${stalledLine}
    ${table(sorted)}
    <p style="margin:0;color:#777;font-size:13px;line-height:1.6;">
      Assigning an owner stops the unassigned reminders. Writing a note stops the stalled ones —
      even "waiting on parts" counts. Anything still outstanding is raised again in 48 hours.
    </p>`

  // Sent one at a time, each addressed to a single person. Failures are collected
  // rather than short-circuited: one bad address must not stop the other person
  // being told. Throws at the end only if EVERY send failed.
  const results = await Promise.all(
    recipients.map(to => resend.emails.send({
      from: FROM, to, subject: `Needs attention: ${subject}`,
      html: shell(
        stalled && !unownedParts ? 'Nothing has happened on these' : 'Nobody has picked this up',
        'Waiting more than 24 hours',
        inner,
      ),
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
