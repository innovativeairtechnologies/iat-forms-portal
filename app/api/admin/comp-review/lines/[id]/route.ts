import { NextRequest, NextResponse } from 'next/server'
import { requireCompReviewAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/comp-review'
import { sanitizeLineField, LINE_FIELDS } from '../../validate'

/* One person's line on a compensation review (comp_review_lines, migration 078).

   PATCH saves what the drawer has on screen. Only the fields PRESENT in the body
   are written, so a partial save never silently clears the columns it didn't
   send — except an explicit null, which IS a clear (removing a score, or moving
   someone from hourly to salaried, are real actions).

   Both routes refuse to touch a finalized cycle. That is the whole point of
   finalizing: the year's numbers stop moving, including its inputs.

   The audit line records the score and pay CHANGE, not just that an edit
   happened — this is the one table in the portal where "who changed whose pay,
   from what to what" is the question anyone will actually ask later. */

/** Loads the line plus its cycle, and refuses if the cycle is closed. */
async function loadEditable(id: string) {
  const { data: line } = await supabaseAdmin
    .from('comp_review_lines')
    .select('*, comp_cycles(id, year, status)')
    .eq('id', id)
    .maybeSingle()
  if (!line) return { error: NextResponse.json({ error: 'Line not found.' }, { status: 404 }) }
  const cycle = (line as { comp_cycles?: { id: string; year: number; status: string } | null }).comp_cycles
  if (cycle?.status === 'final') {
    return {
      error: NextResponse.json(
        { error: `The ${cycle.year} review is finalized. Reopen it to make changes.` },
        { status: 409 },
      ),
    }
  }
  return { line, cycle }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireCompReviewAuth({ write: true }); if (err) return err
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const loaded = await loadEditable(id)
  if (loaded.error) return loaded.error
  const { line, cycle } = loaded

  const patch: Record<string, unknown> = {}
  for (const f of LINE_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeLineField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    patch[f] = check.value
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  }
  // person_name is NOT NULL — an empty one would be a 500 from the CHECK.
  if ('person_name' in patch && !patch.person_name) {
    return NextResponse.json({ error: 'person_name cannot be empty.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('comp_review_lines')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That employee is already on this review.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Describe what actually moved, old → new, for the fields that matter.
  const changes: string[] = []
  for (const [field, label, fmt] of [
    ['score', 'score', (v: number | null) => (v === null ? 'none' : String(v))],
    ['per_hour', 'rate', (v: number | null) => (v === null ? 'none' : `$${v.toFixed(2)}`)],
    ['gross_annual', 'annual', (v: number | null) => (v === null ? 'none' : `$${Math.round(v).toLocaleString('en-US')}`)],
    ['bonus', 'bonus', (v: number | null) => (v === null ? 'none' : `$${Math.round(v).toLocaleString('en-US')}`)],
  ] as const) {
    if (!(field in patch)) continue
    const before = num(line[field] as string | number | null)
    const after = num(data[field] as string | number | null)
    if (before !== after) changes.push(`${label} ${fmt(before)} → ${fmt(after)}`)
  }

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'comp_review.line.update',
    entityType: 'comp_review_line',
    entityId: id,
    summary: changes.length
      ? `${data.person_name} (${cycle?.year} review): ${changes.join(', ')}`
      : `Updated ${data.person_name} on the ${cycle?.year} compensation review`,
    metadata: { cycleId: cycle?.id, year: cycle?.year, fields: Object.keys(patch) },
  })

  return NextResponse.json({ ok: true, line: data })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireCompReviewAuth({ write: true }); if (err) return err
  const { id } = await ctx.params

  const loaded = await loadEditable(id)
  if (loaded.error) return loaded.error
  const { line, cycle } = loaded

  const { error } = await supabaseAdmin.from('comp_review_lines').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'comp_review.line.delete',
    entityType: 'comp_review_line',
    entityId: id,
    summary: `Removed ${line.person_name} from the ${cycle?.year} compensation review`,
    metadata: { cycleId: cycle?.id, year: cycle?.year, score: line.score, perHour: line.per_hour },
  })

  return NextResponse.json({ ok: true })
}
