import { supabaseAdmin } from './supabase-admin'
import { sendRfqAssigneeNudge, sendRfqUnclaimedReminder } from './resend-rfq-reminders'
import { UNSTARTED_STATUS } from './rfq-status'

// ─── Chasing quote requests that have stalled ────────────────────────────────
//
// Two sweeps, both keyed on a survey still sitting at `new`:
//
//   Assigned but not started  → nudge the owner.
//   Nobody assigned at all    → REMINDER to the shared desk, so it is somebody's
//                               job to hand it to a person.
//
// Moving a survey to ANY other status is what stops the chasing — which is the
// point. One click on "Reviewing" says a human has it.
//
// ── Idempotency ─────────────────────────────────────────────────────────────
// This runs on a schedule against the same rows every day, so "have we already
// chased this one?" has to survive between invocations. The two timestamp
// columns from migration 088 are the whole mechanism: set when mail goes out,
// checked before the next send. An in-memory flag would not survive separate
// serverless invocations.
//
// ── What calls this ─────────────────────────────────────────────────────────
// Twice a day, deliberately. /api/cron/rfq-reminders owns the 13:00 UTC slot,
// and the daily digest run calls it again in the afternoon. The stamps above
// make the second call of the day a no-op, so the duplication costs two queries
// and buys a sweep that still happens if either entry breaks.
//
// Until 2026-08-17 only the digest call existed, because vercel.json was
// believed to be capped at two cron entries on this account tier. It is not.

/** How long a survey may sit before we chase it. */
const UNSTARTED_HOURS = 24
/** How long before we chase the SAME survey again. */
const REPEAT_HOURS = 48

export type ReminderResult = {
  nudged: string[]
  unclaimed: string[]
  skipped: string | null
}

type RfqRow = {
  id: string
  reference: string
  company: string
  project_name: string
  application_label: string
  track: string
  assignee_id: string | null
  assignee_name: string | null
  created_at: string
  summary: Record<string, unknown> | null
}

const SELECT =
  'id, reference, company, project_name, application_label, track, assignee_id, assignee_name, created_at, summary'

export async function runRfqReminders(): Promise<ReminderResult> {
  const now = Date.now()
  const staleBefore = new Date(now - UNSTARTED_HOURS * 3600e3).toISOString()
  const repeatBefore = new Date(now - REPEAT_HOURS * 3600e3).toISOString()
  const result: ReminderResult = { nudged: [], unclaimed: [], skipped: null }

  // ── 1. Assigned, still not started ──
  const { data: assigned, error: aErr } = await supabaseAdmin
    .from('rfq_requests')
    .select(SELECT)
    .eq('status', UNSTARTED_STATUS)
    .not('assignee_id', 'is', null)
    .lt('assigned_at', staleBefore)
    .or(`assignee_nudged_at.is.null,assignee_nudged_at.lt.${repeatBefore}`)

  if (aErr) {
    console.error('[rfq-reminders] could not load assigned rows:', aErr)
    result.skipped = 'assigned query failed'
  } else {
    // Group by owner so a rep with four stalled quotes gets one email, not four.
    const byOwner = new Map<string, RfqRow[]>()
    for (const row of (assigned ?? []) as RfqRow[]) {
      if (!row.assignee_id) continue
      const list = byOwner.get(row.assignee_id) ?? []
      list.push(row)
      byOwner.set(row.assignee_id, list)
    }

    for (const [ownerId, rows] of byOwner) {
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('name, email')
        .eq('id', ownerId)
        .eq('is_active', true)
        .maybeSingle()

      // No active roster row means no address to chase. Fall through to the
      // unclaimed sweep instead of dropping it: an assignment to someone who
      // has left is exactly the case that must not go quiet.
      if (!employee?.email) {
        console.warn(`[rfq-reminders] assignee ${ownerId} has no active email — leaving for the desk sweep`)
        continue
      }

      try {
        await sendRfqAssigneeNudge(employee.email, employee.name ?? '', rows)
        await supabaseAdmin
          .from('rfq_requests')
          .update({ assignee_nudged_at: new Date().toISOString() })
          .in('id', rows.map(r => r.id))
        result.nudged.push(...rows.map(r => r.reference))
      } catch (err) {
        // Deliberately NOT stamped on failure, so the next run tries again.
        console.error(`[rfq-reminders] nudge to ${employee.email} failed:`, err)
      }
    }
  }

  // ── 2. Nobody has picked it up ──
  const { data: unclaimed, error: uErr } = await supabaseAdmin
    .from('rfq_requests')
    .select(SELECT)
    .eq('status', UNSTARTED_STATUS)
    .is('assignee_id', null)
    .lt('created_at', staleBefore)
    .or(`unclaimed_reminded_at.is.null,unclaimed_reminded_at.lt.${repeatBefore}`)
    .order('created_at')

  if (uErr) {
    console.error('[rfq-reminders] could not load unclaimed rows:', uErr)
    result.skipped = [result.skipped, 'unclaimed query failed'].filter(Boolean).join('; ')
    return result
  }

  const rows = (unclaimed ?? []) as RfqRow[]
  if (rows.length) {
    try {
      await sendRfqUnclaimedReminder(rows)
      await supabaseAdmin
        .from('rfq_requests')
        .update({ unclaimed_reminded_at: new Date().toISOString() })
        .in('id', rows.map(r => r.id))
      result.unclaimed.push(...rows.map(r => r.reference))
    } catch (err) {
      console.error('[rfq-reminders] unclaimed reminder failed:', err)
    }
  }

  return result
}
