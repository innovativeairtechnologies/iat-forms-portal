import { NextRequest, NextResponse } from 'next/server'
import { requireCompReviewAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { avgScore } from '@/lib/comp-review'
import { sanitizeCycleField, CYCLE_FIELDS } from '../../validate'

/* One compensation review cycle (comp_cycles, migration 078).

   PATCH does two different jobs, both admin-only:

   1. The four constants. Changing one re-prices EVERY unfinalized line at once —
      the raise pool and the divisor are multipliers on the whole payroll — so
      this is not an HR-level edit.

   2. status: 'final' | 'draft'. Finalizing snapshots the denominator: while a
      cycle is draft the relative score divides by the LIVE mean of the recorded
      scores, so every row moves whenever anyone is scored. That is right while
      the review is being worked and wrong once it is signed off.

   The average is computed HERE, from the rows, and never taken from the body —
   a client-supplied denominator would let anyone re-price the entire year with
   one number. 078's comp_cycles_final_has_avg CHECK requires it to be written in
   the same statement as the status flip, which is why finalize is handled
   explicitly rather than as a generic field. */

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireCompReviewAuth({ adminOnly: true }); if (err) return err
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const { data: cycle } = await supabaseAdmin
    .from('comp_cycles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!cycle) return NextResponse.json({ error: 'Review cycle not found.' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  for (const f of CYCLE_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeCycleField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    patch[f] = check.value
  }
  // The constants are NOT NULL in 078 — an explicit null would be a 500.
  for (const f of ['raise_pool', 'divisor', 'hours_per_week', 'weeks_per_year'] as const) {
    if (f in patch && patch[f] === null) {
      return NextResponse.json({ error: `${f} cannot be empty.` }, { status: 400 })
    }
  }

  let statusNote = ''
  if (body.status !== undefined) {
    if (body.status !== 'draft' && body.status !== 'final') {
      return NextResponse.json({ error: "status must be 'draft' or 'final'" }, { status: 400 })
    }

    if (body.status === 'final') {
      const { data: lines } = await supabaseAdmin
        .from('comp_review_lines')
        .select('score')
        .eq('cycle_id', id)
      const avg = avgScore(lines ?? [])
      if (avg === null || avg <= 0) {
        return NextResponse.json(
          { error: 'Cannot finalize: no scores have been recorded, so there is no average to freeze.' },
          { status: 400 },
        )
      }
      patch.status = 'final'
      patch.avg_score_final = avg
      statusNote = ` — finalized at an average score of ${(Math.round(avg * 1000) / 1000).toString()}`
    } else {
      // Reopening drops the snapshot so the denominator goes live again. Leaving
      // a stale average behind would make a "draft" cycle quietly keep dividing
      // by last month's number.
      patch.status = 'draft'
      patch.avg_score_final = null
      statusNote = ' — reopened for editing'
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('comp_cycles')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Name the constants that moved — these are the numbers that change everyone's
  // raise at once, so "what did they set it to" is the question worth answering.
  const moved = (['raise_pool', 'divisor', 'hours_per_week', 'weeks_per_year'] as const)
    .filter((f) => f in patch && String(patch[f]) !== String(cycle[f]))
    .map((f) => `${f} ${cycle[f]} → ${patch[f]}`)

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'comp_review.cycle.update',
    entityType: 'comp_cycle',
    entityId: id,
    summary: `${cycle.year} compensation review${moved.length ? `: ${moved.join(', ')}` : ''}${statusNote}`,
    metadata: { year: cycle.year, fields: Object.keys(patch), status: data.status },
  })

  return NextResponse.json({ ok: true, cycle: data })
}
