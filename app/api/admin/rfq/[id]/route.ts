import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireRfqAuth } from '@/lib/api-auth'
import { getEmployeesWithPerm, shortStaffName } from '@/lib/staff'
import { RFQ_STATUSES, UNSTARTED_STATUS, type RfqStatus } from '@/lib/rfq-status'

// Triage writes for one inbound survey (/admin/rfq/[id], migrations 087 + 088).
//
// Deliberately narrow: `status` and the assignee are the ONLY writable fields
// here, and notes are append-only through the sibling /notes route. Everything
// else on the row is what the customer told us and what we told them back — the
// survey and its estimate are a record of a conversation, and a record you can
// quietly edit after the fact is not a record. If a figure is wrong, the fix is
// a new survey or a note saying so, not a silent overwrite.
//
// Gated on `deals`, the same perm as the page and as ADMIN_PATH_PERMS.

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const denied = await requireRfqAuth()
  if (denied) return denied

  const { id } = await props.params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.status !== undefined) {
    // The column carries a CHECK constraint, so an unknown value would surface
    // as a raw Postgres error. Reject it here with something a human can read.
    if (!RFQ_STATUSES.includes(body.status as RfqStatus)) {
      return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
    }
    patch.status = body.status
    // Moving off "new" is what stops the reminder sweep chasing this row. Clear
    // the stamps so that if it ever lands back on "new", chasing starts fresh
    // rather than being silently suppressed by a months-old nudge.
    if (body.status !== UNSTARTED_STATUS) {
      patch.assignee_nudged_at = null
      patch.unclaimed_reminded_at = null
    }
  }

  if (body.assignee_id !== undefined) {
    if (body.assignee_id === null) {
      patch.assignee_id = null
      patch.assignee_name = null
      patch.assigned_at = null
      patch.assignee_nudged_at = null
    } else {
      // Only someone who can actually reach the queue may own a row in it —
      // resolved against the live perm matrix, never taken from the client. An
      // unknown id is a 400 rather than a silently unassigned row.
      const roster = await getEmployeesWithPerm('deals')
      const pick = roster.find(e => e.id === body.assignee_id)
      if (!pick) {
        return NextResponse.json({ error: 'That person cannot be assigned quote requests' }, { status: 400 })
      }
      patch.assignee_id = pick.id
      patch.assignee_name = shortStaffName(pick.name)
      patch.assigned_at = new Date().toISOString()
      // A fresh assignment restarts the nudge clock for the new owner.
      patch.assignee_nudged_at = null
    }
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('rfq_requests')
    .update(patch)
    .eq('id', id)
    .select('id, status, assignee_id, assignee_name, updated_at')
    .maybeSingle()

  if (error) {
    console.error('[admin/rfq] update failed:', error)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}
