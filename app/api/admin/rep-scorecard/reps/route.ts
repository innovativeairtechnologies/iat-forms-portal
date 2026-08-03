import { NextRequest, NextResponse } from 'next/server'
import { requireRepScorecardAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { parseUuid, sanitizeRepField, REP_FIELDS } from '../validate'

/* ────────────────────────────────────────────────────────────────────────────
   Rep roster — create (contacts at a rep firm, migrations 062 + 075).

   Deliberately NOT a second copy of /api/admin/deals/contacts: that route is the
   CRM's generic contact create, while this one is scoped to rep firms and owns
   the two scorecard columns (territory, rep_status). Both write the same
   `contacts` table on purpose — a rep added here appears in the territory map's
   directory too, which is the point of sharing the roster rather than forking it.
   ──────────────────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const err = await requireRepScorecardAuth({ write: true }); if (err) return err
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const companyCheck = parseUuid('companyId', body.companyId)
  if (companyCheck.error) return NextResponse.json({ error: companyCheck.error }, { status: 400 })

  // Must be a REP firm — a prospect/customer company has no place on this board,
  // and letting one in would put a non-rep row in the firm rollup.
  const { data: company } = await supabaseAdmin
    .from('companies').select('id, name, kind').eq('id', companyCheck.value!).maybeSingle()
  if (!company) return NextResponse.json({ error: 'Firm not found — it may have been deleted.' }, { status: 400 })
  if (company.kind !== 'rep_firm') {
    return NextResponse.json({ error: `${company.name} is not a rep firm.` }, { status: 400 })
  }

  const nameCheck = sanitizeRepField('name', body.name)
  if (nameCheck.error) return NextResponse.json({ error: nameCheck.error }, { status: 400 })

  const insert: Record<string, unknown> = { company_id: company.id, name: nameCheck.value }
  for (const f of REP_FIELDS) {
    if (f === 'name' || body[f] === undefined) continue
    const check = sanitizeRepField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    insert[f] = check.value
  }

  const { data, error } = await supabaseAdmin.from('contacts').insert(insert).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'rep_scorecard.rep.create',
    entityType: 'contact',
    entityId: data.id,
    summary: `Added rep ${data.name} to ${company.name}`,
  })
  return NextResponse.json({ ok: true, rep: data })
}
