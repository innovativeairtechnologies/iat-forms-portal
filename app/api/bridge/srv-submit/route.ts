import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { sendSubmissionEmail } from '@/lib/resend'
import type { NotificationRule } from '@/lib/supabase'
import { ensureSrvForm, getSrvReview } from '@/lib/srv-form'
import { getSrvSections } from '@/lib/srv-config'
import { flattenSrvPayload, validateSrvPayload, applicableSections, type SrvPayload } from '@/lib/srv'

export const dynamic = 'force-dynamic'

/**
 * Bridge: submit (or revise) an SRV from the customer portal.
 *
 * Reproduces app/api/customer/srv exactly — validate against the LIVE sections,
 * harden media, flatten label→value, insert into the shared `submissions` queue,
 * supersede a returned prior, and fire notification emails. Everything happens
 * on this side so the whole admin surface (list, detail, print/PDF, notes,
 * emails) keeps working unchanged, and `submissions` — which is commingled with
 * every internal and public form response — never has to be exposed.
 *
 * The one difference from the internal route: it deletes the internal
 * form_drafts row on success. The split portal keeps its drafts in the CUSTOMER
 * database, so there is nothing to clean up here — that's the customer app's job.
 */

/** Photo values must be uploads from OUR public bucket — they render as <img>
 *  in the admin detail. Identical to the internal route's check. */
function isOurUpload(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  return url.startsWith(`${base}/storage/v1/object/public/form-uploads/`)
}

export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/srv-submit')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  if (!customerId) return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })

  const payload = auth.body.payload as SrvPayload | undefined
  const priorId = requireString(auth.body, 'priorId')

  if (!payload?.project || !payload?.config || !payload?.sections || !payload?.certification) {
    return NextResponse.json({ error: 'Malformed submission' }, { status: 400 })
  }

  try {
    const sections = await getSrvSections()
    const problems = validateSrvPayload(payload, sections)
    if (problems.length) {
      return NextResponse.json({ error: problems[0], errors: problems.slice(0, 10) }, { status: 400 })
    }

    // Harden everything that renders as media on the admin side.
    for (const section of applicableSections(payload.config, sections)) {
      const a = payload.sections[section.key]
      if (!a) continue
      for (const photo of section.photos) {
        const url = a.photos[photo.key]
        if (url && !isOurUpload(url)) {
          return NextResponse.json({ error: `Invalid photo upload for "${photo.label}"` }, { status: 400 })
        }
      }
      for (const url of Object.values(a.failPhotos || {})) {
        if (url && !isOurUpload(url)) {
          return NextResponse.json({ error: 'Invalid failure-photo upload' }, { status: 400 })
        }
      }
    }

    // The signature travels INLINE as a data URL inside the payload — it is not a
    // storage upload, so it gets its own shape + size check.
    const sig = payload.certification.signature
    if (!sig.startsWith('data:image/png;base64,') || sig.length > 500_000) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    for (const s of Object.values(payload.sections)) {
      if (s.notes && s.notes.length > 2000) {
        return NextResponse.json({ error: 'Section notes too long' }, { status: 400 })
      }
    }

    // Revision chain — the prior must be THIS customer's own returned SRV.
    // Ownership is checked against data._customer_id here; the internal route
    // also allows an email match, which this side deliberately drops (same
    // narrowing as the other bridges: no caller-supplied email is trusted).
    let revision = 1
    let prior: { id: string; data: Record<string, unknown> } | null = null
    if (priorId) {
      const { data: p } = await supabaseAdmin
        .from('submissions')
        .select('id, data')
        .eq('id', priorId)
        .single()
      if (!p || p.data?.['_customer_id'] !== customerId) {
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
    data['_customer_id'] = customerId
    if (prior) data['_prior_submission_id'] = prior.id

    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .insert({ form_id: form.id, form_title: form.title, data })
      .select()
      .single()

    if (subError || !submission) {
      console.error('[bridge/srv-submit] insert failed:', subError)
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    // Supersede the returned submission — best-effort, the new revision is in.
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

    // Notification emails — non-blocking, mirrors /api/submit.
    const { data: rules } = await supabaseAdmin
      .from('notification_rules')
      .select('*')
      .eq('form_id', form.id)
      .eq('send_on_submit', true)
    for (const rule of (rules || []) as NotificationRule[]) {
      sendSubmissionEmail(rule, submission, form, fields)
        .then(() => console.log(`[bridge/srv-submit] email sent to ${rule.recipient_email}`))
        .catch((err) => console.error(`[bridge/srv-submit] email failed:`, err))
    }

    return NextResponse.json({ success: true, id: submission.id, revision })
  } catch (err) {
    console.error('[bridge/srv-submit] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
