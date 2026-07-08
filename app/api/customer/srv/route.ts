import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerUser } from '@/lib/customer-auth'
import { rateLimit } from '@/lib/rate-limit'
import { sendSubmissionEmail } from '@/lib/resend'
import type { NotificationRule } from '@/lib/supabase'
import { ensureSrvForm, getSrvReview } from '@/lib/srv-form'
import { getSrvSections } from '@/lib/srv-config'
import {
  flattenSrvPayload, validateSrvPayload,
  applicableSections,
  type SrvPayload,
} from '@/lib/srv'

// Interactive SRV submissions from /customer/srv. The payload is the structured
// SrvPayload; it's validated against lib/srv.ts, flattened to label→value, and
// inserted into the shared `submissions` queue so the whole admin side (list,
// detail, print/PDF, notes, notification emails) works unchanged.
//
// Revisions: when a reviewer RETURNS an SRV, the customer reopens it prefilled
// (/customer/srv?resume=<id>) and resubmits with prior_id — the new submission
// carries Revision N+1 and the old one is marked superseded + resolved.

/** Photo values must be uploads from OUR public bucket — they render as <img> in admin. */
function isOurUpload(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  return url.startsWith(`${base}/storage/v1/object/public/form-uploads/`)
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { name: 'srv-submit', max: 10, windowSeconds: 600 })
  if (limited) return limited

  const session = await getCustomerUser()
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as SrvPayload & { prior_id?: string }
    const payload = body as SrvPayload

    if (!payload?.project || !payload?.config || !payload?.sections || !payload?.certification) {
      return NextResponse.json({ error: 'Malformed submission' }, { status: 400 })
    }

    // Validate + flatten against the live (DB-backed) SRV content, so an
    // admin's edits at /admin/srv take effect immediately and consistently.
    const sections = await getSrvSections()
    const problems = validateSrvPayload(payload, sections)
    if (problems.length) {
      return NextResponse.json(
        { error: problems[0], errors: problems.slice(0, 10) },
        { status: 400 }
      )
    }

    // Harden the values that render as media in the admin detail page.
    for (const section of applicableSections(payload.config, sections)) {
      const a = payload.sections[section.key]
      if (!a) continue
      for (const photo of section.photos) {
        const url = a.photos[photo.key]
        if (url && !isOurUpload(url)) {
          return NextResponse.json({ error: `Invalid photo upload for "${photo.label}"` }, { status: 400 })
        }
      }
    }
    const sig = payload.certification.signature
    if (!sig.startsWith('data:image/png;base64,') || sig.length > 500_000) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
    // Free-text length caps (everything else is enum/URL-validated above).
    for (const s of Object.values(payload.sections)) {
      if (s.notes && s.notes.length > 2000) {
        return NextResponse.json({ error: 'Section notes too long' }, { status: 400 })
      }
    }

    // Revision chain: prior must be this customer's own returned SRV.
    let revision = 1
    let prior: { id: string; data: Record<string, unknown> } | null = null
    if (body.prior_id) {
      const { data: p } = await supabaseAdmin
        .from('submissions')
        .select('id, form_id, data')
        .eq('id', body.prior_id)
        .single()
      const ownsPrior =
        p &&
        (p.data?.['_customer_id'] === session.customerId ||
          String(p.data?.['Email Address'] || '').toLowerCase() === (session.user.email || '').toLowerCase())
      if (!ownsPrior) {
        return NextResponse.json({ error: 'Prior submission not found' }, { status: 404 })
      }
      prior = p as { id: string; data: Record<string, unknown> }
      revision = (parseInt(String(prior.data?.['Revision'] || '1'), 10) || 1) + 1
    }

    const ensured = await ensureSrvForm()
    if (!ensured) {
      return NextResponse.json({ error: 'SRV form unavailable — please try again' }, { status: 500 })
    }
    const { form, fields } = ensured

    const data = flattenSrvPayload(payload, sections, { revision })
    // Non-field keys: invisible in the admin detail (it renders form_fields only),
    // but they drive ownership checks and the review workflow.
    data['_customer_id'] = session.customerId
    if (prior) data['_prior_submission_id'] = prior.id

    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .insert({ form_id: form.id, form_title: form.title, data })
      .select()
      .single()

    if (subError || !submission) {
      console.error('[srv] Submission insert failed:', subError)
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    // Supersede the returned submission (best-effort — the new revision is in).
    if (prior) {
      const review = getSrvReview(prior.data) || { decision: 'return' as const, notes: '', at: '', by: '' }
      await supabaseAdmin
        .from('submissions')
        .update({
          status: 'resolved',
          data: { ...prior.data, _review: { ...review, superseded_by: submission.id } },
        })
        .eq('id', prior.id)
    }

    // The server draft served its purpose.
    await supabaseAdmin
      .from('form_drafts')
      .delete()
      .eq('user_id', session.user.id)
      .eq('form_id', form.id)

    // Notification emails — non-blocking, mirrors /api/submit.
    const { data: rules } = await supabaseAdmin
      .from('notification_rules')
      .select('*')
      .eq('form_id', form.id)
      .eq('send_on_submit', true)
    for (const rule of (rules || []) as NotificationRule[]) {
      sendSubmissionEmail(rule, submission, form, fields)
        .then(() => console.log(`[srv] Email sent to ${rule.recipient_email}`))
        .catch((err) => console.error(`[srv] Email to ${rule.recipient_email} failed:`, err))
    }

    console.log(
      `[srv] SRV rev ${revision} received from ${session.customer.company_name} — ` +
      `${sections.length - applicableSections(payload.config, sections).length} sections N/A, ` +
      `result: ${String(data['Overall result'])}`
    )

    return NextResponse.json({ success: true, id: submission.id })
  } catch (err) {
    console.error('[srv] Submit route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
