import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { getPlaybook, listTasks } from './eng-data'
import { projectTask, type EngTaskRow } from './engineering'
import { engineeringLeadRecipients, sendEngineerNudge, sendEngineeringRollUp } from './resend-engineering'
import { nightlySweepAnchor } from './et-clock'
import { ENG_ROLLUP_ACTION, rollUpSentTonight, markRollUpSent } from './nightly-rollup-claim'

/* ────────────────────────────────────────────────────────────────────────────
   The morning sweep over the engineering board.

   Two passes, in the order the meeting described them:

     1. NUDGE THE OWNER — anything due within `nudgeLeadDays` or already past,
        grouped so a person with six things gets one email rather than six.
     2. ROLL UP TO THE LEAD — what is past due, what nobody owns, what nobody
        has touched, and any active job with no plan at all.

   ── Idempotency lives in the database, not in memory ───────────────────────
   This runs on a schedule against the same rows every day, and each run is a
   separate serverless invocation, so "have we already chased this?" has to
   survive between them. `nudged_at` and `escalated_at` (migration 096) are the
   whole mechanism: stamped when mail goes out, checked before the next send.
   The stamps are cleared whenever a task moves off not_started or changes owner
   — a new owner's clock starts fresh, and the previous owner's silence is not
   their problem.

   ⚠️ A STAMP IS A CLAIM, NOT PROOF OF DELIVERY. It records that a send was
   attempted and did not throw. Resend reporting "delivered" is also not an
   inbox: two filters sit between here and one (see lib/resend-engineering.ts),
   and the way to check is an Exchange Message Trace. Do not read a populated
   nudged_at as evidence anybody was told.

   ── Failure never stamps ───────────────────────────────────────────────────
   A send that throws leaves the stamp alone, so the next run tries again. That
   is the right direction for a chaser: chasing twice is a nuisance, not chasing
   at all is the failure the whole feature exists to prevent.
   ──────────────────────────────────────────────────────────────────────────── */

/** How long before the SAME person is nudged about the SAME task again. Daily —
 *  but measured from nightlySweepAnchor(), not from the wall clock, so it must
 *  land between "last night's send" and "tonight's anchor". Last night's stamps
 *  are real send times around 3:15-4:45am ET and tonight's anchor is midnight ET,
 *  so anything from 0 to ~21h works; 12 sits centrally, giving roughly nine hours
 *  of slack on one side and twelve on the other against cron lateness.
 *
 *  ⚠️ DO NOT PUT 24 BACK. Against the anchor, 24 makes the cutoff midnight ET
 *  yesterday — earlier than last night's own send — so a task chased yesterday is
 *  never eligible again and the daily nudge silently becomes every other day.
 *  Against Date.now(), which is what this used to be, 24h landed within seconds
 *  of the run-to-run drift and decided by coin flip which of the night's two
 *  passes chased a task; see nightlySweepAnchor(). */
const REPEAT_HOURS = 12

export type EngReminderResult = {
  nudged: { to: string; tasks: number }[]
  rollUpTo: string[]
  rollUpFailed: string[]
  counts: { overdue: number; unassigned: number; stale: number; unplannedJobs: number }
  skipped: string | null
}

