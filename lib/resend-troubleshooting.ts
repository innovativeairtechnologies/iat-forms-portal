import { Resend } from 'resend'
import type { TroubleshootingIntake } from './supabase'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'IAT Support <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://iatportal.vercel.app')

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function shell(headerBg: string, title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
  <tr><td style="background:${headerBg};padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Innovative Air Technologies</p>
    <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">${title}</h1>
  </td></tr>
  <tr><td style="padding:28px 32px;">${body}</td></tr>
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Support · Automated notification</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function row(label: string, value: string) {
  return `<tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;width:38%;vertical-align:top;">${label}</td><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#555;vertical-align:top;">${value}</td></tr>`
}

function refChip(reference: string) {
  return `<div style="background:#f0faf4;border:1px solid rgba(8,148,71,0.25);border-radius:10px;padding:12px 20px;margin-bottom:20px;display:inline-block;">
    <p style="margin:0;color:#888;font-size:11px;">Reference number</p>
    <p style="margin:2px 0 0;color:#089447;font-size:19px;font-weight:700;font-family:monospace;letter-spacing:1px;">${esc(reference)}</p>
  </div>`
}

function aiRecsBlock(recs: string[] | null) {
  if (!recs?.length) return ''
  return `
    <p style="margin:24px 0 8px;font-weight:600;color:#333;font-size:14px;">💡 While you wait, try these steps:</p>
    <ol style="margin:0 0 6px;padding-left:20px;color:#555;font-size:14px;line-height:1.6;">
      ${recs.map(r => `<li style="margin-bottom:6px;">${esc(r)}</li>`).join('')}
    </ol>
    <p style="margin:0;color:#999;font-size:12px;">These are AI-generated suggestions — if you're unsure, wait for your service technician.</p>`
}

const yn = (v: boolean | null) => (v === true ? 'Yes' : v === false ? 'No' : 'Not reported')
const tri = (v: string | null) =>
  v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'unsure' ? 'Unsure' : 'Not reported'
const onsetLabel = (v: string | null) =>
  v === 'sudden' ? 'Sudden' : v === 'gradual' ? 'Gradual' : v === 'unsure' ? 'Unsure' : 'Not reported'

// Full diagnostic detail — used in the CS alert so the team can act from the email.
function diagnosticRows(t: TroubleshootingIntake) {
  const rows: string[] = [
    row('Serial #', esc(t.serial_number)),
    t.model_number ? row('Model #', esc(t.model_number)) : '',
    t.voltage ? row('Voltage', esc(t.voltage)) : '',
    row('Problem', esc(t.problem_description)),
    t.problem_started ? row('When it started', esc(t.problem_started)) : '',
    row('Onset', onsetLabel(t.onset)),
    t.what_changed ? row('Changed before', esc(t.what_changed)) : '',
    row('Unit running', yn(t.unit_running)),
    row('Active alarms', yn(t.has_alarms) + (t.alarm_details ? ` — ${esc(t.alarm_details)}` : '')),
    row('Process airflow', t.process_airflow_cfm ? `${esc(t.process_airflow_cfm)} CFM` : 'Not reported'),
    row('React airflow', t.react_airflow_cfm ? `${esc(t.react_airflow_cfm)} CFM` : 'Not reported'),
    row('React temp', t.react_temp_f ? `${esc(t.react_temp_f)} °F` : 'Not reported'),
    row('Wheel rotating', tri(t.wheel_rotating)),
    row('Seal light leakage', tri(t.seal_light_leakage)),
    row('External factors', t.external_factors?.length ? esc(t.external_factors.join(', ')) : 'None reported'),
  ]
  return rows.filter(Boolean).join('')
}

function photosBlock(urls: string[] | null) {
  if (!urls?.length) return ''
  const links = urls.map((u, i) => `<a href="${esc(u)}" style="color:#089447;">Photo ${i + 1}</a>`).join(' · ')
  return `<p style="margin:18px 0 0;color:#555;font-size:14px;"><strong style="color:#333;">Photos:</strong> ${links}</p>`
}

// ── Customer confirmation ─────────────────────────────────────────────────────
export async function sendTroubleshootingConfirmationToCustomer(t: TroubleshootingIntake) {
  const statusUrl = `${APP_URL}/support/status?ticket=${encodeURIComponent(t.reference_number)}`

  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi ${esc(t.customer_name)},</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;">
      Thanks for completing the troubleshooting checklist. An IAT engineer will review your answers and reach out within <strong>1 business day</strong>.
    </p>
    ${refChip(t.reference_number)}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:4px;">
      ${row('Serial #', esc(t.serial_number))}
      ${t.model_number ? row('Model #', esc(t.model_number)) : ''}
      ${row('Reported issue', esc(t.problem_description))}
    </table>
    ${aiRecsBlock(t.ai_recommendations)}
    <a href="${esc(statusUrl)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-top:20px;">Check Status</a>
    <p style="margin:10px 0 0;color:#999;font-size:12px;">You'll need this email address (${esc(t.customer_email)}) to look up your reference.</p>`

  const result = await resend.emails.send({
    from: FROM,
    to: t.customer_email,
    subject: `IAT Support — Checklist ${t.reference_number} received`,
    html: shell('#1a1a2e', 'Checklist Received', body),
  })
  if (result.error) console.error(`[resend] troubleshooting confirmation failed to ${t.customer_email}:`, result.error)
  else console.log(`[resend] troubleshooting confirmation sent to ${t.customer_email}: id=${result.data?.id}`)
}

// ── CS team alert (email carries the full case — no admin detail page yet) ─────
export async function sendTroubleshootingCsAlert(t: TroubleshootingIntake, recipients: string[]) {
  if (!recipients.length) {
    console.log('[resend] no CS recipients configured — troubleshooting alert skipped')
    return
  }

  const body = `
    ${refChip(t.reference_number)}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:4px;">
      ${row('Customer', esc(t.customer_name))}
      ${t.customer_company ? row('Company', esc(t.customer_company)) : ''}
      ${row('Email', esc(t.customer_email))}
      ${t.customer_phone ? row('Phone', esc(t.customer_phone)) : ''}
      ${diagnosticRows(t)}
    </table>
    ${photosBlock(t.photo_urls)}
    ${aiRecsBlock(t.ai_recommendations)}
    <p style="margin:20px 0 0;color:#999;font-size:12px;">Manage this case in the <a href="${esc(APP_URL + '/admin/troubleshooting')}" style="color:#089447;">admin Troubleshooting queue</a> — this email carries the full case for quick reference.</p>`

  const subject = `New Troubleshooting Case ${t.reference_number} — ${t.customer_name}${t.customer_company ? ` (${t.customer_company})` : ''}`

  const results = await Promise.all(
    recipients.map(to => resend.emails.send({ from: FROM, to, subject, html: shell('#1a1a2e', 'New Troubleshooting Case', body) }))
  )
  results.forEach((r, i) => {
    if (r.error) console.error(`[resend] troubleshooting alert failed to ${recipients[i]}:`, r.error)
    else console.log(`[resend] troubleshooting alert sent to ${recipients[i]}: id=${r.data?.id}`)
  })
}
