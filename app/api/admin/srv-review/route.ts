import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { resend } from '@/lib/resend'
import { logAudit } from '@/lib/audit'
import { SRV_FORM_TITLE } from '@/lib/srv'
import { getSrvReview, type SrvReview } from '@/lib/srv-form'

// Reviewer disposition for an SRV submission: APPROVE (ready — schedule the
// start-up) or RETURN (deficiencies — customer gets an email with the items and
// a link that reopens the SRV prefilled for a revision). State lives under the
// non-field `_review` key in submissions.data so it never renders as a response
// row; the queue status maps approve→resolved, return→in_progress.

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function reviewEmailHtml(opts: {
  decision: 'approve' | 'return'
  projectName: string
  notes: string
  flagged: string[]
  resumeUrl?: string
}): string {
  const items = [
    ...opts.flagged.map((f) => `<li style="margin-bottom:4px;">${escapeHtml(f)}</li>`),
  ].join('')
  const body =
    opts.decision === 'approve'
      ? `<p style="color:#333;line-height:1.6;">Your Start-Up Readiness Verification for <strong>${escapeHtml(opts.projectName)}</strong> has been <strong style="color:#089447;">approved</strong>. IAT will contact you to confirm your start-up date.</p>` +
        (opts.notes ? `<p style="color:#555;line-height:1.6;"><strong>Reviewer notes:</strong><br/>${escapeHtml(opts.notes).replace(/\n/g, '<br/>')}</p>` : '')
      : `<p style="color:#333;line-height:1.6;">Your Start-Up Readiness Verification for <strong>${escapeHtml(opts.projectName)}</strong> was reviewed and <strong style="color:#b45309;">returned</strong> — a few items need attention before start-up can be scheduled.</p>` +
        (opts.notes ? `<p style="color:#555;line-height:1.6;"><strong>What needs attention:</strong><br/>${escapeHtml(opts.notes).replace(/\n/g, '<br/>')}</p>` : '') +
        (items ? `<p style="color:#555;margin-bottom:4px;"><strong>Items you marked as failed:</strong></p><ul style="color:#555;line-height:1.5;margin-top:0;">${items}</ul>` : '') +
        (opts.resumeUrl
          ? `<p style="margin:24px 0;"><a href="${opts.resumeUrl}" style="background:#089447;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">Fix &amp; resubmit — your answers are saved</a></p><p style="color:#888;font-size:12px;">The link reopens your verification with everything filled in — update the flagged items, re-sign, and resubmit.</p>`
          : '')
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1a1a2e;padding:22px 24px;border-radius:10px 10px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:18px;">Start-Up Readiness Verification</h2>
        <p style="color:#9ca3af;margin:6px 0 0;font-size:13px;">${opts.decision === 'approve' ? 'Approved' : 'Returned — action needed'}</p>
      </div>
      <div style="border:1px solid #eee;border-top:0;border-radius:0 0 10px 10px;padding:20px 24px;">
        ${body}
        <p style="color:#999;font-size:12px;margin-top:24px;">Innovative Air Technologies · (770) 788-6744 · www.dehumidifiers.com</p>
      </div>
    </div>`
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await req.json()) as { submission_id?: string; decision?: string; notes?: string }
    const { submission_id, decision } = body
    const notes = (body.notes || '').trim().slice(0, 4000)

    if (!submission_id || (decision !== 'approve' && decision !== 'return')) {
      return NextResponse.json({ error: 'submission_id and decision (approve|return) required' }, { status: 400 })
    }
    if (decision === 'return' && !notes) {
      return NextResponse.json({ error: 'Returning an SRV requires notes — the customer needs to know what to fix.' }, { status: 400 })
    }

    const { data: submission } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submission_id)
      .single()
    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    if (submission.form_title !== SRV_FORM_TITLE) {
      return NextResponse.json({ error: 'Not an SRV submission' }, { status: 400 })
    }
    const existing = getSrvReview(submission.data)
    if (existing?.superseded_by) {
      return NextResponse.json({ error: 'This SRV was superseded by a newer revision — review that one instead.' }, { status: 409 })
    }

    const review: SrvReview = {
      decision,
      notes,
      at: new Date().toISOString(),
      by: admin.displayName || admin.user?.email || 'IAT',
    }

    const { error: upErr } = await supabaseAdmin
      .from('submissions')
      .update({
        status: decision === 'approve' ? 'resolved' : 'in_progress',
        is_read: true,
        data: { ...submission.data, _review: review },
      })
      .eq('id', submission_id)
    if (upErr) {
      console.error('[srv-review] update failed:', upErr)
      return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
    }

    // Email the customer (best-effort — the review state is already saved).
    const to = String(submission.data?.['Email Address'] || '').trim()
    const projectName = String(submission.data?.['Project Name'] || 'your project')
    const flagged = String(submission.data?.['Flagged items'] || '').split('\n').filter(Boolean)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let emailed = false
    if (to) {
      try {
        await resend.emails.send({
          from: 'IAT Forms <onboarding@resend.dev>',
          to,
          subject:
            decision === 'approve'
              ? `SRV approved — ${projectName}`
              : `SRV returned — action needed before start-up (${projectName})`,
          html: reviewEmailHtml({
            decision,
            projectName,
            notes,
            flagged: decision === 'return' ? flagged : [],
            resumeUrl: decision === 'return' ? `${appUrl}/customer/srv?resume=${submission_id}` : undefined,
          }),
        })
        emailed = true
      } catch (err) {
        console.error('[srv-review] customer email failed:', err)
      }
    }

    await logAudit({
      actor: { id: admin.user?.id, name: admin.displayName },
      action: `srv.${decision}`,
      entityType: 'submission',
      entityId: submission_id,
      summary: `SRV ${decision === 'approve' ? 'approved' : 'returned'} — ${projectName}${emailed ? '' : ' (customer email failed)'}`,
      metadata: { notes },
    })

    return NextResponse.json({ ok: true, review, emailed })
  } catch (err) {
    console.error('[srv-review] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