export async function runEngineeringReminders(now: Date = new Date()): Promise<EngReminderResult> {
  const result: EngReminderResult = {
    nudged: [], rollUpTo: [], rollUpFailed: [],
    counts: { overdue: 0, unassigned: 0, stale: 0, unplannedJobs: 0 },
    skipped: null,
  }

  const [playbook, open] = await Promise.all([getPlaybook(), listTasks({ openOnly: true })])
  // Tonight's shared reference point. `now` stays the real clock — it stamps the
  // rows, sizes the variance figures and dates the email — but the chase cutoff
  // is anchored, so both cron entries of one night select the same tasks and the
  // second finds nobody left. See nightlySweepAnchor().
  const anchor = nightlySweepAnchor(now)
  const today = now.toISOString().slice(0, 10)
  const soon = new Date(now.getTime() + playbook.nudgeLeadDays * 86_400_000).toISOString().slice(0, 10)
  const repeatBefore = new Date(anchor - REPEAT_HOURS * 3600e3).toISOString()
  const staleBefore = new Date(now.getTime() - playbook.staleAfterDays * 86_400_000).toISOString()

  const overdue = open.filter(t => t.due_date && t.due_date < today)
  const unassigned = open.filter(t => !t.assignee_id)
  const stale = open.filter(t => t.updated_at < staleBefore)

  // ── 1. Owner nudges ───────────────────────────────────────────────────────
  // Owned, dated, and due inside the lead time (which includes everything
  // already past, since an overdue date is also <= soon).
  const chase = open.filter(t => t.assignee_id && t.due_date && t.due_date <= soon)

  // listTasks does not select the stamps (they are chase bookkeeping, not
  // anything a screen shows), so read them for just the candidate rows rather
  // than widening every query in the app for the benefit of this one caller.
  const stamps = new Map<string, string | null>()
  if (chase.length) {
    const { data } = await supabaseAdmin
      .from('eng_tasks').select('id, nudged_at').in('id', chase.map(t => t.id))
    for (const r of data ?? []) stamps.set(r.id as string, (r.nudged_at as string | null) ?? null)
  }

  const due = chase.filter(t => {
    const at = stamps.get(t.id)
    return !at || at < repeatBefore
  })

  const byOwner = new Map<string, EngTaskRow[]>()
  for (const t of due) {
    if (!t.assignee_id) continue
    byOwner.set(t.assignee_id, [...(byOwner.get(t.assignee_id) ?? []), t])
  }

  for (const [ownerId, rows] of byOwner) {
    const { data: employee } = await supabaseAdmin
      .from('employees').select('name, email').eq('id', ownerId).eq('is_active', true).maybeSingle()

    // No active roster row means no address. Leave it: the row is already in the
    // unassigned/overdue lists the lead gets, and work assigned to somebody who
    // has left is exactly the case that must not go quiet.
    if (!employee?.email) {
      console.warn(`[eng-reminders] assignee ${ownerId} has no active email — leaving it for the roll-up`)
      continue
    }

    try {
      // Worst first, so the top of the email is the thing to do first.
      const sorted = [...rows].sort((a, b) =>
        (projectTask(a, now).varianceDays ?? 9999) - (projectTask(b, now).varianceDays ?? 9999))
      await sendEngineerNudge(employee.email, employee.name ?? '', sorted, now)
      await supabaseAdmin
        .from('eng_tasks').update({ nudged_at: now.toISOString() }).in('id', rows.map(r => r.id))
      result.nudged.push({ to: employee.email, tasks: rows.length })
    } catch (err) {
      // Deliberately NOT stamped, so the next run tries again.
      console.error(`[eng-reminders] nudge to ${employee.email} failed:`, err)
    }
  }

  // ── 2. The lead roll-up ───────────────────────────────────────────────────
  // Active jobs with no tasks at all. Two reads rather than a join: PostgREST
  // cannot express "has no related rows" without one, and these are hundreds of
  // rows, not millions.
  const [{ data: activeJobs }, { data: plannedRows }] = await Promise.all([
    supabaseAdmin.from('eng_jobs').select('id').eq('status', 'active'),
    supabaseAdmin.from('eng_tasks').select('job_id').not('job_id', 'is', null),
  ])
  const planned = new Set((plannedRows ?? []).map(r => r.job_id as string))
  const unplannedJobs = (activeJobs ?? []).filter(j => !planned.has(j.id as string)).length

  result.counts = { overdue: overdue.length, unassigned: unassigned.length, stale: stale.length, unplannedJobs }

  const recipients = await engineeringLeadRecipients()
  if (!recipients.length) {
    // Loud, and reported back through the cron log. A chaser with no audience
    // should go quiet visibly, not silently — set ENGINEERING_NOTIFICATION_EMAIL
    // or give somebody the `engineering` role.
    result.skipped = 'no roll-up recipients: ENGINEERING_NOTIFICATION_EMAIL is unset and nobody holds the engineering role'
    console.warn(`[eng-reminders] ${result.skipped}`)
    return result
  }

  // Nothing outstanding sends nothing. A daily "all clear" that arrives whether
  // or not anything is wrong is the fastest way to teach people to filter the
  // sender — and then the one that matters is filtered too.
  const nothing = overdue.length === 0 && unassigned.length === 0 && stale.length === 0 && unplannedJobs === 0
  if (nothing) {
    console.log('[eng-reminders] nothing outstanding — roll-up not sent')
    return result
  }

  // ⚠️ ONCE A NIGHT. Both cron entries reach here, and unlike the nudges above
  // this roll-up has no per-row stamp to hold it down — so before the claim it
  // would send twice every night the board had anything on it. See
  // lib/nightly-rollup-claim.ts, which carries the evidence and the fail-open
  // reasoning. Checked AFTER `nothing`, so a quiet board costs no query.
  if (await rollUpSentTonight(ENG_ROLLUP_ACTION, anchor)) {
    console.log('[eng-reminders] roll-up already sent tonight — not repeating')
    result.skipped = [result.skipped, 'roll-up already sent tonight'].filter(Boolean).join('; ')
    return result
  }

  const results = await sendEngineeringRollUp(
    recipients,
    { overdue, unassigned, stale, staleDays: playbook.staleAfterDays, unplannedJobs },
    now,
  )
  result.rollUpTo = results.filter(r => r.ok).map(r => r.to)
  result.rollUpFailed = results.filter(r => !r.ok).map(r => r.to)

  // Claim the night only once it actually reached somebody. A roll-up that
  // failed for every recipient stays unclaimed, so the second cron entry of the
  // night still tries — which is the whole reason there are two entries.
  if (result.rollUpTo.length) {
    await markRollUpSent(ENG_ROLLUP_ACTION, 'Engineering board', result.rollUpTo)
  }

  // Stamp the escalated rows only once the roll-up actually reached somebody.
  // The stamp is not used to suppress the roll-up (which is a whole-board
  // summary, not a per-row chase) — it is the trail for "when did leadership
  // last hear about this one", which the audit view and any future
  // "escalated N times" figure both need.
  if (result.rollUpTo.length && overdue.length) {
    await supabaseAdmin
      .from('eng_tasks').update({ escalated_at: now.toISOString() }).in('id', overdue.map(t => t.id))
  }

  return result
}
