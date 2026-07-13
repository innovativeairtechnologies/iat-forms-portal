import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isRealDate } from '@/lib/deals'

/* PATCH { done } / DELETE a single follow-up reminder (deal_follow_ups,
   migration 048). requireDealsAuth. */

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireDealsAuth(); if (err) return err
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  if (typeof body.done === 'boolean') patch.done = body.done
  if (typeof body.due_date === 'string') {
    if (!isRealDate(body.due_date)) return NextResponse.json({ error: 'due_date must be a valid YYYY-MM-DD date' }, { status: 400 })
    patch.due_date = body.due_date
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('deal_follow_ups').update(patch).eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Follow-up not found.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireDealsAuth(); if (err) return err
  const { id } = await ctx.params
  const { error } = await supabaseAdmin.from('deal_follow_ups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
