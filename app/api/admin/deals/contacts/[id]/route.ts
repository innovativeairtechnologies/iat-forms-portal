import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeContactField } from '../../companies/validate'

const EDITABLE_FIELDS = ['name', 'title', 'email', 'phone', 'is_primary', 'notes'] as const

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireCrmAuth(); if (err) return err
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  for (const f of EDITABLE_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeContactField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    patch[f] = check.value
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from('contacts').update(patch).eq('id', id).select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, contact: data[0] })
}

// DELETE a contact — deals.primary_contact_id goes NULL via the FK.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireCrmAuth(); if (err) return err
  const { id } = await ctx.params
  const { error } = await supabaseAdmin.from('contacts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
