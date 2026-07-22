import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireToolCribAuth, requireCribActor } from '@/lib/api-auth'
import { cribErrorMessage } from '@/lib/tool-crib'
import { isCustomer } from '@/lib/staff'

/* Assign every assignable tool to one person in a single transaction — the
   "he isn't scanning them out, just put them all on him" button.

   By default only AVAILABLE tools are assigned. include_held also sweeps up tools
   currently checked out to OTHER people (a heavier hammer — it yanks custody), so
   it's opt-in. maintenance/lost/retired are always skipped. All-or-nothing: if
   any single assign fails the whole batch rolls back (crib_assign_all is one
   transaction). */

export async function POST(req: NextRequest) {
  const err = await requireToolCribAuth(); if (err) return err

  const actor = await requireCribActor()
  if (actor instanceof NextResponse) return actor

  const body = await req.json().catch(() => null)
  const to = typeof body?.to === 'string' ? body.to : ''
  const includeHeld = body?.include_held === true
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  if (!to) return NextResponse.json({ error: 'Pick who to assign to.' }, { status: 400 })

  // Same recipient guard as the per-tool custody route.
  const [{ data: recipient }, recipientIsCustomer] = await Promise.all([
    supabaseAdmin.from('employees').select('id, is_active').eq('id', to).single(),
    isCustomer(to),
  ])
  if (!recipient || recipient.is_active === false || recipientIsCustomer) {
    return NextResponse.json({ error: 'That person can’t hold tools.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.rpc('crib_assign_all', {
    p_actor: actor.actorId,
    p_to: to,
    p_reason: reason ? reason.slice(0, 500) : null,
    p_include_held: includeHeld,
  })

  if (error) {
    const { message, known } = cribErrorMessage(error)
    if (!known) console.error('[tool-crib/assign-bulk] rpc error:', error)
    return NextResponse.json({ error: message }, { status: known ? 409 : 500 })
  }

  // crib_assign_all returns the count assigned.
  return NextResponse.json({ ok: true, assigned: typeof data === 'number' ? data : 0 })
}
