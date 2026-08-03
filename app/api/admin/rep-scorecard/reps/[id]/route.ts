import { NextRequest, NextResponse } from 'next/server'
import { requireRepScorecardAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { parseUuid, sanitizeRepField, REP_FIELDS } from '../../validate'

/* One rep (contacts, migrations 062 + 075). PATCH edits identity, the two
   scorecard columns, and which firm they sit at; DELETE removes the rep and —
   via the ON DELETE CASCADE on rep_scorecards.contact_id — every scorecard they
   ever had.

   DELETE is genuinely destructive (it takes the review history with it), so the
   audit line records how many periods were lost, and the UI confirms first. */

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireRepScorecardAuth({ write: true }); if (err) return err
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  for (const f of REP_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeRepField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    patch[f] = check.value
  }

  // Moving a rep between firms happens for real (a person changes agencies).
  // Validated separately from REP_FIELDS because it needs a live rep_firm check,
  // not just a shape check — the same guard the create route applies.
  if (body.company_id !== undefined) {
    const companyCheck = parseUuid('company_id', body.company_id)
    if (companyCheck.error) return NextResponse.json({ error: companyCheck.error }, { status: 400 })
    const { data: company } = await supabaseAdmin
      .from('companies').select('id, name, kind').eq('id', companyCheck.value!).maybeSingle()
    if (!company) return NextResponse.json({ error: 'Firm not found — it may have been deleted.' }, { status: 400 })
    if (company.kind !== 'rep_firm') {
      return NextResponse.json({ error: `${company.name} is not a rep firm.` }, { status: 400 })
    }
    patch.company_id = company.id
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('contacts').update(patch).eq('id', id).select('*, companies(name)')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Rep not found.' }, { status: 404 })
  const { companies, ...rep } = data[0] as Record<string, unknown> & { companies: { name: string } | null }

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'rep_scorecard.rep.update',
    entityType: 'contact',
    entityId: id,
    summary: `Updated rep ${rep.name as string}${companies?.name ? ` (${companies.name})` : ''}`,
    metadata: { fields: Object.keys(patch) },
  })
  return NextResponse.json({ ok: true, rep })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireRepScorecardAuth({ write: true }); if (err) return err
  const { id } = await ctx.params

  const [{ data: existing }, { count }] = await Promise.all([
    supabaseAdmin.from('contacts').select('id, name, companies(name)').eq('id', id).maybeSingle(),
    supabaseAdmin.from('rep_scorecards').select('id', { count: 'exact', head: true }).eq('contact_id', id),
  ])
  if (!existing) return NextResponse.json({ error: 'Rep not found.' }, { status: 404 })

  const { error } = await supabaseAdmin.from('contacts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const firmName = (existing as unknown as { companies: { name: string } | null }).companies?.name
  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'rep_scorecard.rep.delete',
    entityType: 'contact',
    entityId: id,
    summary: `Removed rep ${existing.name}${firmName ? ` from ${firmName}` : ''}${count ? ` (with ${count} scored period${count === 1 ? '' : 's'})` : ''}`,
    metadata: { scorecardsDeleted: count ?? 0 },
  })
  return NextResponse.json({ ok: true })
}
