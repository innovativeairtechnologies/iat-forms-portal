import { Resend } from 'resend'
import { EMAIL_FROM } from './email-from'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = EMAIL_FROM.PORTAL

// All portal "Contact Us" / support-facing messages route here for now; the
// chosen department (or automated context) is carried in the subject/body so
// they can be split to per-department inboxes later.
const CONTACT_TO = 'iatsupport@dehumidifiers.com'

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
  const kbUrl = `${new URL(loginUrl).origin}/support/kb`

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
    <p style="margin:20px 0 0;color:#333;font-size:14px;line-height:1.6;">
      Once you're in, you'll see your equipment, build &amp; shipping status, and can submit a
      support or warranty request any time — no need to call or email first.
    </p>
    <p style="margin:14px 0 0;color:#333;font-size:14px;line-height:1.6;">
      Questions before then? Reach us at <a href="mailto:${CONTACT_TO}" style="color:#089447;">${CONTACT_TO}</a>
      or browse the <a href="${esc(kbUrl)}" style="color:#089447;">knowledge base</a>.
    </p>
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

/**
 * Forwards a message from a logged-in customer (the dashboard "Contact Us" form)
 * to the IAT team, tagged with the department the customer chose. The customer's
 * identity is attached server-side, never trusted from the client.
 */
export async function sendCustomerContactEmail(opts: {
  companyName: string
  contactName: string | null
  contactEmail: string
  department: string
  message: string
}) {
  const { companyName, contactName, contactEmail, department, message } = opts

  const body = `
    <p style="margin:0 0 4px;color:#333;font-size:15px;">New message from a customer portal user.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;margin:14px 0 18px;">
      <tr>
        <td style="padding:11px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;width:34%;">Department</td>
        <td style="padding:11px 16px;border-bottom:1px solid #f0f0f0;color:#089447;font-weight:600;">${esc(department)}</td>
      </tr>
      <tr>
        <td style="padding:11px 16px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#333;">Company</td>
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
    subject: `[${department}] Portal message — ${companyName}`,
    html: shell('New Portal Message', body),
  })
  if (result.error) console.error(`[resend] customer contact failed from ${contactEmail}:`, result.error)
  else console.log(`[resend] customer contact sent (${companyName}, ${department}): id=${result.data?.id}`)
  return result
}

/**
 * Tells a customer the outcome of a warranty claim they filed from /customer
 * (WarrantySubmitModal → /api/customer/warranty-requests). Approved claims
 * link back into the portal so they can track the resulting ticket; denied
 * claims state the reason (if one was given) plainly and point them at
 * Contact Us / Submit a request if they have questions.
 */
export async function sendWarrantyDecisionEmail(opts: {
  to: string
  contactName: string | null
  companyName: string
  serialNumber: string
  outcome: 'approved' | 'denied'
  ticketNumber?: string   // present when approved
  denyReason?: string     // present when denied
  appUrl: string          // origin to link back into the portal
}) {
  const { to, contactName, companyName, serialNumber, outcome, ticketNumber, denyReason, appUrl } = opts
  const portalUrl = `${appUrl}/customer`
  const greeting = contactName ? `Hi ${esc(contactName)},` : 'Hello,'

  const body =
    outcome === 'approved'
      ? `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;">
      Good news — the warranty claim you filed for unit <strong>${esc(serialNumber)}</strong> has been
      <strong style="color:#089447;">approved</strong>. We've opened ticket
      ${ticketNumber ? `<strong>${esc(ticketNumber)}</strong>` : 'a support ticket'} to handle it from here.
    </p>
    <a href="${esc(portalUrl)}" style="display:inline-block;background:#089447;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;">Track it in the portal</a>
    <p style="margin:20px 0 0;color:#333;font-size:14px;line-height:1.6;">
      Our team will be in touch with next steps. You can follow along or add details any time from
      <strong>My Requests</strong> in the portal.
    </p>
    <p style="margin:14px 0 0;color:#333;font-size:14px;line-height:1.6;">
      Questions in the meantime? Reach us at <a href="mailto:${CONTACT_TO}" style="color:#089447;">${CONTACT_TO}</a>.
    </p>`
      : `
    <p style="margin:0 0 16px;color:#333;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;">
      We've reviewed the warranty claim you filed for unit <strong>${esc(serialNumber)}</strong> for
      <strong>${esc(companyName)}</strong>. Unfortunately, we're not able to approve it as a warranty claim.
    </p>
    ${denyReason
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;margin-bottom:20px;">
      <tr>
        <td style="padding:11px 16px;font-weight:600;color:#333;width:34%;">Reason</td>
        <td style="padding:11px 16px;color:#555;">${esc(denyReason)}</td>
      </tr>
    </table>`
      : ''}
    <p style="margin:0 0 0;color:#333;font-size:14px;line-height:1.6;">
      If you'd still like help with this unit, please submit a support request or reach out to
      <a href="mailto:${CONTACT_TO}" style="color:#089447;">${CONTACT_TO}</a> and we'll be glad to take a look.
    </p>
    <a href="${esc(portalUrl)}" style="display:inline-block;margin-top:16px;background:#089447;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;">Go to the portal</a>`

  const result = await resend.emails.send({
    from: FROM,
    to,
    subject: outcome === 'approved' ? `Warranty claim approved — ${serialNumber}` : `Update on your warranty claim — ${serialNumber}`,
    html: shell(outcome === 'approved' ? 'Warranty Claim Approved' : 'Warranty Claim Update', body),
  })
  if (result.error) console.error(`[resend] warranty decision (${outcome}) failed to ${to}:`, result.error)
  else console.log(`[resend] warranty decision (${outcome}) sent to ${to}: id=${result.data?.id}`)
  return result
}
