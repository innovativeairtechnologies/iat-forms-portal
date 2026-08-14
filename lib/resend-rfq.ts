import { Resend } from 'resend'
import { EMAIL_FROM } from './email-from'
import type { RfqData } from './rfq'
import { customerTicketEmailsEnabled } from './resend-customer-tickets'

// Sales-desk heads-up when a Request for Quote comes through /support/rfq.
// One email, to the inside-sales desk — the same shape as the support-ticket
// notification (lib/resend-tickets.ts), and deliberately NOT sent to the admin
// roster. The recipient chain (RFQ_NOTIFICATION_EMAIL → SUPPORT_NOTIFICATION_EMAIL
// → the inside-sales default) is resolved by the caller; see app/api/rfq/route.ts
// for why the middle step matters while the sending domain is unverified.
//
// A confirmation IS also sent to the customer (sendRfqConfirmationToCustomer
// below), added 2026-08-14 once dehumidifiers.com verified in Resend. The earlier
// note here said we deliberately sent none, because the sandbox sender could not
// reach a customer anyway and the downloaded PDF was the better artefact. The PDF
// is still the better artefact — but a stranger who has just handed over their
// project details deserves an acknowledgement with a reference number, and the
// address they typed is the only one we can confirm we captured correctly.

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = EMAIL_FROM.PORTAL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function row(label: string, value: string) {
  return `<tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;width:38%;vertical-align:top;">${esc(label)}</td><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#555;vertical-align:top;">${esc(value)}</td></tr>`
}

export type RfqSummary = Record<string, unknown>

export async function sendRfqNotificationToSalesDesk(
  args: { reference: string; data: RfqData; summary: RfqSummary; applicationLabel: string },
  recipients: string[]
) {
  const { reference, data, summary, applicationLabel } = args
  const url = `${APP_URL}/admin/rfq/${encodeURIComponent(reference)}`
  const isRoom = data.track === 'room'

  const headline = isRoom
    ? summary.complete
      ? `${summary.total_lb_per_hr} lb/hr · ${summary.dry_air_cfm} cfm of dry air`
      : 'Room survey — load not yet calculable'
    : summary.complete
      ? `${summary.cfm} cfm to ${summary.leaving_grains} gr/lb (${summary.leaving_dew_point_f}°F dp)`
      : 'Process survey — spec incomplete'

  const detail = isRoom
    ? [
        row('Application', applicationLabel),
        row('Target condition', `${data.targetTempF}°F / ${data.targetRhPct}% rh`),
        row('Room', `${data.roomL} × ${data.roomW} × ${data.roomH} ft`),
        row('Estimated load', String(summary.total_lb_per_hr ?? '—') + ' lb/hr'),
        row('Dry air needed', String(summary.dry_air_cfm ?? '—') + ' cfm'),
        row('Biggest driver', String(summary.dominant ?? '—')),
      ].join('')
    : [
        row('Application', applicationLabel),
        row('Leaving air', `${data.leavingTempF}°F / ${data.leavingGrains} gr/lb`),
        row('Process airflow', `${data.processCfm} cfm`),
        row('Air source', data.airSource),
        row('Water removed', String(summary.lb_per_hr ?? '—') + ' lb/hr'),
      ].join('')

  const body = `
    <div style="background:#f0faf4;border:1px solid rgba(8,148,71,0.25);border-radius:10px;padding:14px 20px;margin-bottom:20px;">
      <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Reference</p>
      <p style="margin:2px 0 6px;color:#089447;font-size:19px;font-weight:700;font-family:monospace;letter-spacing:1px;">${esc(reference)}</p>
      <p style="margin:0;color:#555;font-size:14px;">${esc(headline)}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:18px;">
      ${row('Company', data.company || '—')}
      ${row('Contact', `${data.contactName || '—'} · ${data.email || '—'}${data.phone ? ` · ${data.phone}` : ''}`)}
      ${row('Project', data.projectName || '—')}
      ${row('Location', data.location || '—')}
      ${row('Quote needed by', data.dateRequired || 'Not stated')}
      ${detail}
    </table>
    ${data.purpose ? `<p style="margin:0 0 18px;color:#555;font-size:14px;line-height:1.6;"><strong style="color:#333;">In their words:</strong> ${esc(data.purpose)}</p>` : ''}
    <a href="${esc(url)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Open the full survey</a>`

  const subject = `New RFQ ${reference} — ${data.company || data.contactName || 'Unknown'}${data.projectName ? ` (${data.projectName})` : ''}`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
  <tr><td style="background:#0a2e1e;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Innovative Air Technologies</p>
    <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">New Request for Quote</h1>
    <p style="margin:4px 0 0;color:#96beA8;font-size:13px;">${isRoom ? 'Room dehumidification' : 'Process dehumidification'} · moisture survey</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">${body}</td></tr>
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Portal · Automated notification</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

  const results = await Promise.all(
    recipients.map(to => resend.emails.send({ from: FROM, to, subject, html }))
  )
  results.forEach((r, i) => {
    if (r.error) console.error(`[resend] rfq notification failed to ${recipients[i]}:`, r.error)
    else console.log(`[resend] rfq notification sent to ${recipients[i]}: id=${r.data?.id}`)
  })
}

