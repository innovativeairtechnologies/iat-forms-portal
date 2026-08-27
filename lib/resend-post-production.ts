import 'server-only'
import { Resend } from 'resend'
import { supabaseAdmin } from './supabase-admin'
import { EMAIL_FROM, internalFrom } from './email-from'
import { engineeringLeadRecipients } from './resend-engineering'
import {
  CATEGORY_LABELS, SEVERITY_LABELS, findingTitle, standingOf, shortDate,
  type Category, type PpFinding, type Severity,
} from './post-production'

/* ────────────────────────────────────────────────────────────────────────────
   Mail about post-production findings. Three messages, all to IAT staff:

     • hand-over   — "N findings from job 4153 are in the queue"  → the leads
     • assignment  — "this one is yours, answer by the 10th"       → the owner
     • chase       — "these are yours and they are close or past"  → the owner

   ── ⚠️ SEND SEQUENTIALLY. Resend's limit is 2 requests a second ────────────
   A Promise.all fan-out against that limit reached only SOME recipients and
   resolved as a success, because the wrapper only threw when EVERY send failed.
   That shipped once on the leadership update and took three sessions to find.
   Do not "optimize" the loops below into a Promise.all.

   ── ⚠️ THE FINDING TEXT DOES NOT GO IN THE BODY, and that is not squeamishness.
   An Exchange transport rule named "Block Bulk / Sales Emails" quarantines any
   external mail containing "act now", "limited time", "special offer" or "buy
   now", and SCL -1 does not protect against it. These messages would otherwise
   carry text dictated verbatim by somebody walking a unit — arbitrary human
   speech, straight into a word-match filter, forever. So the mail carries the
   job number, the category, the count and a link; the words live on the page.
   That is also simply better mail.

   Staff mail sends from the subdomain in RESEND_FROM_INTERNAL via internalFrom()
   — Proofpoint treats mail claiming to be @dehumidifiers.com but arriving
   externally as domain spoofing, and you cannot allow-list your own domain.

   A Resend "delivered" is not an inbox. If staff report missing alerts, run an
   Exchange Message Trace FIRST — the MX is Microsoft.
   ──────────────────────────────────────────────────────────────────────────── */

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = internalFrom(EMAIL_FROM.PORTAL)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

/** Resend allows 2 requests a second. 600ms is comfortably inside that. */
const SEND_GAP_MS = 600

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function sendAll(to: string[], subject: string, html: string) {
  const out: { to: string; ok: boolean; error?: string }[] = []
  for (const [i, addr] of to.entries()) {
    if (i > 0) await new Promise(r => setTimeout(r, SEND_GAP_MS))
    try {
      const res = await resend.emails.send({ from: FROM, to: addr, subject, html })
      if (res.error) out.push({ to: addr, ok: false, error: JSON.stringify(res.error) })
      else out.push({ to: addr, ok: true })
    } catch (err) {
      out.push({ to: addr, ok: false, error: String(err) })
    }
  }
  return out
}

const TH = 'padding:8px 14px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:left;'
const TD = 'padding:10px 14px;border-top:1px solid #f0f0f0;font-size:13px;color:#555;vertical-align:top;'

