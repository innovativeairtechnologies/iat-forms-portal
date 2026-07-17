import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireToolCribAuth, requireCribActor } from '@/lib/api-auth'
import { CRIB_CATEGORIES, cribErrorMessage } from '@/lib/tool-crib'

/* Edit a tool's descriptive fields, or change its lifecycle status.

   Custody fields (status → checked_out, held_by, held_since) are deliberately
   NOT patchable here. Every custody move goes through the crib_* functions in
   migration 050 so the event log can never drift from the row — see the custody
   invariant documented there. A status change to maintenance/lost/retired goes
   through crib_set_status for the same reason. */

const CATEGORIES = new Set<string>(CRIB_CATEGORIES)
const LIFECYCLE = new Set(['available', 'maintenance', 'lost', 'retired'])

const EDITABLE = [
  'name', 'category', 'make', 'model', 'serial_number',
  'home_location', 'purchase_date', 'notes',
] as const

function str(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s.slice(0, max) : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireToolCribAuth(); if (err) return err
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  // ── Lifecycle status change → RPC, so an event is written atomically ───────
  if (typeof body.status === 'string') {
    if (!LIFECYCLE.has(body.status)) {
      return NextResponse.json({ error: 'That status can’t be set here.' }, { status: 400 })
    }
    const actor = await requireCribActor()
    if (actor instanceof NextResponse) return actor

    const { data: tool } = await supabaseAdmin
      .from('crib_tools').select('tag_code').eq('id', id).single()
    if (!tool) return NextResponse.json({ error: 'No such tool.' }, { status: 404 })

    const { error: rpcErr } = await supabaseAdmin.rpc('crib_set_status', {
      p_tag: tool.tag_code,
      p_actor: actor.actorId,
      p_status: body.status,
      p_reason: str(body.reason, 500),
    })
    if (rpcErr) {
      const { message, known } = cribErrorMessage(rpcErr)
      if (!known) console.error('[tool-crib] set_status error:', rpcErr)
      return NextResponse.json({ error: message }, { status: known ? 409 : 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── Plain field edit ──────────────────────────────────────────────────────
  const patch: Record<string, unknown> = {}
  for (const k of EDITABLE) {
    if (k in body) patch[k] = str(body[k], k === 'notes' ? 2000 : 200)
  }
  if ('category' in patch && patch.category && !CATEGORIES.has(patch.category as string)) {
    return NextResponse.json({ error: 'Unknown category.' }, { status: 400 })
  }
  if ('purchase_cost' in body) {
    const raw = body.purchase_cost
    if (raw === null || raw === '') patch.purchase_cost = null
    else {
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: 'Purchase cost must be a positive number.' }, { status: 400 })
      }
      patch.purchase_cost = n
    }
  }
  if ('photo_urls' in body) {
    const arr = body.photo_urls
    if (!Array.isArray(arr)) {
      return NextResponse.json({ error: 'Bad photo list.' }, { status: 400 })
    }
    // Same shape gate as create + the read route: storage paths only.
    const paths = arr.filter(
      (u: unknown): u is string => typeof u === 'string' && /^\d{10,}-[a-z0-9]+\.(png|jpe?g|webp|gif)$/i.test(u)
    ).slice(0, 4)
    patch.photo_urls = paths.length ? paths : null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const { error: upErr } = await supabaseAdmin.from('crib_tools').update(patch).eq('id', id)
  if (upErr) {
    console.error('[tool-crib] patch error:', upErr)
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireToolCribAuth(); if (err) return err
  const { id } = await params

  // Refuse to delete a tool someone is holding: the row is the only record of
  // who has it, and deleting it cascades the event history away with it. Retire
  // it instead — that keeps the trail and takes it out of circulation.
  const { data: tool } = await supabaseAdmin
    .from('crib_tools').select('status').eq('id', id).single()
  if (!tool) return NextResponse.json({ error: 'No such tool.' }, { status: 404 })
  if (tool.status === 'checked_out') {
    return NextResponse.json(
      { error: 'That tool is checked out. Force-return it first, or retire it instead of deleting.' },
      { status: 409 }
    )
  }

  const { error: delErr } = await supabaseAdmin.from('crib_tools').delete().eq('id', id)
  if (delErr) {
    console.error('[tool-crib] delete error:', delErr)
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
