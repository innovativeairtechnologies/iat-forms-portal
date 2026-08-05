import { NextRequest, NextResponse } from 'next/server'
import { requireCompReviewAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { sanitizeCycleField } from '../validate'

/* ────────────────────────────────────────────────────────────────────────────
   Compensation review cycles — create (comp_cycles, migration 078).

   POST → start a review year. The four constants are NOT accepted here: a new
   cycle always begins on the workbook's own defaults (4.1 / 48 / 40 / 52), and
   changing them is a separate, admin-only PATCH. That keeps the rule crisp —
   "only an admin can re-price everybody at once" — rather than letting the
   create call quietly become a back door to the same effect.

   `seedFromEmployees` pre-populates the roster from the staff list, which is
   what replaces "copy last year's spreadsheet and clear the numbers".
   ──────────────────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const err = await requireCompReviewAuth({ write: true }); if (err) return err
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const yearCheck = sanitizeCycleField('year', body.year)
  if (yearCheck.error) return NextResponse.json({ error: yearCheck.error }, { status: 400 })
  const labelCheck = sanitizeCycleField('label', body.label)
  if (labelCheck.error) return NextResponse.json({ error: labelCheck.error }, { status: 400 })

  const surfaceUser = await getAdminSurfaceUser()

  const { data: cycle, error } = await supabaseAdmin
    .from('comp_cycles')
    .insert({
      year: yearCheck.value,
      label: labelCheck.value ?? null,
      created_by: surfaceUser?.user.id ?? null,
    })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `A ${yearCheck.value} review already exists.` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let seeded = 0
  if (body.seedFromEmployees) {
    const [{ data: employees }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from('employees').select('id, name').order('name'),
      supabaseAdmin.from('profiles').select('id, role'),
    ])

    // Customers ARE in the employees table — handle_new_user() (migration 001)
    // fires for every auth user, including the ones the customer-invite route
    // creates, and nothing removes the row. Seeding them onto a payroll sheet
    // would be a genuine data-integrity problem, not just noise, so they are
    // dropped here exactly as /admin/employees drops them.
    const customerIds = new Set((profiles ?? []).filter((p) => p.role === 'customer').map((p) => p.id))
    const staff = (employees ?? []).filter((e) => !customerIds.has(e.id) && (e.name ?? '').trim())

    if (staff.length > 0) {
      const { data: rows, error: seedErr } = await supabaseAdmin
        .from('comp_review_lines')
        .insert(staff.map((e) => ({ cycle_id: cycle.id, employee_id: e.id, person_name: e.name })))
        .select('id')
      // A failed seed is not a failed cycle — the cycle exists and people can be
      // added by hand, so report it rather than rolling back and losing the row.
      if (seedErr) {
        return NextResponse.json(
          { ok: true, cycle, seeded: 0, warning: `Cycle created, but the roster could not be seeded: ${seedErr.message}` },
        )
      }
      seeded = rows?.length ?? 0
    }
  }

  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'comp_review.cycle.create',
    entityType: 'comp_cycle',
    entityId: cycle.id,
    summary: `Started the ${cycle.year} compensation review${seeded ? ` with ${seeded} people` : ''}`,
    metadata: { year: cycle.year, seeded },
  })

  return NextResponse.json({ ok: true, cycle, seeded })
}
