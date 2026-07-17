import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireToolCribAuth, requireCribActor } from '@/lib/api-auth'
import { CRIB_CATEGORIES } from '@/lib/tool-crib'

/* Tool Crib registry — create + list. Manage-gated (admin + production_manager);
   the employee scan surface never touches this route.

   tag_code is NOT accepted from the client. It's minted by a DB sequence default
   (migration 050) so two concurrent creates can't race into the same code, and
   so a caller can't collide with or overwrite an existing label. */

const CATEGORIES = new Set<string>(CRIB_CATEGORIES)

function str(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s.slice(0, max) : null
}

export async function GET() {
  const err = await requireToolCribAuth(); if (err) return err

  const { data, error } = await supabaseAdmin
    .from('crib_tools')
    .select('*, holder:employees!crib_tools_held_by_fkey(name)')
    .order('tag_code', { ascending: true })

  if (error) {
    console.error('[tool-crib] list error:', error)
    return NextResponse.json({ error: 'Could not load tools' }, { status: 500 })
  }
  return NextResponse.json({ tools: data })
}

export async function POST(req: NextRequest) {
  const err = await requireToolCribAuth(); if (err) return err

  // Separate call: the manage guard proves they MAY create; this resolves WHO
  // is creating, for the 'created' event. Not fatal if it fails — an admin
  // without an employees row can still build the registry; they just can't hold
  // a tool. The event records an unattributed creation rather than blocking.
  const actor = await requireCribActor()
  const resolved = actor instanceof NextResponse ? null : actor

  const body = await req.json().catch(() => null)
  const name = str(body?.name)
  if (!name) return NextResponse.json({ error: 'A name is required.' }, { status: 400 })

  const category = str(body?.category)
  if (category && !CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Unknown category.' }, { status: 400 })
  }

  const rawCost = body?.purchase_cost
  let purchase_cost: number | null = null
  if (rawCost !== null && rawCost !== undefined && rawCost !== '') {
    const n = Number(rawCost)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'Purchase cost must be a positive number.' }, { status: 400 })
    }
    purchase_cost = n
  }

  // Photos uploaded (to the private bucket) before the row existed; store their
  // storage paths. Bounded + shape-checked so a caller can't stuff arbitrary
  // strings or a huge array into the column.
  let photo_urls: string[] | null = null
  if (Array.isArray(body?.photo_urls)) {
    const paths = body.photo_urls
      .filter((p: unknown): p is string => typeof p === 'string' && /^\d{10,}-[a-z0-9]+\.(png|jpe?g|webp|gif)$/i.test(p))
      .slice(0, 4)
    photo_urls = paths.length ? paths : null
  }

  const { data, error } = await supabaseAdmin
    .from('crib_tools')
    .insert({
      name,
      category,
      make: str(body?.make),
      model: str(body?.model),
      serial_number: str(body?.serial_number),
      home_location: str(body?.home_location),
      purchase_cost,
      purchase_date: str(body?.purchase_date) || null,
      notes: str(body?.notes, 2000),
      photo_urls,
      // status defaults to 'available'; tag_code defaults from the sequence.
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[tool-crib] create error:', error)
    return NextResponse.json({ error: 'Could not add that tool.' }, { status: 500 })
  }

  // Open the timeline with a 'created' row so every tool's history starts at its
  // beginning rather than at whatever the first scan happened to be.
  const { error: evErr } = await supabaseAdmin.from('crib_events').insert({
    tool_id: data.id,
    action: 'created',
    actor_id: resolved?.actorId ?? null,
    actor_name: resolved?.actorName ?? null,
    to_status: 'available',
  })
  if (evErr) console.error('[tool-crib] created-event insert failed:', evErr)

  return NextResponse.json({ id: data.id, tag_code: data.tag_code })
}
