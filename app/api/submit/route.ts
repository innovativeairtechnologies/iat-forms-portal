import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendSubmissionEmail } from '@/lib/resend'
import type { Form, FormField, NotificationRule } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { form_id, data } = body

    if (!form_id || !data) {
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

    // Fetch fields and notification rules in parallel
    const [fieldsResult, rulesResult] = await Promise.all([
      supabaseAdmin.from('form_fields').select('*').eq('form_id', form_id).order('sort_order'),
      supabaseAdmin.from('notification_rules').select('*').eq('form_id', form_id).eq('send_on_submit', true),
    ])

    const fields: FormField[] = fieldsResult.data || []
    const rules: NotificationRule[] = rulesResult.data || []

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
