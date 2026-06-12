import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendSubmissionEmail } from '@/lib/resend'
import { rateLimit } from '@/lib/rate-limit'
import type { Form, FormField, NotificationRule } from '@/lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  return false
}

// Server-side validation backstop. The client (StepFormModal) validates too, but
// embeds and direct POSTs bypass it. Submission data is keyed by field label.
function validateSubmission(fields: FormField[], data: Record<string, unknown>): string[] {
  const errors: string[] = []
  for (const f of fields) {
    if (f.field_type === 'section_header') continue
    const val = data[f.label]
    if (f.is_required && isEmpty(val)) {
      errors.push(`${f.label} is required`)
      continue
    }
    if (isEmpty(val)) continue
    if (f.field_type === 'email' && typeof val === 'string' && !EMAIL_RE.test(val.trim())) {
      errors.push(`${f.label} must be a valid email address`)
    }
    if (f.field_type === 'number' && isNaN(Number(val as string))) {
      errors.push(`${f.label} must be a number`)
    }
  }
  return errors
}

export async function POST(req: NextRequest) {
  // Generous window: a whole office can share one IP (NAT), and kiosk/QR use
  // means several legitimate submissions in a row are normal.
  const limited = await rateLimit(req, { name: 'submit', max: 30, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()
    const { form_id, data } = body

    if (!form_id || !data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Missing form_id or data' }, { status: 400 })
    }

    // Fetch form info
    const { data: form, error: formError } = await supabaseAdmin
      .from('forms')
      .select('*, categories(*)')
      .eq('id', form_id)
      .single()

    if (formError || !form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Reject submissions to drafts/unpublished forms, even by direct form_id.
    if (!form.is_active) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Fetch fields + notification rules (fields are needed to validate the data).
    const [fieldsResult, rulesResult] = await Promise.all([
      supabaseAdmin.from('form_fields').select('*').eq('form_id', form_id).order('sort_order'),
      supabaseAdmin.from('notification_rules').select('*').eq('form_id', form_id).eq('send_on_submit', true),
    ])

    const fields: FormField[] = fieldsResult.data || []
    const rules: NotificationRule[] = rulesResult.data || []

    // Server-side validation (required fields + email/number formats).
    const validationErrors = validateSubmission(fields, data as Record<string, unknown>)
    if (validationErrors.length) {
      return NextResponse.json({ error: validationErrors[0], errors: validationErrors }, { status: 400 })
    }

    // Save submission
    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .insert({ form_id, form_title: form.title, data })
      .select()
      .single()

    if (subError || !submission) {
      console.error('Submission error:', subError)
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    // Send notification emails (non-blocking — submission succeeds even if email fails)
    if (rules.length === 0) {
      console.log(`[submit] No notification rules for form "${form.title}" — no email sent`)
    }
    for (const rule of rules) {
      sendSubmissionEmail(rule, submission, form as Form, fields)
        .then(() => console.log(`[submit] Email sent to ${rule.recipient_email} for "${form.title}"`))
        .catch((err) => console.error(`[submit] Email to ${rule.recipient_email} failed:`, err))
    }

    return NextResponse.json({ success: true, id: submission.id })
  } catch (err) {
    console.error('Submit route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
