import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { listFindings, listThemes } from './pp-data'
import { engineeringLeadRecipients } from './resend-engineering'
import { sendFindingNudge, sendPostProductionRollUp } from './resend-post-production'
import { RECURRENCE_THRESHOLD, standingOf, type PpFinding } from './post-production'

/* ────────────────────────────────────────────────────────────────────────────
   The morning sweep over post-production findings.

   Piggybacks on the existing /api/cron/eng-reminders route rather than
   registering its own cron entry, and that is a deliberate operational choice:
   a deploy landing on a cron minute EATS that run — ten deploys across one
   Friday evening killed four of them. Every extra entry is another minute in the
   day that a routine push can silently swallow, and this sweep wants the same
   3am-Eastern window the engineering one already owns.

   Two passes, mirroring lib/eng-reminders.ts:
     1. NUDGE THE OWNER — findings due soon or already past, grouped per person.
     2. ROLL UP TO THE LEAD — what is late, what nobody owns, what keeps
        recurring.

   ── Idempotency lives in the database ──────────────────────────────────────
   `nudged_at` (migration 098) is the whole mechanism: stamped when mail goes
   out, checked before the next send, and cleared whenever a finding changes
   owner or is reopened.

   ⚠️ A STAMP IS A CLAIM, NOT PROOF OF DELIVERY. It records that a send did not
   throw. Resend reporting "delivered" is also not an inbox — two filters sit
   between here and one — and the way to check is an Exchange Message Trace. Do
   not read a populated nudged_at as evidence anybody was told.

   ── Failure never stamps ───────────────────────────────────────────────────
   A send that throws leaves the stamp alone, so the next run tries again.
   Chasing twice is a nuisance; not chasing at all is the failure this exists to
   prevent.
   ──────────────────────────────────────────────────────────────────────────── */

/** How long before the SAME person is chased about the SAME finding again. */
const REPEAT_HOURS = 24

/** How many days ahead of the answer date the first nudge goes out. Three, so
 *  there is a working day or two left to actually write something — a reminder
 *  that arrives on the due date is a reproach, not a reminder. */
const LEAD_DAYS = 3

export type PpReminderResult = {
  nudged: { to: string; findings: number }[]
  rollUpTo: string[]
  rollUpFailed: string[]
  counts: { overdue: number; unassigned: number; recurring: number }
  skipped: string | null
}

export async function runPostProductionReminders(now: Date = new Date()): Promise<PpReminderResult> {
  const result: PpReminderResult = {
    nudged: [], rollUpTo: [], rollUpFailed: [],
    counts: { overdue: 0, unassigned: 0, recurring: 0 },
    skipped: null,
  }

  const open = await listFindings({ openOnly: true })
  if (!open.length) { result.skipped = 'nothing open'; return result }

  const today = now.toISOString().slice(0, 10)
  const soon = new Date(now.getTime() + LEAD_DAYS * 86_400_000).toISOString().slice(0, 10)
  const repeatBefore = new Date(now.getTime() - REPEAT_HOURS * 3600e3).toISOString()

  const overdue = open.filter(f => f.due_date && f.due_date < today)
  const unassigned = open.filter(f => !f.assignee_id)
  result.counts.overdue = overdue.length
  result.counts.unassigned = unassigned.length

  // ── 1. Owner nudges ───────────────────────────────────────────────────────
  const chase = open.filter(f => f.assignee_id && f.due_date && f.due_date <= soon)

  // listFindings does not select the stamps (they are chase bookkeeping, not
  // anything a screen shows), so read them for just the candidate rows rather
  // than widening every query in the module for one caller.
  const stamps = new Map<string, string | null>()
  if (chase.length) {
    const { data } = await supabaseAdmin
      .from('pp_findings').select('id, nudged_at').in('id', chase.map(f => f.id))
    for (const r of data ?? []) stamps.set(r.id as string, (r.nudged_at as string | null) ?? null)
  }

  const due = chase.filter(f => {
    const at = stamps.get(f.id)
    return !at || at < repeatBefore
  })

  const byOwner = new Map<string, PpFinding[]>()
  for (const f of due) {
    if (!f.assignee_id) continue
    byOwner.set(f.assignee_id, [...(byOwner.get(f.assignee_id) ?? []), f])
  }

  for (const [ownerId, rows] of byOwner) {
    const { data: employee } = await supabaseAdmin
      .from('employees').select('name, email').eq('id', ownerId).eq('is_active', true).maybeSingle()

    // No active roster row means no address. Leave it: the finding is already in
    // the overdue list the lead gets, and work assigned to somebody who has left
    // is exactly the case that must not go quiet.
    if (!employee?.email) {
      console.warn(`[pp-reminders] assignee ${ownerId} has no active email — leaving it for the roll-up`)
      continue
    }

    try {
      // Worst first, so the top of the email is the thing to do first.
      const sorted = [...rows].sort((a, b) =>
        (standingOf(a, now).days ?? 9999) - (standingOf(b, now).days ?? 9999))
      await sendFindingNudge(employee.email, (employee.name as string) ?? '', sorted, now)
      await supabaseAdmin
        .from('pp_findings').update({ nudged_at: now.toISOString() }).in('id', rows.map(r => r.id))
      result.nudged.push({ to: employee.email as string, findings: rows.length })
    } catch (err) {
      // Deliberately NOT stamped, so the next run tries again.
      console.error(`[pp-reminders] nudge to ${employee.email} failed:`, err)
    }
  }

  // ── 2. The lead roll-up ───────────────────────────────────────────────────
  //
  // ⚠️ Recurring counts are CONFIRMED links only. A model's un-reviewed guess
  // must never reach a leadership email as a number — see the note in
  // lib/pp-data.ts listThemes().
  const recurring = (await listThemes())
    .filter(t => t.status === 'open' && t.confirmed >= RECURRENCE_THRESHOLD)
    .sort((a, b) => b.confirmed - a.confirmed)
    .slice(0, 10)
    .map(t => ({ title: t.title, count: t.confirmed, jobs: t.jobs }))
  result.counts.recurring = recurring.length

  if (!overdue.length && !unassigned.length && !recurring.length) {
    result.skipped = 'nothing to report'
    return result
  }

  const leads = await engineeringLeadRecipients()
  if (!leads.length) {
    // Go quiet LOUDLY. A chaser with no configured audience should say so in the
    // cron log rather than guessing at a recipient list.
    console.warn('[pp-reminders] no engineering recipients configured — roll-up not sent')
    result.skipped = 'no recipients'
    return result
  }

  const sent = await sendPostProductionRollUp(leads, { overdue, unassigned, recurring }, now)
  for (const s of sent) (s.ok ? result.rollUpTo : result.rollUpFailed).push(s.to)

  return result
}
