import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'
import { getAdminUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const err = await requireAdminAuth();if (err) return err
  const { data, error } = await supabaseAdmin
    .from('forms')
    .select('*, categories(*), form_fields(*), notification_rules(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const err = await requireAdminAuth();if (err) return err
  try {
    const body = await req.json()
    const { title, description, category_id, slug, is_active, success_message, fields, notification_rules } = body

    // Snapshot prior active state so we log only genuine activate/pause flips
    // (the form editor's PUT includes is_active on every save).
    let priorForm: { is_active: boolean; title: string | null } | null = null
    if (is_active !== undefined) {
      const { data } = await supabaseAdmin
        .from('forms')
        .select('is_active, title')
        .eq('id', params.id)
        .single()
      priorForm = data as { is_active: boolean; title: string | null } | null
    }

    // Approval gate: a form can only be set active once it has been approved by a
    // super admin. (approval_status / approved_by / approved_at are never settable
    // here — only via POST /api/forms/[id]/approve.)
    if (is_active === true) {
      const { data: current } = await supabaseAdmin
        .from('forms')
        .select('approval_status')
        .eq('id', params.id)
        .single()
      if (current?.approval_status !== 'approved') {
        return NextResponse.json(
          { error: 'This form must be approved by a super admin before it can go live.' },
          { status: 403 }
        )
      }
    }

    const { error: formError } = await supabaseAdmin
      .from('forms')
      .update({ title, description, category_id, slug, is_active, success_message, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (formError) return NextResponse.json({ error: formError.message }, { status: 500 })

    if (fields !== undefined) {
      await supabaseAdmin.from('form_fields').delete().eq('form_id', params.id)
      if (fields.length > 0) {
        const fieldRows = fields.map((f: Record<string, unknown>, i: number) => ({
          form_id: params.id,
          label: f.label,
          field_type: f.field_type,
          placeholder: f.placeholder || null,
          options: f.options || null,
          is_required: f.is_required || false,
          sort_order: i,
        }))
        await supabaseAdmin.from('form_fields').insert(fieldRows)
      }
    }

    if (notification_rules !== undefined) {
      await supabaseAdmin.from('notification_rules').delete().eq('form_id', params.id)
      if (notification_rules.length > 0) {
        const ruleRows = notification_rules.map((r: Record<string, unknown>) => ({
          form_id: params.id,
          recipient_email: r.recipient_email,
          recipient_name: r.recipient_name || null,
          send_on_submit: true,
          email_subject: r.email_subject || null,
        }))
        await supabaseAdmin.from('notification_rules').insert(ruleRows)
      }
    }

    if (is_active !== undefined && priorForm && priorForm.is_active !== is_active) {
      const admin = await getAdminUser()
      await logAudit({
        actor: { id: admin?.user.id, name: admin?.displayName },
        action: is_active ? 'form.activate' : 'form.pause',
        entityType: 'form',
        entityId: params.id,
        summary: `${is_active ? 'Activated' : 'Paused'} form "${priorForm.title || title || 'Untitled form'}"`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update form error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const err = await requireAdminAuth();if (err) return err

  const { data: form } = await supabaseAdmin
    .from('forms')
    .select('title')
    .eq('id', params.id)
    .single()

  const { error } = await supabaseAdmin.from('forms').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = await getAdminUser()
  await logAudit({
    actor: { id: admin?.user.id, name: admin?.displayName },
    action: 'form.delete',
    entityType: 'form',
    entityId: params.id,
    summary: `Deleted form "${form?.title || 'Untitled form'}"`,
  })

  return NextResponse.json({ success: true })
}
