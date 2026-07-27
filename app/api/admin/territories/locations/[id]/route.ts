import { NextRequest, NextResponse } from 'next/server'
import { requireTerritoryAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { sanitizeLocationField } from '../../validate'

/* One rep pin (company_locations, migration 068). PATCH is how pins get ON the
   map: place mode / drag-end sends { lat, lng } (audited once per drag-end, not
   per move). Every other field edits through here too. */

const EDITABLE_FIELDS = ['contact_id', 'label', 'address', 'city', 'region', 'postal', 'country', 'lat', 'lng', 'is_primary', 'notes'] as const

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireTerritoryAuth({ write: true }); if (err) return err
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  for (const f of EDITABLE_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeLocationField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    patch[f] = check.value
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('company_locations').update(patch).eq('id', id).select('*, company:companies(name)')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Location not found.' }, { status: 404 })
  const { company, ...location } = data[0] as Record<string, unknown> & { company: { name: string } | null }

  const moved = patch.lat !== undefined || patch.lng !== undefined
  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: moved ? 'territory.location.move' : 'territory.location.update',
    entityType: 'company',
    entityId: (location.company_id as string) ?? id,
    summary: `${moved ? 'Placed' : 'Updated'} location "${(location.label as string) || (location.city as string) || 'unnamed'}" for ${company?.name ?? 'company'}`,
    metadata: moved ? { lat: patch.lat, lng: patch.lng } : { fields: Object.keys(patch) },
  })
  return NextResponse.json({ ok: true, location })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireTerritoryAuth({ write: true }); if (err) return err
  const { id } = await ctx.params

  const { data: existing } = await supabaseAdmin
    .from('company_locations').select('id, label, city, company_id, company:companies(name)').eq('id', id).maybeSingle()

  const { error } = await supabaseAdmin.from('company_locations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (existing) {
    const companyName = (existing as unknown as { company: { name: string } | null }).company?.name
    const surfaceUser = await getAdminSurfaceUser()
    await logAudit({
      actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
      action: 'territory.location.delete',
      entityType: 'company',
      entityId: existing.company_id,
      summary: `Removed location "${existing.label || existing.city || 'unnamed'}" from ${companyName ?? 'company'}`,
    })
  }
  return NextResponse.json({ ok: true })
}
