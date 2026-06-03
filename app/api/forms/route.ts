import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'

export async function GET() {
  const err = requireAdminAuth(); if (err) return err
  const { data, error } = await supabaseAdmin
    .from('forms')
    .select('*, categories(*), form_fields(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const err = requireAdminAuth(); if (err) return err
  try {
    const body = await req.json()
    const { title, description, category_id, slug, success_message, fields, notification_rules } = body

    const { data: form, error: formError } = await supabaseAdmin
      .from('forms')
      .insert({ title, description, category_id, slug, success_message })
      .select()
      .single()

    if (formError || !form) {
      return NextResponse.json({ error: formError?.message || 'Failed to create form' }, { status: 500 })
    }

    if (fields && fields.length > 0) {
      const fieldRows = fields.map((f: Record<string, unknown>, i: number) => ({
        form_id: form.id,
        label: f.label,
        field_type: f.field_type,
        placeholder: f.placeholder || null,
        options: f.options || null,
        is_required: f.is_required || false,
        sort_order: i,
      }))
      await supabaseAdmin.from('form_fields').insert(fieldRows)
    }

    if (notification_rules && notification_rules.length > 0) {
      const ruleRows = notification_rules.map((r: Record<string, unknown>) => ({
        form_id: form.id,
        recipient_email: r.recipient_email,
        recipient_name: r.recipient_name || null,
        send_on_submit: true,
        email_subject: r.email_subject || null,
      }))
      await supabaseAdmin.from('notification_rules').insert(ruleRows)
    }

    return NextResponse.json({ success: true, id: form.id })
  } catch (err) {
    console.error('Create form error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
