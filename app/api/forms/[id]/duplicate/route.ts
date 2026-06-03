import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'
import { slugify } from '@/lib/utils'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const err = requireAdminAuth(); if (err) return err

  const { data: original, error: fetchError } = await supabaseAdmin
    .from('forms')
    .select('*, form_fields(*), notification_rules(*)')
    .eq('id', params.id)
    .single()

  if (fetchError || !original) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  const baseSlug = slugify(`copy of ${original.title}`)
  let slug = baseSlug
  let attempt = 0
  while (true) {
    const { data: existing } = await supabaseAdmin.from('forms').select('id').eq('slug', slug).single()
    if (!existing) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const { data: newForm, error: formError } = await supabaseAdmin
    .from('forms')
    .insert({
      title: `Copy of ${original.title}`,
      description: original.description,
      category_id: original.category_id,
      slug,
      is_active: false,
      success_message: original.success_message,
    })
    .select()
    .single()

  if (formError || !newForm) {
    return NextResponse.json({ error: 'Failed to duplicate form' }, { status: 500 })
  }

  if (original.form_fields?.length > 0) {
    const fields = original.form_fields.map((f: Record<string, unknown>) => ({
      form_id: newForm.id,
      label: f.label,
      field_type: f.field_type,
      placeholder: f.placeholder,
      options: f.options,
      is_required: f.is_required,
      sort_order: f.sort_order,
    }))
    await supabaseAdmin.from('form_fields').insert(fields)
  }

  if (original.notification_rules?.length > 0) {
    const rules = original.notification_rules.map((r: Record<string, unknown>) => ({
      form_id: newForm.id,
      recipient_email: r.recipient_email,
      recipient_name: r.recipient_name,
      send_on_submit: r.send_on_submit,
      email_subject: r.email_subject,
    }))
    await supabaseAdmin.from('notification_rules').insert(rules)
  }

  return NextResponse.json({ success: true, id: newForm.id, slug: newForm.slug })
}
