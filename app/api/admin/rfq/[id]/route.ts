import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireRfqAuth } from '@/lib/api-auth'
import { getEmployeesWithPerm, shortStaffName } from '@/lib/staff'
import { RFQ_STATUSES, UNSTARTED_STATUS, type RfqStatus } from '@/lib/rfq-status'
import { sendRfqAssignmentNotice, type ReminderRow } from '@/lib/resend-rfq-reminders'

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

  // Who owned it before this write, plus the fields the assignment email renders.
  // Read BEFORE the update so "did the owner actually change?" is answerable — an
  // idempotent re-save of the same assignee must not re-notify them.
  const { data: before } = await supabaseAdmin
    .from('rfq_requests')
    .select('id, reference, company, project_name, application_label, track, created_at, summary, assignee_id')
    .eq('id', id)
    .maybeSingle()

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

  // ── Tell the new owner, once ──
  // Everything below is best-effort and deliberately AFTER the write. The
  // assignment is the record and it is already committed; a mail failure must
  // not turn a saved triage decision into a 500 the operator will retry.
  if (data.assignee_id && before && data.assignee_id !== before.assignee_id) {
    try {
      const supabase = await createSupabaseServer()
      const { data: { user } } = await supabase.auth.getUser()

      // Assigning something to yourself is not news. Skip silently — mail a
      // person sends themselves is the fastest way to teach them to filter it.
      if (user && user.id === data.assignee_id) {
        console.log(`[admin/rfq] ${before.reference} self-assigned — no notice sent`)
      } else {
        const [{ data: owner }, { data: actor }] = await Promise.all([
          supabaseAdmin.from('employees').select('name, email').eq('id', data.assignee_id).eq('is_active', true).maybeSingle(),
          user
            ? supabaseAdmin.from('employees').select('name').eq('id', user.id).maybeSingle()
            : Promise.resolve({ data: null }),
        ])

        if (!owner?.email) {
          // Assignable but unreachable. Logged loudly rather than swallowed: the
          // 24h nudge will hit the same dead end, and the desk sweep only covers
          // UNASSIGNED rows, so this one would otherwise be chased by nobody.
          console.warn(`[admin/rfq] ${before.reference} assigned to ${data.assignee_id} with no active email — no notice sent`)
        } else {
          // shortStaffName() answers "Unknown" for a blank roster name, which
          // would render as "Unknown assigned this to you". An unattributed
          // sentence reads better than a wrong name, so drop it to empty and let
          // the template use its passive fallback.
          const byName = shortStaffName(actor?.name ?? user?.email?.split('@')[0] ?? '')
          await sendRfqAssignmentNotice(
            owner.email,
            owner.name ?? '',
            before as ReminderRow,
            byName === 'Unknown' ? '' : byName,
          )
        }
      }
    } catch (err) {
      console.error('[admin/rfq] assignment notice failed:', err)
    }
  }

  return NextResponse.json(data)
}
