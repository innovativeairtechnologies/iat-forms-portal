import { Resend } from 'resend'
import type { Submission, Form, FormField, NotificationRule } from './supabase'

export const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendSubmissionEmail(
  rule: NotificationRule,
  submission: Submission,
  form: Form,
  fields: FormField[]
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const submissionUrl = `${appUrl}/admin/submissions/${submission.id}`
  const submittedAt = new Date(submission.submitted_at).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const fieldsHtml = fields
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((field) => {
      const value = submission.data[field.label]
      let displayValue = '—'
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          displayValue = value.join(', ')
        } else if (typeof value === 'string' && value.startsWith('data:image')) {
          displayValue = '<em>[Signature captured]</em>'
        } else if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
          displayValue = `<a href="${value}" style="color:#089447;">${value}</a>`
        } else {
          displayValue = String(value)
        }
      }
      return `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;width:35%;vertical-align:top;white-space:nowrap;">${field.label}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#555;vertical-align:top;">${displayValue}</td>
        </tr>`
    })
    .join('')

  const subject = rule.email_subject || `New submission: ${form.title}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
        <tr>
          <td style="background:#1a1a2e;padding:24px 32px;">
            <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Industrial Air Technology</p>
            <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">${form.title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0;color:#888;font-size:14px;">Submitted on <strong style="color:#333;">${submittedAt}</strong></p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
              ${fieldsHtml}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 32px;">
            <a href="${submissionUrl}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">View in Admin Portal</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
            <p style="margin:0;color:#aaa;font-size:12px;">IAT Forms Portal · This is an automated notification</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await resend.emails.send({
    from: 'IAT Forms <noreply@resend.dev>',
    to: rule.recipient_email,
    subject,
    html,
  })
}
