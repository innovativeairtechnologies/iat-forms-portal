import { NextRequest, NextResponse } from 'next/server'
import { requireRepScorecardAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { scoreCard, type SignalKey } from '@/lib/rep-scorecard'
import { parseUuid, parsePeriod, sanitizeScorecardField, SCORECARD_FIELDS } from '../validate'

/* ────────────────────────────────────────────────────────────────────────────
   Rep scorecard upsert (rep_scorecards, migration 075).

   PUT → save the scores + hard numbers for one rep in one period. Upsert on the
   (contact_id, period) unique index rather than create-then-patch: the drawer
   has no notion of "does a row exist yet", it just saves what's on screen, and
   two people scoring the same rep in the same quarter must land on one row.

   Only the fields PRESENT in the body are written, so a partial save never
   silently clears the columns it didn't send — except an explicit null, which
   IS a clear (un-scoring a signal is a real action).
   ──────────────────────────────────────────────────────────────────────────── */

export async function PUT(req: NextRequest) {
  const err = await requireRepScorecardAuth({ write: true }); if (err) return err
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const idCheck = parseUuid('contactId', body.contactId)
  if (idCheck.error) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const periodCheck = parsePeriod(body.period)
  if (periodCheck.error) return NextResponse.json({ error: periodCheck.error }, { status: 400 })

  // Verify the rep exists (and grab their firm) so a stale id is a clean 400
  // rather than an FK-violation 500, and the audit line can name them.
  const { data: rep } = await supabaseAdmin
    .from('contacts')
    .select('id, name, company_id, companies(name)')
    .eq('id', idCheck.value!)
    .maybeSingle()
  if (!rep) return NextResponse.json({ error: 'Rep not found — they may have been deleted.' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  for (const f of SCORECARD_FIELDS) {
    if (!(f in body)) continue
    const check = sanitizeScorecardField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    patch[f] = check.value
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  }

  const surfaceUser = await getAdminSurfaceUser()
  const row = {
    contact_id: idCheck.value!,
    period: periodCheck.value!,
    ...patch,
    scored_by: surfaceUser?.user.id ?? null,
    scored_by_name: surfaceUser?.displayName ?? null,
    scored_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('rep_scorecards')
    .upsert(row, { onConflict: 'contact_id,period' })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Summarize with the SAVED row, not the patch — a partial save still reports
  // the rep's real standing for the period, which is what the trail is for.
  const scored = scoreCard(data as Partial<Record<SignalKey, number | null>>)
  const firmName = (rep as { companies?: { name?: string } | null }).companies?.name
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'rep_scorecard.score',
    entityType: 'contact',
    entityId: rep.id,
    summary: scored.total === null
      ? `Updated ${rep.name}${firmName ? ` (${firmName})` : ''} scorecard for ${periodCheck.value}`
      : `Scored ${rep.name}${firmName ? ` (${firmName})` : ''} ${scored.total}/20 — ${scored.tier} — for ${periodCheck.value}`,
    metadata: { period: periodCheck.value, total: scored.total, tier: scored.tier, grade: scored.grade, fields: Object.keys(patch) },
  })

  return NextResponse.json({ ok: true, scorecard: data })
}
