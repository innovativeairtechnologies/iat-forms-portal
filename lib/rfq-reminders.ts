import { supabaseAdmin } from './supabase-admin'
import { isSuppressed } from './mail-suppression'
import { sendRfqAssigneeNudge, sendRfqUnclaimedReminder } from './resend-rfq-reminders'
import { UNSTARTED_STATUS } from './rfq-status'
import { nightlySweepAnchor } from './et-clock'

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
// FIVE times a calendar day, and the count matters. /api/cron/rfq-reminders is
// registered for 3:00am and 4:00am ET and both pass isReminderTime() in summer;
// /api/cron/admin-digest calls it again at 6pm, 7pm and 8pm ET, ahead of
// its own window guard, so a day the digest skips is not a day nobody is chased.
// The stamps above make every call after the first a no-op, so the duplication
// costs a few queries and buys a sweep that survives any one entry breaking.
//
// ⚠️ THAT NO-OP IS NOT FREE — IT DEPENDS ON nightlySweepAnchor(). Every one of
// those five invocations used to derive its cutoffs from Date.now(), so each
// asked a slightly different question and a row sitting near a boundary could be
// invisible to one and eligible to the next. That is how the ticket escalation
// started arriving as two emails a night (see lib/ticket-reminders.ts, fixed
// 2026-09-04); this sweep has the same shape and more chances to do it. Anchored,
// all five compute the identical eligible set and only the first one to run has
// anything to send.
//
// ⚠️ BEHAVIOUR CHANGE, 2026-09-04. A quote that crosses 24 hours DURING the day
// used to be picked up by that evening's digest call. It now waits for the 3am
// sweep, because the evening calls share the morning's anchor. Deliberate: those
// calls are documented redundancy, a ~9pm ET send is read next morning anyway,
// and one email beats a few hours.
//
// Until 2026-08-17 only the digest call existed, because vercel.json was
// believed to be capped at two cron entries on this account tier. It is not.

/** How long a survey may sit before we chase it. */
const UNSTARTED_HOURS = 24
/** How long before we chase the SAME survey again — every other night. Measured
 *  from the anchor, so it must NOT be a whole multiple of 24: stamps are real
 *  send times and land after the anchor, so `anchor - 48h` would exclude
 *  everything chased two nights ago and stretch this to every third night. 36
 *  sits centrally between "one night ago" and "two nights ago", with a
 *  twelve-hour margin either side. Same reasoning as lib/ticket-reminders.ts. */
const REPEAT_HOURS = 36

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
  // ⚠️ NOT Date.now() — see "What calls this" above. Row stamps below still use
  // the real clock; only the cutoffs are anchored.
  const now = nightlySweepAnchor()
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
      if (!employee?.email || isSuppressed(employee.email)) {
        console.warn(`[rfq-reminders] assignee ${ownerId} has no reachable email — leaving for the desk sweep`)
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
