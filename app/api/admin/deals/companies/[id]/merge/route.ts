import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

// POST /companies/[id]/merge { into } — fold this company into another:
// re-point deals (company_id + the derived customer text) and contacts, then
// delete the source. The duplicate-detection panel and the 409 on a colliding
// rename both land here. Non-destructive to deals — merge direction only
// decides which name/metadata survives.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireCrmAuth(); if (err) return err
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const into = typeof body.into === 'string' ? body.into : ''
  if (!into || into === id) return NextResponse.json({ error: 'Pass the target company as "into".' }, { status: 400 })

  const [{ data: source }, { data: target }] = await Promise.all([
    supabaseAdmin.from('companies').select('id, name').eq('id', id).maybeSingle(),
    supabaseAdmin.from('companies').select('id, name').eq('id', into).maybeSingle(),
  ])
  if (!source || !target) return NextResponse.json({ error: 'Company not found.' }, { status: 404 })

  const { data: movedDeals, error: dErr } = await supabaseAdmin
    .from('deals')
    .update({ company_id: target.id, customer: target.name })
    .eq('company_id', source.id)
    .select('id')
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  const { data: movedContacts, error: kErr } = await supabaseAdmin
    .from('contacts')
    .update({ company_id: target.id })
    .eq('company_id', source.id)
    .select('id')
  if (kErr) return NextResponse.json({ error: kErr.message }, { status: 500 })

  const { error: delErr } = await supabaseAdmin.from('companies').delete().eq('id', source.id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'company.merge',
    entityType: 'company',
    entityId: target.id,
    summary: `Merged "${source.name}" into "${target.name}" (${movedDeals?.length ?? 0} deals, ${movedContacts?.length ?? 0} contacts re-pointed)`,
    metadata: { sourceId: source.id, sourceName: source.name, movedDeals: movedDeals?.length ?? 0, movedContacts: movedContacts?.length ?? 0 },
  })

  return NextResponse.json({
    ok: true,
    movedDeals: movedDeals?.length ?? 0,
    movedContacts: movedContacts?.length ?? 0,
  })
}
