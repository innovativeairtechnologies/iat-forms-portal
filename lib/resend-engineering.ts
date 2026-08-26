import { Resend } from 'resend'
import { supabaseAdmin } from './supabase-admin'
import { EMAIL_FROM, internalFrom } from './email-from'
import { STREAM_LABELS, projectTask, type EngTaskRow } from './engineering'

/* ────────────────────────────────────────────────────────────────────────────
   Mail about engineering work. Two messages, both to IAT staff:

     • owner nudge      — "these are yours and they are close or past"
     • lead roll-up     — "here is what is late, unowned or untouched"

   ── ⚠️ SEND SEQUENTIALLY. Resend's limit is 2 requests a second ────────────
   A Promise.all fan-out against that limit reached only SOME recipients and
   resolved as a success, because the wrapper only threw when EVERY send failed.
   That shipped once on the leadership update and took three sessions to find.
   sendAll() below paces the sends and reports each one; do not "optimize" it
   back into a Promise.all.

   ── ⚠️ Watch the words. Two filters sit between here and an inbox ──────────
   1. Proofpoint Essentials treats mail claiming to be @dehumidifiers.com but
      arriving externally as domain spoofing, and you cannot allow-list your own
      domain. internalFrom() is the fix — staff mail sends from the subdomain in
      RESEND_FROM_INTERNAL. Never bypass it for a staff-bound message.
   2. An Exchange transport rule named "Block Bulk / Sales Emails" quarantines
      any external mail containing "act now", "limited time", "special offer" or
      "buy now" — and SCL -1 does not protect against it. Chasing copy is exactly
      the register that drifts into those phrases. It is avoided deliberately
      below; keep it that way.

   A Resend "delivered" is not an inbox. If staff report missing alerts, run an
   Exchange Message Trace FIRST — the MX is Microsoft.
   ──────────────────────────────────────────────────────────────────────────── */

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = internalFrom(EMAIL_FROM.PORTAL)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

/** Resend allows 2 requests a second. 600ms is comfortably inside that with
 *  room for jitter, and these sweeps send single-digit numbers of messages. */
const SEND_GAP_MS = 600

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Who hears about late engineering work.
 *
 * ENGINEERING_NOTIFICATION_EMAIL (comma-separated) wins. Failing that, the
 * people whose profile role is literally `engineering` — the department itself.
 *
 * ⚠️ Deliberately NOT falling back to "everyone who holds engineering_jobs".
 * That set includes every admin and every production manager, and a daily
 * roll-up landing on people who did not ask for it is how a useful alert becomes
 * a mail rule. An empty result means nothing is sent and the cron log says so —
 * a chaser with no configured audience should go quiet loudly, not guess.
 */
export async function engineeringLeadRecipients(): Promise<string[]> {
  const raw = process.env.ENGINEERING_NOTIFICATION_EMAIL
  if (raw) return raw.split(',').map(s => s.trim()).filter(Boolean)

  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, role').eq('role', 'engineering')
  const ids = (profiles ?? []).map(p => p.id as string)
  if (!ids.length) return []

  const { data } = await supabaseAdmin
    .from('employees').select('email').in('id', ids).eq('is_active', true)
  return (data ?? []).map(e => e.email as string).filter(Boolean)
}

/** Sequential sender. Returns one result per recipient so a partial failure is
 *  visible rather than being flattened into a single boolean. */
