import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { logAudit } from '@/lib/audit'
import { normalizeJobNumber } from '@/lib/post-production'

/* POST  — mint a sticker
 * PATCH — rename it, retire it, or issue a new token
 *
 * Admin-side management of the no-login shop-floor tags (migration 099). The
 * TOKEN IS NEVER ACCEPTED FROM THE CLIENT — the database mints it via the
 * pp_tag_token() column default, so no route can forget to set one or
 * "helpfully" generate a weak one.
 */

export async function POST(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const jobNumber = body?.job_number ? normalizeJobNumber(String(body.job_number)) : null
  const label = String(body?.label ?? '').trim().slice(0, 80)
    // A unit sticker names itself; a standing one has to be told what it is, so
    // that whoever scans it can confirm they scanned the right thing.
    || (jobNumber ? `Unit ${jobNumber}` : '')

  if (!label) {
    return NextResponse.json(
      { error: 'Give the tag a name — it is what the person scanning it sees first.' },
      { status: 400 },
    )
  }

  const actor = await getAdminSurfaceUser()
  const createdBy = await employeeIdForEmail(actor?.user.email)

  const { data, error } = await supabaseAdmin
    .from('pp_tags')
    .insert({
      label,
      job_number: jobNumber,
      notes: body?.notes ? String(body.notes).trim().slice(0, 500) : null,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[pp/tags] create failed:', error.message)
    return NextResponse.json({ error: 'Could not create the tag.' }, { status: 500 })
  }

  await logAudit({
    actor: { id: actor?.user.id, name: actor?.displayName },
    action: 'post_production.tag_create',
    entityType: 'pp_tag',
    entityId: data.id,
    summary: `Created post-production tag "${label}"`,
    metadata: { job_number: jobNumber },
  })

  return NextResponse.json({ tag: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const id = String(body?.id ?? '')
  if (!id) return NextResponse.json({ error: 'Which tag?' }, { status: 400 })

  const { data: before } = await supabaseAdmin
    .from('pp_tags').select('*').eq('id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'That tag no longer exists.' }, { status: 404 })

  const actor = await getAdminSurfaceUser()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.label === 'string' && body.label.trim()) patch.label = body.label.trim().slice(0, 80)
  if (typeof body.notes === 'string') patch.notes = body.notes.trim().slice(0, 500) || null
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active

  /* Rotating the token KILLS EVERY PRINTED QR for this tag, immediately and
     irreversibly. That is exactly what it is for — a sticker leaves the building
     on somebody's laptop lid and you re-print rather than re-plumb — but it is
     also why it is its own explicit flag rather than something a rename could
     do by accident.

     The new value comes from the database function, never from here. */
  if (body.rotate === true) {
    const { data: minted, error: mintErr } = await supabaseAdmin.rpc('pp_tag_token')
    if (mintErr || typeof minted !== 'string') {
      console.error('[pp/tags] mint failed:', mintErr?.message)
      return NextResponse.json({ error: 'Could not issue a new link.' }, { status: 500 })
    }
    patch.token = minted
  }

  const { data, error } = await supabaseAdmin
    .from('pp_tags').update(patch).eq('id', id).select('*').single()
  if (error) {
    console.error('[pp/tags] patch failed:', error.message)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  if (body.rotate === true || typeof body.is_active === 'boolean') {
    await logAudit({
      actor: { id: actor?.user.id, name: actor?.displayName },
      action: body.rotate === true ? 'post_production.tag_rotate' : 'post_production.tag_active',
      entityType: 'pp_tag',
      entityId: id,
      summary: body.rotate === true
        ? `Issued a new link for post-production tag "${before.label}" — every printed QR for it is now dead`
        : `Post-production tag "${before.label}" ${body.is_active ? 'reactivated' : 'retired'}`,
      metadata: { job_number: before.job_number },
    })
  }

  return NextResponse.json({ tag: data })
}
