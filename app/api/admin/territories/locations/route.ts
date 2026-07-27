import { NextRequest, NextResponse } from 'next/server'
import { requireTerritoryAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { parseUuid, sanitizeLocationField } from '../validate'

/* ────────────────────────────────────────────────────────────────────────────
   Rep pins collection (company_locations, migration 068).

   POST → create a location for a firm. lat/lng usually arrive null: v1 pins
   are click-to-place from the map AFTER creation (PATCH ../locations/[id]),
   so a location row can exist unplaced — the panel shows it as "not on map".
   ──────────────────────────────────────────────────────────────────────────── */

const CREATE_FIELDS = ['contact_id', 'label', 'address', 'city', 'region', 'postal', 'country', 'lat', 'lng', 'is_primary', 'notes'] as const

export async function POST(req: NextRequest) {
  const err = await requireTerritoryAuth({ write: true }); if (err) return err
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const idCheck = parseUuid('companyId', body.companyId)
  if (idCheck.error) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const { data: company } = await supabaseAdmin
    .from('companies').select('id, name').eq('id', idCheck.value!).maybeSingle()
  if (!company) return NextResponse.json({ error: 'Company not found — it may have been deleted.' }, { status: 400 })

  const insert: Record<string, unknown> = { company_id: company.id }
  for (const f of CREATE_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeLocationField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    insert[f] = check.value
  }

  const { data, error } = await supabaseAdmin.from('company_locations').insert(insert).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'territory.location.create',
    entityType: 'company',
    entityId: company.id,
    summary: `Added location "${(insert.label as string) || (insert.city as string) || 'unnamed'}" to ${company.name}`,
  })
  return NextResponse.json({ ok: true, location: data })
}