async function sendAll(
  to: string[], subject: string, html: string,
): Promise<{ to: string; ok: boolean; error?: string }[]> {
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

function table(rows: EngTaskRow[], now: Date, opts: { showOwner?: boolean } = {}): string {
  const body = rows.map(r => {
    const p = projectTask(r, now)
    const late = p.kind === 'overdue' || p.kind === 'behind'
    return `<tr>
      <td style="${TD}font-family:monospace;color:#333;">${esc(r.job_number ?? '—')}</td>
      <td style="${TD}color:#333;">${esc(r.title)}<br><span style="color:#999;font-size:12px;">${esc(STREAM_LABELS[r.stream])}${r.customer_name ? ` · ${esc(r.customer_name)}` : ''}</span></td>
      ${opts.showOwner ? `<td style="${TD}">${esc(r.assignee_name ?? 'Nobody')}</td>` : ''}
      <td style="${TD}white-space:nowrap;">${esc(r.due_date ?? '—')}</td>
      <td style="${TD}white-space:nowrap;color:${late ? '#c0392b' : '#555'};">${esc(p.label)}</td>
    </tr>`
  }).join('')

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:18px 0;">
    <tr style="background:#f8f9fa;">
      <td style="${TH}">Job</td><td style="${TH}">Task</td>${opts.showOwner ? `<td style="${TH}">Owner</td>` : ''}<td style="${TH}">Due</td><td style="${TH}">Standing</td>
    </tr>${body}</table>`
}

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

/**
 * "These are yours." One message per person per sweep, never one per task — a
 * person with six things due gets one email, which is the difference between a
 * useful list and a folder rule.
 */
export async function sendEngineerNudge(
  to: string, name: string, rows: EngTaskRow[], now: Date = new Date(),
): Promise<void> {
  const first = (name || '').trim().split(' ')[0]
  const overdue = rows.filter(r => projectTask(r, now).kind === 'overdue').length

  const inner = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${first ? `Hi ${esc(first)},` : 'Hello,'}</p>
    <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">
      ${rows.length} engineering ${rows.length === 1 ? 'task is' : 'tasks are'} due shortly or already past.
      ${overdue > 0 ? `<strong>${overdue}</strong> ${overdue === 1 ? 'is' : 'are'} past the date.` : ''}
    </p>
    <p style="margin:10px 0 0;color:#555;font-size:14px;line-height:1.6;">
      Moving the progress bar or the status on any of them is what stops these reminders — and it is what
      keeps the ahead/behind figure on the status board honest.
    </p>
    ${table(rows, now)}
    ${cta('Open my work', `${APP_URL}/admin/engineering/my-work`)}`

  const results = await sendAll(
    [to],
    `${rows.length} engineering ${rows.length === 1 ? 'task' : 'tasks'} need${rows.length === 1 ? 's' : ''} your attention`,
    shell('Your engineering tasks', 'Due shortly, or already past', inner,
      'IAT Portal · Automated reminder. Updating a task stops these.'),
  )
  const failed = results.filter(r => !r.ok)
  if (failed.length) throw new Error(`resend engineer nudge: ${failed[0].error}`)
  console.log(`[resend] engineering nudge sent to ${to}: ${rows.length} task(s)`)
}

/**
 * The department roll-up. Three lists, in the order a lead should read them:
 * past due, nobody owns it, nobody has touched it.
 *
 * ⚠️ Returns per-recipient results rather than throwing on the first failure. A
 * roll-up that reached two of three people and reported success is the exact
 * shape of the leadership-update bug this file's header warns about.
 */
export async function sendEngineeringRollUp(
  to: string[],
  d: { overdue: EngTaskRow[]; unassigned: EngTaskRow[]; stale: EngTaskRow[]; staleDays: number; unplannedJobs: number },
  now: Date = new Date(),
): Promise<{ to: string; ok: boolean; error?: string }[]> {
  if (!to.length) return []

  const section = (title: string, note: string, rows: EngTaskRow[]) =>
    rows.length === 0 ? '' : `
      <h2 style="margin:24px 0 2px;color:#0a2e1e;font-size:15px;font-weight:700;">${esc(title)} (${rows.length})</h2>
      <p style="margin:0;color:#888;font-size:12px;">${esc(note)}</p>
      ${table(rows.slice(0, 15), now, { showOwner: true })}
      ${rows.length > 15 ? `<p style="margin:-8px 0 0;color:#888;font-size:12px;">…and ${rows.length - 15} more on the board.</p>` : ''}`

  const total = d.overdue.length + d.unassigned.length + d.stale.length + d.unplannedJobs
  const inner = `
    <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">
      ${total === 0
        ? 'Nothing is past due, everything open has an owner, and every job has a plan.'
        : `${d.overdue.length} past due · ${d.unassigned.length} with no owner · ${d.stale.length} untouched for ${d.staleDays}+ days${d.unplannedJobs ? ` · ${d.unplannedJobs} active job${d.unplannedJobs === 1 ? '' : 's'} with no plan at all` : ''}.`}
    </p>
    ${section('Past due', 'The date has gone by.', d.overdue)}
    ${section('Nobody owns these', 'Open, unassigned — they will not move on their own.', d.unassigned)}
    ${section(`Untouched for ${d.staleDays}+ days`, 'No status change, no progress, no note.', d.stale)}
    ${d.unplannedJobs > 0 ? `<p style="margin:24px 0 0;color:#c0392b;font-size:14px;line-height:1.6;"><strong>${d.unplannedJobs}</strong> active job${d.unplannedJobs === 1 ? ' has' : 's have'} no tasks at all. Open the job and press &ldquo;Regenerate plan&rdquo;.</p>` : ''}
    <div style="margin-top:26px;">${cta('Open the status board', `${APP_URL}/admin/engineering`)}</div>`

  const subject = total === 0
    ? 'Engineering: nothing outstanding'
    : `Engineering: ${d.overdue.length} past due, ${d.unassigned.length} unowned`

  const results = await sendAll(to, subject,
    shell('Engineering status', 'The daily roll-up', inner,
      'IAT Portal · Automated daily summary of the engineering board.'))

  const failed = results.filter(r => !r.ok)
  if (failed.length) console.error('[resend] engineering roll-up partial failure:', failed)
  return results
}
