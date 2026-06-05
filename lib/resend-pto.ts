import { Resend } from 'resend'
import type { Employee, TimeOffRequest } from './supabase'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'IAT Portal <onboarding@resend.dev>'
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/^https?:\/\/https?:\/\//, 'https://')

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
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Portal · Automated notification</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function typeLabel(type: 'pto' | 'sick') {
  return type === 'pto' ? 'PTO' : 'Sick Time'
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Admin notification on new request ─────────────────────────────────────────
export async function sendRequestNotificationToAdmins(
  adminEmails: string[],
  employee: Employee,
  request: TimeOffRequest,
) {
  const insufficient = request.type === 'pto'
    ? request.hours_requested > employee.pto_balance
    : request.hours_requested > employee.sick_balance

  const balance = request.type === 'pto' ? employee.pto_balance : employee.sick_balance
  const label = typeLabel(request.type)
  const reviewUrl = `${APP_URL}/admin/requests`

  const warningBanner = insufficient
    ? `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
        <p style="margin:0;color:#856404;font-weight:600;font-size:14px;">⚠️ Insufficient ${label} Balance</p>
        <p style="margin:4px 0 0;color:#856404;font-size:13px;">${esc(employee.name)} has <strong>${balance} hrs</strong> available but requested <strong>${request.hours_requested} hrs</strong>.</p>
      </div>` : ''

  const body = `
    ${warningBanner}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;width:40%;">Employee</td><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#555;">${esc(employee.name)}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;">Type</td><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#555;">${label}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;">Hours Requested</td><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#555;">${request.hours_requested} hrs</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;">Current Balance</td><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#555;">${balance} hrs</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;">Dates</td><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#555;">${formatDate(request.start_date)} – ${formatDate(request.end_date)}</td></tr>
      ${request.notes ? `<tr><td style="padding:10px 16px;font-weight:600;color:#333;">Notes</td><td style="padding:10px 16px;color:#555;">${esc(request.notes)}</td></tr>` : ''}
    </table>
    <a href="${esc(reviewUrl)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Review Request</a>`

  const subject = insufficient
    ? `⚠️ ${label} Request – Insufficient Balance (${esc(employee.name)})`
    : `New ${label} Request from ${esc(employee.name)}`

  const results = await Promise.all(
    adminEmails.map((to) =>
      resend.emails.send({
        from: FROM,
        to,
        subject,
        html: shell(insufficient ? '#92400e' : '#1a1a2e', `${label} Request`, body),
      })
    )
  )
  results.forEach((r, i) => {
    if (r.error) console.error(`[resend] failed to ${adminEmails[i]}:`, r.error)
    else console.log(`[resend] sent to ${adminEmails[i]}: id=${r.data?.id}`)
  })
}

// ── Employee notification on approval/denial ──────────────────────────────────
export async function sendRequestDecisionToEmployee(
  employee: Employee,
  request: TimeOffRequest,
  decision: 'approved' | 'denied',
) {
  const label = typeLabel(request.type)
  const approved = decision === 'approved'
  const color = approved ? '#089447' : '#dc2626'
  const headerBg = approved ? '#064e23' : '#7f1d1d'

  const body = `
    <p style="margin:0 0 20px;color:#333;font-size:15px;">Hi ${esc(employee.name)},</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;">
      Your ${label} request for <strong>${request.hours_requested} hours</strong>
      (${formatDate(request.start_date)} – ${formatDate(request.end_date)}) has been
      <strong style="color:${color};">${decision}</strong>.
    </p>
    ${approved
      ? `<p style="margin:0 0 20px;color:#555;font-size:14px;">Your updated balance will reflect the deduction shortly.</p>`
      : `<p style="margin:0 0 20px;color:#555;font-size:14px;">If you have questions, please reach out to your manager or HR.</p>`
    }
    <a href="${esc(APP_URL)}/employee/requests" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">View My Requests</a>`

  const result = await resend.emails.send({
    from: FROM,
    to: employee.email,
    subject: `Your ${label} Request Has Been ${approved ? 'Approved' : 'Denied'}`,
    html: shell(headerBg, `${label} Request ${approved ? 'Approved ✓' : 'Denied'}`, body),
  })
  if (result.error) console.error(`[resend] decision email failed to ${employee.email}:`, result.error)
  else console.log(`[resend] decision email sent to ${employee.email}: id=${result.data?.id}`)
}
