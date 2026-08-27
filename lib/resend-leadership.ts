import { Resend } from 'resend'
import { EMAIL_FROM, internalFrom } from './email-from'
import type { LeadershipUpdate } from './leadership-update'

// Delivery for the weekly leadership update (lib/leadership-update.ts).
//
// Recipients come from LEADERSHIP_UPDATE_EMAIL (comma-separated) so the list can
// change without a deploy. Unlike the ticket and RFQ senders there is NO
// hardcoded fallback: this is an internal report, and quietly mailing a default
// address because a variable was cleared is worse than not sending at all.

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = internalFrom(EMAIL_FROM.PORTAL)

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function leadershipRecipients(): string[] {
  return (process.env.LEADERSHIP_UPDATE_EMAIL ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)
}

export async function sendLeadershipUpdate(
  update: LeadershipUpdate, docx: Buffer,
): Promise<{ sent: string[]; failed: { to: string; error: string }[] }> {
  const weekly = update.period.kind === 'edition'

  const recipients = leadershipRecipients()
  if (!recipients.length) {
    console.log('[leadership] no LEADERSHIP_UPDATE_EMAIL configured — nothing sent')
    return { sent: [], failed: [] }
  }

  // The email body repeats the first section inline so it is useful on a phone
  // without opening the attachment.
  const lead = update.sections[0]
  const preview = lead
    ? `<p style="margin:0 0 8px;color:#333;font-size:15px;">${esc(lead.title.toLowerCase().replace(/^./, c => c.toUpperCase()))}:</p>
       <ul style="margin:0 0 18px;padding-left:20px;color:#555;font-size:14px;line-height:1.7;">
         ${lead.items.slice(0, 4).map(i => `<li>${esc(i)}</li>`).join('')}
       </ul>`
    : `<p style="margin:0 0 18px;color:#555;font-size:14px;">No portal changes were released ${weekly ? 'this week' : 'in this period'}.</p>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
  <tr><td style="background:#0a2e1e;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Innovative Air Technologies</p>
    <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">IAT Portal &mdash; ${weekly ? 'Weekly' : 'Interim'} Update</h1>
    <p style="margin:4px 0 0;color:#cfd8d3;font-size:13px;">${esc(update.period.label)} &middot; ${esc(update.period.range)}</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
      ${weekly
        ? 'This week&rsquo;s one-page summary of what has changed in the IAT Portal is attached'
        : `A one-page summary of what has changed in the IAT Portal over ${esc(update.period.range)} is attached`} &mdash;
      about a minute to read, everything already live in production.
    </p>
    ${preview}
    <p style="margin:0;color:#888;font-size:13px;">
      The attached document has ${weekly ? 'the full week' : 'the full period'}${update.technical.length
        ? ', in two parts: the summary above, then a longer technical record for whoever has to act on it'
        : ''}.
    </p>
  </td></tr>
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">${weekly
      ? 'IAT Portal &middot; Automated leadership update, Mon/Wed/Fri at 8:30pm Eastern'
      : 'IAT Portal &middot; Interim leadership update &mdash; the regular one still follows Mon/Wed/Fri at 8:30pm Eastern'}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

  // Named by period, not by send date: the report IS the period, and two rebuilds
  // of the same week must not produce two differently-named files.
  //
  // An interim MUST NOT borrow the edition's name. It overlaps a week that is
  // still going to be sent in full on Monday, and two different documents landing
  // in one inbox as IAT-Portal-Edition-8.17.26.docx — the second one longer than
  // the first — is exactly the confusion this send exists to avoid.
  const filename = weekly
    ? `IAT-Portal-Edition-${update.period.id}.docx`
    : `IAT-Portal-Interim-${update.period.id}.docx`

  // ⚠️ ONE AT A TIME, NOT Promise.all. This was the only sender in the codebase
  // firing parallel requests, and the only one carrying an attachment — three
  // simultaneous sends, each with a base64 .docx, against Resend's documented
  // 2-requests-per-second default. A 429 on some of them fails SILENTLY: the
  // function only throws when EVERY send fails, so one success and two rate-limit
  // rejections returned "ok" and two people simply never got the report.
  //
  // The admin digest has always looped with await and has always arrived. Same
  // sender address, same three mailboxes — the difference was the concurrency,
  // not the domain, and not the recipients. Do not "optimise" this back into a
  // Promise.all; the whole job sends three emails three times a week.
  const sent: string[] = []
  const failed: { to: string; error: string }[] = []
  for (const to of recipients) {
    const r = await resend.emails.send({
      from: FROM,
      to,
      subject: `IAT Leadership Update: ${update.period.label} (${update.period.range})`,
      html,
      attachments: [{ filename, content: docx.toString('base64') }],
    })
    if (r.error) {
      // Resend types the response as a discriminated union, so r.error here is
      // always the ErrorResponse object — a string check narrows it to never.
      const error = r.error.message ?? JSON.stringify(r.error)
      console.error(`[leadership] send failed to ${to}:`, r.error)
      failed.push({ to, error })
    } else {
      sent.push(to)
      console.log(`[leadership] sent to ${to}: id=${r.data?.id}`)
    }
  }
  // A PARTIAL failure must be visible too — it is the case that hid for weeks.
  if (!sent.length) {
    throw new Error(`every leadership update send failed: ${failed.map(f => `${f.to} (${f.error})`).join('; ')}`)
  }
  return { sent, failed }
}
