import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireCribActor } from '@/lib/api-auth'
import { normalizeTagCode, cribErrorMessage } from '@/lib/tool-crib'

/* THE shared write path for both scan routes.

   Path A (the phone's own Camera app → /t/<code> → tool page → one button) and
   Path B (the in-app continuous scanner) both post here. One endpoint means one
   set of rules, one guard, and no chance of the two paths drifting apart.

   The actor is resolved from the SESSION COOKIE, never from the request body —
   that's what makes "who took it" trustworthy rather than self-reported. */

type Action = 'check_out' | 'check_in'

export async function POST(req: NextRequest) {
  const actor = await requireCribActor()
  if (actor instanceof NextResponse) return actor

  const body = await req.json().catch(() => null)
  const action: Action = body?.action
  if (action !== 'check_out' && action !== 'check_in') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  // Accepts a typed code, a bare number, or a whole scanned URL.
  const code = normalizeTagCode(body?.code)
  if (!code) return NextResponse.json({ error: 'That doesn’t look like a tool code.' }, { status: 400 })

  const note = typeof body?.condition_note === 'string' ? body.condition_note.trim().slice(0, 500) : null

  const rpc = action === 'check_out'
    ? supabaseAdmin.rpc('crib_check_out', { p_tag: code, p_actor: actor.actorId })
    : supabaseAdmin.rpc('crib_check_in', { p_tag: code, p_actor: actor.actorId, p_condition_note: note || null })

  const { data, error } = await rpc

  if (error) {
    const { message, known } = cribErrorMessage(error)
    if (!known) console.error('[tool-crib/scan] rpc error:', error)

    // The sentinel errors are all "you can't do that right now", not failures.
    // Enrich the common one with WHO has it — "someone already has this" is
    // useless on a shop floor; "Dave has it" is actionable.
    if (known && action === 'check_out') {
      const { data: tool } = await supabaseAdmin
        .from('crib_tools')
        .select('name, status, holder:employees!crib_tools_held_by_fkey(name)')
        .eq('tag_code', code)
        .single()

      if (!tool) {
        return NextResponse.json({ error: 'No tool with that code.' }, { status: 404 })
      }
      const holder = (tool as any).holder?.name
      const detail =
        tool.status === 'checked_out'
          ? (holder ? `${holder} has this one.` : 'Someone already has this one.')
          : `That tool is marked ${String(tool.status).replace('_', ' ')}.`
      return NextResponse.json({ error: detail, tool_name: tool.name }, { status: 409 })
    }

    return NextResponse.json({ error: message }, { status: known ? 409 : 500 })
  }

  // The RPC returns the tool row it acted on.
  const tool = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    ok: true,
    action,
    tag_code: code,
    name: tool?.name ?? null,
    status: tool?.status ?? null,
  })
}