// ── Confirmation to the customer who submitted the survey ────────────────────
// Gated on the same switch as the ticket confirmations
// (CUSTOMER_TICKET_EMAILS, see lib/resend-customer-tickets.ts). The name is
// historical — that flag now governs every customer-facing send, so one setting
// turns all outbound customer mail on or off together rather than leaving RFQ
// able to mail people while tickets stay silent.
//
// Never throws: the survey is already committed by the time this runs, and a
// failed receipt must not cost us the request.
export async function sendRfqConfirmationToCustomer(
  args: { reference: string; data: RfqData; applicationLabel: string }
): Promise<void> {
  if (!customerTicketEmailsEnabled()) return
  const { reference, data, applicationLabel } = args
  if (!data.email) return

  const greeting = data.contactName ? `Hi ${esc(data.contactName)},` : 'Hello,'
  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;">
      Thanks for sending through your moisture survey. Our team is reviewing it and will follow up
      with a quote. Please keep the reference below for your records.
    </p>
    <div style="background:#f0faf4;border:1px solid rgba(8,148,71,0.25);border-radius:10px;padding:14px 20px;margin-bottom:20px;">
      <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Your reference</p>
      <p style="margin:2px 0 0;color:#089447;font-size:19px;font-weight:700;font-family:monospace;letter-spacing:1px;">${esc(reference)}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:18px;">
      ${row('Application', applicationLabel)}
      ${data.projectName ? row('Project', data.projectName) : ''}
      ${data.company ? row('Company', data.company) : ''}
      ${data.location ? row('Location', data.location) : ''}
      ${data.dateRequired ? row('Quote needed by', data.dateRequired) : ''}
    </table>
    <div style="background:#f0faf4;border:1px solid rgba(8,148,71,0.25);border-radius:10px;padding:18px 20px;margin:24px 0 0;">
      <p style="margin:0 0 12px;color:#333;font-size:14px;line-height:1.6;">
        Anything changed, or something to add? Use the link below so it stays with your request.
      </p>
      <a href="${esc(APP_URL + '/support/status?ticket=' + encodeURIComponent(reference))}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">View your request &amp; send a message</a>
    </div>
    <p style="margin:18px 0 0;color:#999;font-size:12px;line-height:1.5;">
      Please do not reply to this email — it is sent from an unmonitored address and replies are not read.
    </p>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
  <tr><td style="background:#0a2e1e;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Innovative Air Technologies</p>
    <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">We've received your request</h1>
  </td></tr>
  <tr><td style="padding:28px 32px;">${body}</td></tr>
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Portal · Automated confirmation</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

  const result = await resend.emails.send({
    // PORTAL (noreply@) — customer-facing mail never invites a reply; see the
    // note in lib/resend-customer-tickets.ts.
    from: EMAIL_FROM.PORTAL,
    to: data.email,
    subject: `We've received your request — ${reference}`,
    html,
  })
  if (result.error) console.error(`[resend] rfq confirmation failed to ${data.email}:`, result.error)
  else console.log(`[resend] rfq confirmation sent to ${data.email}: id=${result.data?.id}`)
}
