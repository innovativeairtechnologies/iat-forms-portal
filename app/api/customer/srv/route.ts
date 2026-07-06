import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerUser } from '@/lib/customer-auth'
import { rateLimit } from '@/lib/rate-limit'
import { sendSubmissionEmail } from '@/lib/resend'
import type { Form, FormField, NotificationRule } from '@/lib/supabase'
import {
  SRV_FORM_SLUG, SRV_FORM_TITLE, SRV_FORM_DESCRIPTION, SRV_FORM_CATEGORY,
  srvFormFieldDefs, flattenSrvPayload, validateSrvPayload,
  SRV_SECTIONS, applicableSections,
  type SrvPayload,
} from '@/lib/srv'

// Interactive SRV submissions from /customer/srv. The payload is the structured
// SrvPayload; it's validated against lib/srv.ts, flattened to label→value, and
// inserted into the shared `submissions` queue so the whole admin side (list,
// detail, print/PDF, notes, notification emails) works unchanged.

const SRV_NOTIFY_FALLBACK = 'jacob.younker@dehumidifiers.com'

/**
 * Find-or-create the SRV form row and keep its form_fields in sync with
 * lib/srv.ts (the admin detail page renders a submission by iterating its
 * form's fields, so they must exactly match the flattened labels). The form
 * stays is_active=false: /customer/srv is the only entry point.
 */
async function ensureSrvForm(): Promise<{ form: Form; fields: FormField[] } | null> {
  let { data: form } = await supabaseAdmin
    .from('forms')
    .select('*')
    .eq('slug', SRV_FORM_SLUG)
    .single()

  if (!form) {
    // Category is best-effort — the form is functional without one.
    const { data: cat } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('name', SRV_FORM_CATEGORY)
      .single()

    const { data: created, error } = await supabaseAdmin
      .from('forms')
      .insert({
        title: SRV_FORM_TITLE,
        description: SRV_FORM_DESCRIPTION,
        slug: SRV_FORM_SLUG,
        category_id: cat?.id ?? null,
        is_active: false,
        success_message: 'Thank you. Your Start-Up Readiness Verification has been received.',
      })
      .select()
      .single()
    if (error || !created) {
      console.error('[srv] Failed to create SRV form:', error)
      return null
    }
    form = created
  }

  // An SRV landing silently would stall a start-up — if the form has NO
  // notification rules at all, seed the default. Admin-edited rules are
  // untouched (we only act on zero).
  const { count: ruleCount } = await supabaseAdmin
    .from('notification_rules')
    .select('*', { count: 'exact', head: true })
    .eq('form_id', form.id)
  if ((ruleCount ?? 0) === 0) {
    await supabaseAdmin.from('notification_rules').insert({
      form_id: form.id,
      recipient_email: SRV_NOTIFY_FALLBACK,
      recipient_name: 'IAT Service',
      send_on_submit: true,
      email_subject: 'New Start-Up Readiness Verification (SRV)',
    })
  }

  const expected = srvFormFieldDefs()
  const { data: existing } = await supabaseAdmin
    .from('form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('sort_order')

  const projection = (rows: Array<{ label: string; field_type: string; options: string[] | null; is_required: boolean }>) =>
    JSON.stringify(rows.map((f) => [f.label, f.field_type, f.options ?? null, f.is_required]))

  if (projection(existing || []) !== projection(expected)) {
    // Content model changed (or the old draft's fields are still there) — replace
    // wholesale. Submission data is denormalized by label, so history is safe.
    if (existing?.length) {
      await supabaseAdmin.from('form_fields').delete().eq('form_id', form.id)
    }
    const { error } = await supabaseAdmin.from('form_fields').insert(
      expected.map((f, i) => ({
        form_id: form!.id,
        label: f.label,
        field_type: f.field_type,
        placeholder: f.placeholder,
        options: f.options,
        is_required: f.is_required,
        sort_order: i,
      }))
    )
    if (error) console.error('[srv] Field sync failed:', error)
    // Title/description drift too when the model changes.
    await supabaseAdmin
      .from('forms')
      .update({ title: SRV_FORM_TITLE, description: SRV_FORM_DESCRIPTION })
      .eq('id', form.id)
  }

  const { data: fields } = await supabaseAdmin
    .from('form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('sort_order')

  return { form: form as Form, fields: (fields || []) as FormField[] }
}

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
    const payload = (await req.json()) as SrvPayload

    if (!payload?.project || !payload?.config || !payload?.sections || !payload?.certification) {
      return NextResponse.json({ error: 'Malformed submission' }, { status: 400 })
    }

    const problems = validateSrvPayload(payload)
    if (problems.length) {
      return NextResponse.json(
        { error: problems[0], errors: problems.slice(0, 10) },
        { status: 400 }
      )
    }

    // Harden the values that render as media in the admin detail page.
    for (const section of applicableSections(payload.config)) {
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

    const ensured = await ensureSrvForm()
    if (!ensured) {
      return NextResponse.json({ error: 'SRV form unavailable — please try again' }, { status: 500 })
    }
    const { form, fields } = ensured

    const data = flattenSrvPayload(payload)

    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .insert({ form_id: form.id, form_title: form.title, data })
      .select()
      .single()

    if (subError || !submission) {
      console.error('[srv] Submission insert failed:', subError)
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

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
      `[srv] SRV received from ${session.customer.company_name} — ` +
      `${SRV_SECTIONS.length - applicableSections(payload.config).length} sections N/A, ` +
      `result: ${String(data['Overall result'])}`
    )

    return NextResponse.json({ success: true, id: submission.id })
  } catch (err) {
    console.error('[srv] Submit route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
