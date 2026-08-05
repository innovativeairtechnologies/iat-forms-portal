import { NextRequest, NextResponse } from 'next/server'
import { requireCompReviewAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { parseUuid, sanitizeLineField, LINE_FIELDS } from '../validate'

/* ────────────────────────────────────────────────────────────────────────────
   Compensation review lines — create (comp_review_lines, migration 078).

   POST → add one person to a cycle. Updates go to lines/[id], not here: a line
   is a person, and "add Dylan to the 2026 review" and "give Dylan a 3.5" are
   different actions with different audit lines.

   `employee_id` is optional. The roster includes people with no portal login
   (employees.id is FK'd to auth.users), so an unlinked line carrying only
   person_name is a first-class row, not a degraded one.
   ──────────────────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const err = await requireCompReviewAuth({ write: true }); if (err) return err
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const cycleCheck = parseUuid('cycleId', body.cycleId)
  if (cycleCheck.error) return NextResponse.json({ error: cycleCheck.error }, { status: 400 })

  // A stale cycle id should be a clean 400, not an FK-violation 500.
  const { data: cycle } = await supabaseAdmin
    .from('comp_cycles')
    .select('id, year, status')
    .eq('id', cycleCheck.value!)
    .maybeSingle()
  if (!cycle) return NextResponse.json({ error: 'Review cycle not found.' }, { status: 400 })
  if (cycle.status === 'final') {
    return NextResponse.json(
      { error: `The ${cycle.year} review is finalized. Reopen it before adding people.` },
      { status: 409 },
    )
  }

  const row: Record<string, unknown> = { cycle_id: cycleCheck.value! }
  for (const f of LINE_FIELDS) {
    if (!(f in body)) continue
    const check = sanitizeLineField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    row[f] = check.value
  }
  if (!row.person_name) {
    return NextResponse.json({ error: 'person_name is required.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('comp_review_lines')
    .insert(row)
    .select('*')
    .single()
  if (error) {
    // The partial unique index on (cycle_id, employee_id).
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That employee is already on this review.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'comp_review.line.create',
    entityType: 'comp_review_line',
    entityId: data.id,
    summary: `Added ${data.person_name} to the ${cycle.year} compensation review`,
    metadata: { cycleId: cycle.id, year: cycle.year, employeeId: data.employee_id },
  })

  return NextResponse.json({ ok: true, line: data })
}
