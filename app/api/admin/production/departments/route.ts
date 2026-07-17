import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProductionAuth } from '@/lib/api-auth'

// Departments behind the public boards (migration 055). Manager-side, gated on
// the `production_board` perm — the floor's own check-off endpoint is the
// separate, deliberately unauthenticated /api/board/[token]/check.

const MAX_NAME = 40
const MAX_BLURB = 120

export async function POST(req: NextRequest) {
  const err = await requireProductionAuth()
  if (err) return err

  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim().slice(0, MAX_NAME)
  const blurb = String(body.blurb ?? '').trim().slice(0, MAX_BLURB) || null

  if (!name) return NextResponse.json({ error: 'Give the department a name.' }, { status: 400 })

  // sort_order defaults to the end of the list so a new department doesn't
  // jump the existing order.
  const { data: last } = await supabaseAdmin
    .from('production_departments')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  // `token` is omitted on purpose — the DB column DEFAULT mints it
  // (prod_board_token()). Never mint it app-side: a DEFAULT can't race.
  const { data, error } = await supabaseAdmin
    .from('production_departments')
    .insert({ name, blurb, sort_order: (last?.sort_order ?? 0) + 10 })
    .select('id')
    .single()

  if (error) {
    // 23505 = the UNIQUE(name) constraint. A duplicate is a user mistake, not a
    // server fault — say so plainly instead of a 500.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A department with that name already exists.' }, { status: 409 })
    }
    console.error('[production/departments] insert failed', error)
    return NextResponse.json({ error: 'Could not add that department.' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const err = await requireProductionAuth()
  if (err) return err

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '').trim()
  if (!id) return NextResponse.json({ error: 'Missing department.' }, { status: 400 })

  // Rotating the token kills every printed QR for this board at once. That's the
  // whole feature: a printout walks out of the shop, you rotate and re-print
  // rather than re-plumb anything.
  //
  // Handled as its own branch (not merged into the field patch) so a stray
  // `rotate: true` riding along on an unrelated edit can't silently invalidate
  // every label in the building.
  if (body.rotate === true) {
    // Re-mint via the same DB function the column DEFAULT uses, so there is
    // exactly ONE token-minting implementation in the system. A column DEFAULT
    // doesn't re-fire on UPDATE, hence the explicit call. (A scalar-returning
    // RPC hands back the value directly — no .single().)
    const { data: newToken, error } = await supabaseAdmin.rpc('prod_board_token')

    if (error || typeof newToken !== 'string' || !newToken) {
      console.error('[production/departments] token mint failed', error)
      return NextResponse.json({ error: 'Could not issue a new link.' }, { status: 500 })
    }

    const { error: updErr } = await supabaseAdmin
      .from('production_departments')
      .update({ token: newToken, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updErr) {
      console.error('[production/departments] rotate failed', updErr)
      return NextResponse.json({ error: 'Could not issue a new link.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, rotated: true })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  // Explicit field-by-field, never a `...body` spread: a spread would let the
  // caller set `token` directly and hand themselves a chosen (guessable) board
  // URL. This is the exact shape of the live updateTicket bug on record.
  if (typeof body.name === 'string') {
    const name = body.name.trim().slice(0, MAX_NAME)
    if (!name) return NextResponse.json({ error: 'Give the department a name.' }, { status: 400 })
    patch.name = name
  }
  if (typeof body.blurb === 'string') patch.blurb = body.blurb.trim().slice(0, MAX_BLURB) || null
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
    patch.sort_order = Math.trunc(body.sort_order)
  }

  const { error: updErr } = await supabaseAdmin
    .from('production_departments')
    .update(patch)
    .eq('id', id)

  if (updErr) {
    if (updErr.code === '23505') {
      return NextResponse.json({ error: 'A department with that name already exists.' }, { status: 409 })
    }
    console.error('[production/departments] update failed', updErr)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
