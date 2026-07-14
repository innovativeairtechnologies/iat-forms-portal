import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeRole, isStaffRole } from '@/lib/roles'

/* Emails a Duct Traverse Report PDF to a recipient the tech types in.

   The tool lives at /tools/duct-traverse-report.html (gated to signed-in staff by
   middleware). This endpoint is NOT covered by the middleware matcher, so it does
   its OWN auth: any authenticated STAFF role (production → admin) may send; a leaked
   endpoint can't be used anonymously as an open mail relay. The client generates
   the PDF (jsPDF); we only forward it as an attachment via the shared Resend sender. */

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'IAT Portal <onboarding@resend.dev>'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MAX_PDF_B64 = 8_000_000 // ~6MB decoded — a traverse PDF is a few dozen KB

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] as string
  ))
}

export async function POST(req: NextRequest) {
  // ── Auth: signed-in staff only ──────────────────────────────────────────────
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to send reports.' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  const role = normalizeRole(profile?.role)
  if (!isStaffRole(role)) {
    return NextResponse.json({ error: 'Not permitted.' }, { status: 403 })
  }

  // ── Body ────────────────────────────────────────────────────────────────────
  let body: {
    to?: string; filename?: string; pdfBase64?: string
    summary?: {
      projName?: string; projNum?: string; tech?: string; date?: string
      avgVel?: number | null; cfm?: number | null; readings?: number; total?: number
    }
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }) }

  const to = (body.to || '').trim()
  if (!EMAIL_RE.test(to)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })

  const raw = body.pdfBase64 || ''
  if (!raw || raw.length > MAX_PDF_B64) {
    return NextResponse.json({ error: 'Missing or oversized report.' }, { status: 400 })
  }
  // Accept a data: URI or a bare base64 string.
  const b64 = raw.includes('base64,') ? raw.slice(raw.indexOf('base64,') + 7) : raw
  let pdf: Buffer
  try {
    pdf = Buffer.from(b64, 'base64')
    if (pdf.length < 500 || pdf.subarray(0, 4).toString('latin1') !== '%PDF') {
      return NextResponse.json({ error: 'Report is not a valid PDF.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Could not read the report.' }, { status: 400 })
  }

  const s = body.summary || {}
  const filename = (body.filename || 'Duct-Traverse-Report.pdf').replace(/[^\w.\- ]+/g, '-')
  const title = s.projName || s.projNum || 'Duct Traverse Report'
  const subject = `Duct Traverse Report${s.projNum ? ` — ${s.projNum}` : s.projName ? ` — ${s.projName}` : ''}`

  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 16px;border-bottom:1px solid #f0eee9;color:#8A867C;font-size:13px;width:40%;">${esc(k)}</td>` +
    `<td style="padding:8px 16px;border-bottom:1px solid #f0eee9;color:#1F1E1B;font-size:13px;font-weight:600;">${esc(v)}</td></tr>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F7F6F3;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F3;padding:32px 0;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E8E6E1;border-radius:12px;overflow:hidden;max-width:560px;">
      <tr><td style="padding:22px 24px;border-bottom:1px solid #E8E6E1;">
        <p style="margin:0;color:#8A867C;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">Innovative Air Technologies</p>
        <h1 style="margin:4px 0 0;color:#1F1E1B;font-size:20px;font-weight:600;">Duct Traverse Report</h1>
      </td></tr>
      <tr><td style="padding:18px 24px 4px;"><p style="margin:0 0 12px;color:#57544D;font-size:14px;">
        ${esc(s.tech || 'A technician')} shared a duct traverse report${title ? ` for <strong>${esc(title)}</strong>` : ''}. The full report is attached as a PDF.
      </p></td></tr>
      <tr><td style="padding:4px 8px 8px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E6E1;border-radius:8px;overflow:hidden;">
        ${s.projName ? row('Project', s.projName) : ''}
        ${s.projNum ? row('Project #', s.projNum) : ''}
        ${s.date ? row('Date', s.date) : ''}
        ${s.avgVel != null ? row('Average velocity', `${s.avgVel.toLocaleString('en-US')} FPM`) : ''}
        ${s.cfm != null ? row('Airflow', `${s.cfm.toLocaleString('en-US')} CFM`) : ''}
        ${s.readings != null && s.total != null ? row('Readings', `${s.readings} of ${s.total}`) : ''}
      </table></td></tr>
      <tr><td style="padding:16px 24px 24px;background:#FBFAF8;border-top:1px solid #E8E6E1;">
        <p style="margin:0;color:#B3AFA5;font-size:12px;">IAT Portal · Duct Traverse Report · sent by ${esc(user.email || 'IAT staff')}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      reply_to: user.email || undefined,
      subject,
      html,
      attachments: [{ filename, content: pdf }],
    })
    if (error) throw new Error(error.message || 'Resend error')
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Send failed'
    return NextResponse.json({ error: `Could not send the email. ${detail}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
