import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeDealField } from '../validate'

const EDITABLE_FIELDS = [
  'customer', 'assigned_to', 'date_quoted', 'status', 'unit_model', 'job_name',
  'total_cost', 'confidence', 'projected', 'rep', 'rep_contact', 'notes', 'group_name',
] as const

// Inline-edit endpoint — the Focused view's patchLocal/persist-on-blur pattern
// (mirrors CustomerPortalCard.tsx) hits this on every cell blur, so it stays a
// partial patch rather than a full-record replace.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireDealsAuth(); if (err) return err
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  for (const f of EDITABLE_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeDealField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    patch[f] = check.value
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // .select('id') so a stale/deleted id is a clean 404, not a silent ok:true —
  // two people work this pipeline, so a row edited in one tab can have been
  // deleted in another.
  const { data, error } = await supabaseAdmin.from('deals').update(patch).eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Deal not found — it may have been deleted.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireDealsAuth(); if (err) return err
  const { id } = await ctx.params
  const { error } = await supabaseAdmin.from('deals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
