import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireToolCribAuth, requireCribActor } from '@/lib/api-auth'
import { cribErrorMessage } from '@/lib/tool-crib'

/* Manager custody overrides: force-return a stuck tool, or hand custody to
   someone else without a physical trip to the crib.

   The escape hatch matters more than it looks. Without it, a tool held by
   someone who quit is stuck checked-out forever and the only fix is editing the
   database by hand — which is exactly how people stop trusting the numbers.

   Both actions REQUIRE a reason and are logged with the acting manager's name
   (enforced again in the SQL functions), so a forced return can never be
   laundered into looking like the employee quietly brought it back themselves. */

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireToolCribAuth(); if (err) return err
  const { id } = await params

  const actor = await requireCribActor()
  if (actor instanceof NextResponse) return actor

  const body = await req.json().catch(() => null)
  const action = body?.action
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  if (action !== 'force_check_in' && action !== 'transfer') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required.' }, { status: 400 })
  }

  const { data: tool } = await supabaseAdmin
    .from('crib_tools').select('tag_code').eq('id', id).single()
  if (!tool) return NextResponse.json({ error: 'No such tool.' }, { status: 404 })

  let rpcErr
  if (action === 'force_check_in') {
    ({ error: rpcErr } = await supabaseAdmin.rpc('crib_force_check_in', {
      p_tag: tool.tag_code,
      p_actor: actor.actorId,
      p_reason: reason.slice(0, 500),
    }))
  } else {
    const to = typeof body?.to === 'string' ? body.to : ''
    if (!to) return NextResponse.json({ error: 'Pick who it’s going to.' }, { status: 400 })

    // The recipient must be a real, active employee — held_by FKs to employees,
    // and handing a tool to a deactivated account creates custody that nobody
    // can clear by scanning.
    const { data: recipient } = await supabaseAdmin
      .from('employees').select('id, is_active').eq('id', to).single()
    if (!recipient || recipient.is_active === false) {
      return NextResponse.json({ error: 'That person can’t hold tools.' }, { status: 400 })
    }

    ;({ error: rpcErr } = await supabaseAdmin.rpc('crib_transfer', {
      p_tag: tool.tag_code,
      p_actor: actor.actorId,
      p_to: to,
      p_reason: reason.slice(0, 500),
    }))
  }

  if (rpcErr) {
    const { message, known } = cribErrorMessage(rpcErr)
    if (!known) console.error('[tool-crib/custody] rpc error:', rpcErr)
    return NextResponse.json({ error: message }, { status: known ? 409 : 500 })
  }

  return NextResponse.json({ ok: true })
}
