import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { normalizeCompany } from '@/lib/crm-normalize'
import { sanitizeCompanyField } from '../validate'

const EDITABLE_FIELDS = ['name', 'kind', 'customer_id', 'domain', 'website', 'phone', 'location', 'notes'] as const

// PATCH a company. Renaming CASCADES to every linked deal's `customer` display
// cache — that column is derived once company_id is set (see ../../[id]/route.ts),
// and forgetting the cascade here would silently drift every list view.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireCrmAuth(); if (err) return err
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  for (const f of EDITABLE_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeCompanyField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    patch[f] = check.value
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  if (patch.name !== undefined) {
    const { normalized } = normalizeCompany(patch.name as string)
    // A rename that collides with another company should be a MERGE, not a
    // silent unique-violation 500 — surface it as a conflict.
    const { data: clash } = await supabaseAdmin
      .from('companies').select('id, name').eq('normalized_name', normalized).neq('id', id).maybeSingle()
    if (clash) {
      return NextResponse.json(
        { error: `"${clash.name}" already exists — use Merge instead of renaming into it.` },
        { status: 409 },
      )
    }
    patch.normalized_name = normalized
  }
  if (patch.customer_id) {
    const { data: cust } = await supabaseAdmin.from('customers').select('id').eq('id', patch.customer_id).maybeSingle()
    if (!cust) return NextResponse.json({ error: 'That portal customer does not exist.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from('companies').update(patch).eq('id', id).select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Company not found.' }, { status: 404 })
  const company = data[0]

  let dealsUpdated = 0
  if (patch.name !== undefined) {
    const { data: touched } = await supabaseAdmin
      .from('deals').update({ customer: company.name }).eq('company_id', id).select('id')
    dealsUpdated = touched?.length ?? 0
  }

  return NextResponse.json({ ok: true, company, dealsUpdated })
}

// DELETE a company. FKs do the right thing: deals.company_id/primary_contact_id
// go NULL (deals keep their customer text), contacts cascade away.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireCrmAuth(); if (err) return err
  const { id } = await ctx.params
  const { data: company } = await supabaseAdmin.from('companies').select('name').eq('id', id).maybeSingle()
  const { error } = await supabaseAdmin.from('companies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (company) {
    const surfaceUser = await getAdminSurfaceUser()
    await logAudit({
      actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
      action: 'company.delete',
      entityType: 'company',
      entityId: id,
      summary: `Deleted company "${company.name}" (deals unlinked, contacts removed)`,
    })
  }
  return NextResponse.json({ ok: true })
}
