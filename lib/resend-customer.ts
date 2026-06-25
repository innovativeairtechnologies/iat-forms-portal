import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'IAT Portal <onboarding@resend.dev>'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function shell(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
  <tr><td style="background:#1a1a2e;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:13px;opacity:0.7;letter-spacing:0.05em;text-transform:uppercase;">Innovative Air Technologies</p>
    <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">${title}</h1>
  </td></tr>
  <tr><td style="padding:28px 32px;">${body}</td></tr>
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">IAT Customer Portal · Automated message</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

/**
 * Sends the new customer their temporary login credentials. They sign in at the
 * login URL and are immediately prompted to choose their own password
 * (/customer/welcome enforces it on first login).
 */
export async function sendCustomerWelcomeEmail(opts: {
  to: string
  contactName: string | null
  companyName: string
  tempPassword: string
  loginUrl: string
}) {
  const { to, contactName, companyName, tempPassword, loginUrl } = opts

  const body = `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${contactName ? `Hi ${esc(contactName)},` : 'Hello,'}</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;">
      Innovative Air Technologies has set up a customer portal for <strong>${esc(companyName)}</strong> —
      your home for unit details, build &amp; shipping status, warranty, and support. Sign in with the
      temporary credentials below; you'll choose your own password right after.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;margin-bottom:20px;">
      <tr>
        <td style="padding:11px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;width:42%;">Email</td>
        <td style="padding:11px 16px;border-bottom:1px solid #f0f0f0;color:#555;">${esc(to)}</td>
      </tr>
      <tr>
        <td style="padding:11px 16px;font-weight:600;color:#333;">Temporary password</td>
        <td style="padding:11px 16px;color:#089447;font-family:monospace;font-size:15px;font-weight:700;letter-spacing:0.5px;">${esc(tempPassword)}</td>
      </tr>
    </table>
    <a href="${esc(loginUrl)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;">Sign In</a>
    <p style="margin:22px 0 0;color:#999;font-size:12px;">For your security you'll be asked to set a new password right after signing in. If you weren't expecting this, you can safely ignore this email.</p>`

  const result = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Your IAT Customer Portal is ready',
    html: shell('Your Portal is Ready', body),
  })
  if (result.error) console.error(`[resend] customer welcome failed to ${to}:`, result.error)
  else console.log(`[resend] customer welcome sent to ${to}: id=${result.data?.id}`)
  return result
}

const CONTACT_TO = 'jacob.younker@dehumidifiers.com'

/**
 * Forwards a message from a logged-in customer (the dashboard "Contact Us" form)
 * to the IAT team. The customer's identity is attached server-side, never trusted
 * from the client.
 */
export async function sendCustomerContactEmail(opts: {
  companyName: string
  contactName: string | null
  contactEmail: string
  message: string
}) {
  const { companyName, contactName, contactEmail, message } = opts

  const body = `
    <p style="margin:0 0 4px;color:#333;font-size:15px;">New message from a customer portal user.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;margin:14px 0 18px;">
      <tr>
        <td style="padding:11px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;width:34%;">Company</td>
        <td style="padding:11px 16px;border-bottom:1px solid #f0f0f0;color:#555;">${esc(companyName)}</td>
      </tr>
      <tr>
        <td style="padding:11px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;">Contact</td>
        <td style="padding:11px 16px;border-bottom:1px solid #f0f0f0;color:#555;">${esc(contactName || '—')}</td>
      </tr>
      <tr>
        <td style="padding:11px 16px;font-weight:600;color:#333;">Email</td>
        <td style="padding:11px 16px;color:#555;">${esc(contactEmail || '—')}</td>
      </tr>
    </table>
    <p style="margin:0 0 6px;color:#333;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Message</p>
    <p style="margin:0;color:#333;font-size:15px;line-height:1.55;white-space:pre-wrap;">${esc(message)}</p>`

  const result = await resend.emails.send({
    from: FROM,
    to: CONTACT_TO,
    subject: `Portal message — ${companyName}`,
    html: shell('New Portal Message', body),
  })
  if (result.error) console.error(`[resend] customer contact failed from ${contactEmail}:`, result.error)
  else console.log(`[resend] customer contact sent (${companyName}): id=${result.data?.id}`)
  return result
}
