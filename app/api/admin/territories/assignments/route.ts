import { NextRequest, NextResponse } from 'next/server'
import { requireTerritoryAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { pickLeastUsedColor, territoryLabel } from '@/lib/territories'
import { parseUuid, parseTerritory, parseExclusivity } from '../validate'

/* ────────────────────────────────────────────────────────────────────────────
   Territory assignments (company_territories, migration 068).

   POST   → assign { companyId, level, code, exclusivity?, label? } to a firm.
            Idempotent: re-assigning an existing triple returns the existing
            row. Auto-assigns companies.map_color (least-used palette color)
            the first time a colorless firm gets a territory, and returns the
            updated company so the client can recolor without a refetch.
   PATCH  → update exclusivity on an existing triple.
   DELETE → unassign a triple.

   All three are writes → requireTerritoryAuth({ write: true }) (admin + sales
   roles only, per the feature decision). `label` is a client display string
   used only in the audit summary; codes are validated, labels are cosmetic.
   ──────────────────────────────────────────────────────────────────────────── */

type Parsed = { companyId: string; level: 'state' | 'province' | 'county'; code: string }

async function parseTriple(req: NextRequest): Promise<{ parsed?: Parsed & { body: Record<string, unknown> }; error?: NextResponse }> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const idCheck = parseUuid('companyId', body.companyId)
  if (idCheck.error) return { error: NextResponse.json({ error: idCheck.error }, { status: 400 }) }
  const terrCheck = parseTerritory(body)
  if (terrCheck.error) return { error: NextResponse.json({ error: terrCheck.error }, { status: 400 }) }
  return { parsed: { companyId: idCheck.value!, ...terrCheck.value!, body } }
}

function auditLabel(level: 'state' | 'province' | 'county', code: string, body: Record<string, unknown>) {
  const countyName = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 120) : null
  return territoryLabel(level, code, countyName)
}

export async function POST(req: NextRequest) {
  const err = await requireTerritoryAuth({ write: true }); if (err) return err
  const { parsed, error } = await parseTriple(req); if (error) return error
  const { companyId, level, code, body } = parsed!

  const exclCheck = parseExclusivity(body.exclusivity)
  if (exclCheck.error) return NextResponse.json({ error: exclCheck.error }, { status: 400 })

  const { data: company } = await supabaseAdmin
    .from('companies').select('id, name, map_color').eq('id', companyId).maybeSingle()
  if (!company) return NextResponse.json({ error: 'Company not found — it may have been deleted.' }, { status: 400 })

  // Idempotent add: the unique index on (company_id, level, code) is the guard.
  const { data: existing } = await supabaseAdmin
    .from('company_territories').select('*')
    .eq('company_id', companyId).eq('level', level).eq('code', code).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, territory: existing, company: null, existed: true })

  const { data: territory, error: insErr } = await supabaseAdmin
    .from('company_territories')
    .insert({ company_id: companyId, level, code, exclusivity: exclCheck.value ?? null })
    .select('*').single()
  if (insErr) {
    if (/duplicate key|company_territories_uniq/i.test(insErr.message)) {
      const { data: raced } = await supabaseAdmin
        .from('company_territories').select('*')
        .eq('company_id', companyId).eq('level', level).eq('code', code).maybeSingle()
      if (raced) return NextResponse.json({ ok: true, territory: raced, company: null, existed: true })
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // First territory for a colorless firm → auto-assign the least-used palette
  // color so it renders distinctly without anyone opening the swatch picker.
  let updatedCompany = null
  if (!company.map_color) {
    const { data: others } = await supabaseAdmin.from('companies').select('map_color').not('map_color', 'is', null)
    const color = pickLeastUsedColor((others ?? []).map((c) => c.map_color))
    const { data: recolored } = await supabaseAdmin
      .from('companies').update({ map_color: color }).eq('id', companyId).select('*').maybeSingle()
    updatedCompany = recolored ?? null
  }

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'territory.assign',
    entityType: 'company',
    entityId: companyId,
    summary: `Assigned ${auditLabel(level, code, body)} to ${company.name}`,
    metadata: { level, code, exclusivity: exclCheck.value ?? null },
  })
  return NextResponse.json({ ok: true, territory, company: updatedCompany, existed: false })
}

export async function PATCH(req: NextRequest) {
  const err = await requireTerritoryAuth({ write: true }); if (err) return err
  const { parsed, error } = await parseTriple(req); if (error) return error
  const { companyId, level, code, body } = parsed!

  const exclCheck = parseExclusivity(body.exclusivity)
  if (exclCheck.error) return NextResponse.json({ error: exclCheck.error }, { status: 400 })

  const { data, error: upErr } = await supabaseAdmin
    .from('company_territories').update({ exclusivity: exclCheck.value ?? null })
    .eq('company_id', companyId).eq('level', level).eq('code', code).select('*')
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'territory.update',
    entityType: 'company',
    entityId: companyId,
    summary: `Updated exclusivity on ${auditLabel(level, code, body)}`,
    metadata: { level, code, exclusivity: exclCheck.value ?? null },
  })
  return NextResponse.json({ ok: true, territory: data[0] })
}

export async function DELETE(req: NextRequest) {
  const err = await requireTerritoryAuth({ write: true }); if (err) return err
  const { parsed, error } = await parseTriple(req); if (error) return error
  const { companyId, level, code, body } = parsed!

  const { data: company } = await supabaseAdmin
    .from('companies').select('name').eq('id', companyId).maybeSingle()

  const { data, error: delErr } = await supabaseAdmin
    .from('company_territories').delete()
    .eq('company_id', companyId).eq('level', level).eq('code', code).select('id')
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (data && data.length > 0) {
    const surfaceUser = await getAdminSurfaceUser()
    await logAudit({
      actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
      action: 'territory.unassign',
      entityType: 'company',
      entityId: companyId,
      summary: `Unassigned ${auditLabel(level, code, body)} from ${company?.name ?? 'company'}`,
      metadata: { level, code },
    })
  }
  return NextResponse.json({ ok: true })
}
