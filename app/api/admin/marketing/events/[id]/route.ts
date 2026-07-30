import { NextRequest, NextResponse } from 'next/server'
import { requireMarketingAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildEventPatch, isMissingTable, MIGRATION_HINT } from '../../validate'

/* PATCH (partial — only the keys sent are touched) / DELETE a single marketing
   calendar event (marketing_events, migration 071). requireMarketingAuth, the
   same trust boundary as the create route. */

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMarketingAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const { values, error: invalid } = buildEventPatch(body)
  if (invalid || !values) {
    return NextResponse.json({ error: invalid ?? 'Nothing to update.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('marketing_events')
    .update(values)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'That event no longer exists.' }, { status: 404 })
  return NextResponse.json({ ok: true, event: data })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMarketingAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await ctx.params
  const { error } = await supabaseAdmin.from('marketing_events').delete().eq('id', id)
  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