function shell(title: string, sub: string, inner: string, footer: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:640px;">
  <tr><td style="background:#0a2e1e;padding:24px 32px;">
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

/** The findings table. Job, category, severity and the clock — no finding text,
 *  per the filter note at the top of this file. */
function table(rows: Pick<PpFinding, 'id' | 'job_number' | 'category' | 'severity' | 'due_date' | 'status'>[], now: Date): string {
  const body = rows.map(r => {
    const s = standingOf(r, now)
    const late = s.kind === 'overdue'
    return `<tr>
      <td style="${TD}font-family:monospace;color:#333;">${esc(r.job_number)}</td>
      <td style="${TD}color:#333;">${esc(CATEGORY_LABELS[r.category as Category] ?? r.category)}<br><span style="color:#999;font-size:12px;">${esc(SEVERITY_LABELS[r.severity as Severity] ?? r.severity)}</span></td>
      <td style="${TD}white-space:nowrap;">${esc(shortDate(r.due_date))}</td>
      <td style="${TD}white-space:nowrap;color:${late ? '#c0392b' : '#555'};">${esc(s.label)}</td>
    </tr>`
  }).join('')

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:18px 0;">
    <tr style="background:#f8f9fa;">
      <td style="${TH}">Job</td><td style="${TH}">Finding</td><td style="${TH}">Answer by</td><td style="${TH}">Standing</td>
    </tr>${body}</table>`
}

async function emailFor(employeeId: string): Promise<{ name: string; email: string } | null> {
  const { data } = await supabaseAdmin
    .from('employees').select('name, email').eq('id', employeeId).eq('is_active', true).maybeSingle()
  if (!data?.email) return null
  return { name: (data.name as string) ?? '', email: data.email as string }
}

/** "A walkaround came in." To the leads, not the whole department. */
export async function sendWalkaroundHandover(
  jobNumber: string, count: number, walkedBy: string, walkaroundId: string,
): Promise<void> {
  const to = await engineeringLeadRecipients()
  if (!to.length) {
    console.warn('[pp-mail] no engineering recipients configured — hand-over notice not sent')
    return
  }

  const inner = `
    <p style="margin:0 0 14px;color:#333;font-size:15px;line-height:1.6;">
      ${esc(walkedBy || 'Somebody')} walked job <strong>${esc(jobNumber)}</strong> and recorded
      <strong>${count}</strong> finding${count === 1 ? '' : 's'}.
    </p>
    <p style="margin:0 0 22px;color:#666;font-size:14px;line-height:1.6;">
      They are in the queue unassigned. Each one is due an answer within two weeks of today.
    </p>
    ${cta('Open the findings', `${APP_URL}/admin/engineering/post-production?walk=${walkaroundId}`)}`

  await sendAll(
    to,
    `Post-production: ${count} finding${count === 1 ? '' : 's'} on job ${jobNumber}`,
    shell('Post-production walkaround', `Job ${jobNumber}`, inner, 'IAT Portal · Engineering'),
  )
}

/** "This one is yours." Sent the moment somebody is made responsible, rather
 *  than waiting for the morning sweep — being assigned work is news. */
export async function sendFindingAssignment(employeeId: string, finding: PpFinding): Promise<void> {
  const who = await emailFor(employeeId)
  if (!who) {
    console.warn(`[pp-mail] assignee ${employeeId} has no active email — no notice sent`)
    return
  }

  const first = (who.name || '').trim().split(' ')[0]
  const inner = `
    <p style="margin:0 0 14px;color:#333;font-size:15px;line-height:1.6;">
      ${first ? `${esc(first)}, a` : 'A'} post-production finding from job
      <strong>${esc(finding.job_number)}</strong> is now yours.
    </p>
    <p style="margin:0 0 6px;color:#666;font-size:14px;line-height:1.6;">
      ${esc(CATEGORY_LABELS[finding.category] ?? finding.category)} ·
      ${esc(SEVERITY_LABELS[finding.severity] ?? finding.severity)}
    </p>
    <p style="margin:0 0 22px;color:#666;font-size:14px;line-height:1.6;">
      What is needed back is the solution, by <strong>${esc(shortDate(finding.due_date))}</strong>.
      The photos, video and voice notes are on the page.
    </p>
    ${cta('Open the finding', `${APP_URL}/admin/engineering/post-production/${finding.id}`)}`

  await sendAll(
    [who.email],
    `Post-production finding assigned — job ${finding.job_number}`,
    shell('A finding is yours', `Job ${finding.job_number}`, inner, 'IAT Portal · Post-production'),
  )
}

/** "These are yours and they are close or past." One message per person per
 *  sweep, never one per finding — the difference between a useful list and a
 *  folder rule. */
export async function sendFindingNudge(
  to: string, name: string, rows: PpFinding[], now: Date = new Date(),
): Promise<void> {
  const first = (name || '').trim().split(' ')[0]
  const late = rows.filter(r => standingOf(r, now).kind === 'overdue').length

  const inner = `
    <p style="margin:0 0 14px;color:#333;font-size:15px;line-height:1.6;">
      ${first ? `${esc(first)}, you` : 'You'} have <strong>${rows.length}</strong> post-production
      finding${rows.length === 1 ? '' : 's'} waiting on an answer${late ? `, ${late} of them past the date` : ''}.
    </p>
    ${table(rows, now)}
    <p style="margin:0 0 22px;color:#666;font-size:14px;line-height:1.6;">
      A sentence on what changes is enough. Writing it moves the finding to answered.
    </p>
    ${cta('Open my findings', `${APP_URL}/admin/engineering/post-production?tab=mine`)}`

  await sendAll(
    [to],
    late ? `${late} post-production finding${late === 1 ? '' : 's'} past the answer date` : 'Post-production findings waiting on you',
    shell('Waiting on you', 'Post-production', inner, 'IAT Portal · Post-production'),
  )
}

/** The lead roll-up: what is late, what nobody owns, and what keeps coming back. */
export async function sendPostProductionRollUp(
  to: string[],
  parts: { overdue: PpFinding[]; unassigned: PpFinding[]; recurring: { title: string; count: number; jobs: string[] }[] },
  now: Date = new Date(),
): Promise<{ to: string; ok: boolean; error?: string }[]> {
  const sections: string[] = []

  if (parts.overdue.length) {
    sections.push(`<h2 style="margin:0 0 4px;font-size:15px;color:#c0392b;">Past the answer date (${parts.overdue.length})</h2>${table(parts.overdue, now)}`)
  }
  if (parts.unassigned.length) {
    sections.push(`<h2 style="margin:18px 0 4px;font-size:15px;color:#333;">Nobody owns these yet (${parts.unassigned.length})</h2>${table(parts.unassigned, now)}`)
  }
  if (parts.recurring.length) {
    const rows = parts.recurring.map(r => `<tr>
      <td style="${TD}color:#333;">${esc(r.title)}</td>
      <td style="${TD}white-space:nowrap;font-family:monospace;">${esc(r.jobs.slice(0, 6).join(', '))}${r.jobs.length > 6 ? '…' : ''}</td>
      <td style="${TD}white-space:nowrap;text-align:right;">${r.count}×</td>
    </tr>`).join('')
    sections.push(`<h2 style="margin:18px 0 4px;font-size:15px;color:#333;">Keeps coming back</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:18px 0;">
        <tr style="background:#f8f9fa;"><td style="${TH}">Issue</td><td style="${TH}">Jobs</td><td style="${TH}">Raised</td></tr>${rows}
      </table>
      <p style="margin:0 0 14px;color:#888;font-size:12px;line-height:1.5;">
        Counts are confirmed groupings only. Anything a match has suggested but nobody has reviewed is not included.
      </p>`)
  }

  if (!sections.length) return []

  const inner = `${sections.join('')}${cta('Open post-production', `${APP_URL}/admin/engineering/post-production`)}`
  return sendAll(
    to,
    'Post-production: what is still open',
    shell('Post-production', 'Findings and recurring issues', inner, 'IAT Portal · Engineering'),
  )
}
