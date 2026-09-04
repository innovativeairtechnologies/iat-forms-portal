import { supabaseAdmin } from './supabase-admin'
import {
  sendTicketAssigneeNudge,
  sendTicketUnclaimedReminder,
  type TicketReminderRow,
} from './resend-ticket-reminders'
import { sendOversightEscalation, type EscalationItem } from './resend-escalation'
import { UNSTARTED_STATUS } from './rfq-status'
import { nightlySweepAnchor } from './et-clock'

// ─── Chasing support tickets that have stalled ───────────────────────────────
//
// ⏰ RUNS AT 3:00am ET, twice, an hour apart (3am and 4am ET in summer; the
import { isSuppressed } from './mail-suppression'
// earlier entry falls to 2am in winter and is skipped by the window guard).
// Moved off 9:00am on 2026-08-25: the owner deploys to production every day at
// 9:00am, a deploy re-registers the project's crons, and a run that has not fired
// yet when the new deployment goes live is at risk — so this job was aimed
// straight at the one time of day guaranteed to lose it. 3:00am also puts the mail
// in THAT DAY's inbox rather than at the bottom of yesterday's.
//
// ⚠️ NO WINDOW GUARD AND NO DAY-CLAIM HERE, UNLIKE THE DIGEST — and that is why two
// entries are enough where the digest needs three. The three stamps below make a
// repeat run a no-op on rows already chased, so both entries simply run and the
// first one to succeed does the work. Nothing has to be excluded by season, so
// both entries are live in both seasons and each is the other's backstop.
//
// ⚠️ THAT ONLY HOLDS BECAUSE THE CUTOFFS COME FROM nightlySweepAnchor(), NOT
// Date.now(). Both entries fire, forty minutes apart and late by a different
// amount each, so a `Date.now()` cutoff moved between them and a row could be
// ineligible at 3:51am and eligible at 4:31am — one email each instead of one
// email listing both. A day-claim would fix the duplicate but cost the backstop;
// a shared anchor keeps both, because the second pass asks the identical
// question and the first pass has already answered it.
//
// ⚠️ Vercel Cron itself only speaks UTC, so the two entries are the ONE place in
// this feature where a fixed-UTC time is unavoidable — everything downstream of
// them, the window guard and the anchor included, is Eastern. In winter the
// earlier entry slides to 2:00am ET and the window guard drops it, leaving the
// later one at 3:00am. Net effect: 3:00am Eastern year-round, no seasonal edit.
//
// Four sweeps, all keyed on a ticket that is still live (open or in progress):
//
//   1. Assigned, no activity in 24h → nudge the owner.
//   2. Nobody assigned at all       → REMINDER to the shared desk.
//   3. Nobody assigned at all       → ESCALATE to the admins, with the unassigned
//                                     quote requests folded into the same email.
//   3b. Assigned, no activity in 24h → the SAME admin email, as oversight.
//   3c. Quote request assigned but still `new` → the SAME email again.
//
// 3c exists because lib/rfq-reminders.ts nudges the rep and stops there, so a
// quote sitting on somebody's name reached nobody else. Sales are copied on this
// email whenever it carries a quote request — see sendOversightEscalation.
//
// 2 and 3 fire on the same rows on purpose, and are not redundant: the desk is a
// shared mailbox that can go unread, and the escalation names three admins who
// can decide who the work belongs to. Assigning an owner stops both.
//
// 1 and 3b fire on the same rows on purpose too. The owner is asked to act; the
// admins are told it is sitting there. The whole point of the second is that it
// does not depend on the first being read — or on the owner still working here.
// A ticket owned by someone who has left was previously chased by nobody, since
// sweep 1 needs an active roster row and sweeps 2 and 3 skip anything with an
// owner. 3b has no such gap.
//
// ── "Activity" means a note, not a status change ────────────────────────────
// The owner nudge asks whether anything has HAPPENED, and the honest record of
// that is the note trail. A ticket somebody is working leaves entries — even
// "waiting on parts". Keying on status instead would let a ticket sit in
// "in progress" forever and count as alive, which is the exact failure mode
// being chased. This is a deliberate difference from the RFQ sweep, where a
// status move off `new` is the signal.
//
// ── Idempotency ─────────────────────────────────────────────────────────────
// This runs on a schedule against the same rows every day, so "have we already
// chased this one?" has to survive between invocations. The three timestamp
// columns from migration 090 are the whole mechanism: stamped when mail goes
// out, checked before the next send. Deliberately NOT stamped when a send throws,
// so a failure is retried on the next run rather than silently swallowed.

/** How long a ticket may sit quiet before we chase it. */
const QUIET_HOURS = 24
/** How long before we chase the SAME ticket again — see REPEAT below. */
const REPEAT_HOURS = 36
/** How long before leadership is told again about the same row — see REPEAT below. */
const ESCALATE_REPEAT_HOURS = 36

// ── REPEAT: why 36 hours means "every other night" ──────────────────────────
// Both of these were 48 until 2026-09-04, read literally as "chase again after
// two days". Measured against nightlySweepAnchor() that is wrong in one
// direction and against a real send time it is fragile in the other:
//
//   • vs the anchor (midnight ET), a stamp written at 3:51 or 4:31am the night
//     before last is NEWER than anchor-48h, so it survives the filter and the
//     row waits a third night.
//   • vs Date.now(), which is what it used to compare against, the answer came
//     down to milliseconds of cron drift and the same night's two passes
//     disagreed — which is the two-emails bug this pair of constants caused.
//
// The sweep only runs at night, so the cadence is quantized to nights whatever
// number goes here. Anything strictly between "one night ago" (24h) and "two
// nights ago" (48h) yields every-other-night, and 36 sits dead centre with a
// twelve-hour margin on each side — enough to absorb any cron lateness Vercel
// has ever shown on this project. Read it as "one whole night must pass", not
// as a duration anybody measures.

/** Statuses that still need someone. Resolved and closed are nobody's problem. */
const LIVE_STATUSES = ['open', 'in_progress'] as const

export type TicketReminderResult = {
  nudged: string[]
  unclaimed: string[]
  escalated: string[]
  skipped: string | null
}

const SELECT =
  'id, ticket_number, customer_name, customer_company, serial_number, problem_description, priority, status, created_at, owner_id, assigned_at'

type Row = Omit<TicketReminderRow, 'last_activity_at'> & {
  owner_id: string | null
  assigned_at: string | null
}

/**
 * Newest note timestamp per ticket. One query for the whole batch rather than one
 * per row — these sweeps run against every live ticket, and a per-row query is
 * how a cron quietly becomes a timeout.
 */
async function lastActivityByTicket(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!ids.length) return out
  const { data, error } = await supabaseAdmin
    .from('ticket_notes')
    .select('ticket_id, created_at')
    .in('ticket_id', ids)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[ticket-reminders] could not load note activity:', error)
    return out
  }
  // Ordered newest-first, so the first sighting of each id is its latest note.
  for (const n of data ?? []) {
    if (!out.has(n.ticket_id as string)) out.set(n.ticket_id as string, n.created_at as string)
  }
  return out
}

export async function runTicketReminders(): Promise<TicketReminderResult> {
  // ⚠️ NOT Date.now(). Every cutoff below is measured from the shared nightly
  // anchor so that both cron entries compute the SAME eligible set and only the
  // first one to run has anything to send — see nightlySweepAnchor(), which
  // carries the full account of the two-emails-per-night bug this fixes.
  // Stamps written back to the rows still use the real clock: they record when
  // the mail actually went out.
  const now = nightlySweepAnchor()
  const quietBefore = new Date(now - QUIET_HOURS * 3600e3).toISOString()
  const repeatBefore = new Date(now - REPEAT_HOURS * 3600e3).toISOString()
  const escalateRepeatBefore = new Date(now - ESCALATE_REPEAT_HOURS * 3600e3).toISOString()
  const result: TicketReminderResult = { nudged: [], unclaimed: [], escalated: [], skipped: null }
  const note = (s: string) => { result.skipped = [result.skipped, s].filter(Boolean).join('; ') }

  // ── 1. Assigned, nothing has happened ──
  // Age is filtered in code rather than SQL because the cutoff is the LATER of
  // "assigned" and "last note", which Postgrest cannot express in one filter.
  const { data: assigned, error: aErr } = await supabaseAdmin
    .from('tickets')
    .select(SELECT)
    .in('status', LIVE_STATUSES)
    .not('owner_id', 'is', null)
    .or(`assignee_nudged_at.is.null,assignee_nudged_at.lt.${repeatBefore}`)

  if (aErr) {
    console.error('[ticket-reminders] could not load assigned rows:', aErr)
    note('assigned query failed')
  } else {
    const rows = (assigned ?? []) as Row[]
    const activity = await lastActivityByTicket(rows.map(r => r.id))

    // Quiet since the LATER of "it became yours" and "the last thing anyone
    // wrote". Either one being recent means the ticket is alive.
    const stale = rows
      .map(r => ({
        r,
        since: [r.assigned_at, activity.get(r.id), r.created_at]
          .filter(Boolean)
          .sort()
          .pop() as string,
      }))
      .filter(x => x.since < quietBefore)

    // Group by owner so a tech with four stalled tickets gets one email, not four.
    const byOwner = new Map<string, TicketReminderRow[]>()
    for (const { r, since } of stale) {
      if (!r.owner_id) continue
      const list = byOwner.get(r.owner_id) ?? []
      list.push({ ...r, last_activity_at: since })
      byOwner.set(r.owner_id, list)
    }

    for (const [ownerId, list] of byOwner) {
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('name, email')
        .eq('id', ownerId)
        .eq('is_active', true)
        .maybeSingle()

      // No active roster row means no address to chase. Logged loudly rather
      // than swallowed: a ticket assigned to someone who has left is chased by
      // nobody, because the unassigned sweeps only cover rows with no owner.
      if (!employee?.email || isSuppressed(employee.email)) {
        console.warn(`[ticket-reminders] owner ${ownerId} has no reachable email — ${list.length} ticket(s) left to the oversight escalation`)
        note(`owner ${ownerId} unreachable`)
        continue
      }

      try {
        await sendTicketAssigneeNudge(employee.email, employee.name ?? '', list)
        await supabaseAdmin
          .from('tickets')
          .update({ assignee_nudged_at: new Date().toISOString() })
          .in('id', list.map(r => r.id))
        result.nudged.push(...list.map(r => r.ticket_number))
      } catch (err) {
        // Deliberately NOT stamped on failure, so the next run tries again.
        console.error(`[ticket-reminders] nudge to ${employee.email} failed:`, err)
      }
    }
  }

  // ── 2. Nobody has picked it up → the shared desk ──
  const { data: unclaimed, error: uErr } = await supabaseAdmin
    .from('tickets')
    .select(SELECT)
    .in('status', LIVE_STATUSES)
    .is('owner_id', null)
    .lt('created_at', quietBefore)
    .or(`unclaimed_reminded_at.is.null,unclaimed_reminded_at.lt.${repeatBefore}`)
    .order('created_at')

  if (uErr) {
    console.error('[ticket-reminders] could not load unclaimed rows:', uErr)
    note('unclaimed query failed')
  } else {
    const rows = ((unclaimed ?? []) as Row[]).map(r => ({ ...r, last_activity_at: r.created_at }))
    if (rows.length) {
      try {
        await sendTicketUnclaimedReminder(rows)
        await supabaseAdmin
          .from('tickets')
          .update({ unclaimed_reminded_at: new Date().toISOString() })
          .in('id', rows.map(r => r.id))
        result.unclaimed.push(...rows.map(r => r.ticket_number))
      } catch (err) {
        console.error('[ticket-reminders] unclaimed reminder failed:', err)
      }
    }
  }

  // ── 3. Nobody has picked it up → leadership, tickets AND quote requests ──
  // Its own escalated_at stamp, on its own 48h cycle, independent of the desk
  // reminder above: the two are different audiences and one failing must not
  // suppress the other.
  const items: EscalationItem[] = []
  const ticketIds: string[] = []
  const rfqIds: string[] = []

  const { data: escTickets, error: etErr } = await supabaseAdmin
    .from('tickets')
    .select('id, ticket_number, customer_name, customer_company, problem_description, serial_number, created_at')
    .in('status', LIVE_STATUSES)
    .is('owner_id', null)
    .lt('created_at', quietBefore)
    .or(`escalated_at.is.null,escalated_at.lt.${escalateRepeatBefore}`)
    .order('created_at')

  if (etErr) {
    console.error('[ticket-reminders] could not load tickets to escalate:', etErr)
    note('ticket escalation query failed')
  } else {
    for (const t of escTickets ?? []) {
      const p = String(t.problem_description ?? '').replace(/\s+/g, ' ').trim()
      items.push({
        entity: 'ticket',
        state: 'unassigned',
        id: t.id as string,
        reference: t.ticket_number as string,
        who: [t.customer_name, t.customer_company].filter(Boolean).join(' · ') || '—',
        what: p ? (p.length > 90 ? `${p.slice(0, 89)}…` : p) : (t.serial_number ? `S/N ${t.serial_number}` : ''),
        createdAt: t.created_at as string,
      })
      ticketIds.push(t.id as string)
    }
  }

  const { data: escRfqs, error: erErr } = await supabaseAdmin
    .from('rfq_requests')
    .select('id, reference, company, contact_name, application_label, project_name, created_at')
    .eq('status', 'new')
    .is('assignee_id', null)
    .lt('created_at', quietBefore)
    .or(`escalated_at.is.null,escalated_at.lt.${escalateRepeatBefore}`)
    .order('created_at')

  if (erErr) {
    console.error('[ticket-reminders] could not load quote requests to escalate:', erErr)
    note('rfq escalation query failed')
  } else {
    for (const q of escRfqs ?? []) {
      items.push({
        entity: 'rfq',
        state: 'unassigned',
        id: q.id as string,
        reference: q.reference as string,
        who: [q.company, q.contact_name].filter(Boolean).join(' · ') || '—',
        what: [q.application_label, q.project_name].filter(Boolean).join(' · '),
        createdAt: q.created_at as string,
      })
      rfqIds.push(q.id as string)
    }
  }

  // ── 3b. Assigned, but nothing has happened → the same leadership email ──
  // The owner already got their own nudge above. This is the oversight copy, so
  // an admin can see work that has a name against it and still is not moving.
  //
  // Its own query rather than reusing the sweep-1 rows on purpose: that set is
  // gated on `assignee_nudged_at`, so a ticket nudged yesterday would drop out
  // of it and vanish from this list too — the admin view would then depend on
  // the owner's nudge cycle, which is precisely the thing it exists to check.
  //
  // Stamped with `escalated_at`, shared with the unassigned sweep above. Safe
  // because a ticket cannot be both unassigned and assigned-but-quiet, and the
  // column means the same thing either way: leadership was told at time T.
  const { data: stalledRows, error: sErr } = await supabaseAdmin
    .from('tickets')
    .select('id, ticket_number, customer_name, customer_company, problem_description, serial_number, created_at, owner_id, assigned_at')
    .in('status', LIVE_STATUSES)
    .not('owner_id', 'is', null)
    .or(`escalated_at.is.null,escalated_at.lt.${escalateRepeatBefore}`)

  if (sErr) {
    console.error('[ticket-reminders] could not load stalled assigned rows:', sErr)
    note('stalled query failed')
  } else {
    const rows = (stalledRows ?? []) as Row[]
    const activity = await lastActivityByTicket(rows.map(r => r.id))
    const stalled = rows
      .map(r => ({
        r,
        since: [r.assigned_at, activity.get(r.id), r.created_at]
          .filter(Boolean)
          .sort()
          .pop() as string,
      }))
      .filter(x => x.since < quietBefore)

    // One lookup for every owner in the batch. A missing or inactive row is not
    // skipped — that ticket is the MOST important one here, because the owner
    // nudge cannot reach a person who has left and nothing else would surface it.
    const ownerIds = [...new Set(stalled.map(x => x.r.owner_id).filter(Boolean) as string[])]
    const ownerNames = new Map<string, string>()
    if (ownerIds.length) {
      const { data: emps } = await supabaseAdmin
        .from('employees')
        .select('id, name, is_active')
        .in('id', ownerIds)
      for (const e of emps ?? []) {
        if (e.is_active && e.name) ownerNames.set(e.id as string, e.name as string)
      }
    }

    for (const { r, since } of stalled) {
      const p = String(r.problem_description ?? '').replace(/\s+/g, ' ').trim()
      items.push({
        entity: 'ticket',
        state: 'stalled',
        id: r.id,
        reference: r.ticket_number,
        who: [r.customer_name, r.customer_company].filter(Boolean).join(' · ') || '—',
        what: p ? (p.length > 90 ? `${p.slice(0, 89)}…` : p) : (r.serial_number ? `S/N ${r.serial_number}` : ''),
        createdAt: r.created_at,
        owner: r.owner_id ? ownerNames.get(r.owner_id) ?? null : null,
        quietSince: since,
      })
      ticketIds.push(r.id)
    }
  }

  // ── 3c. Quote request assigned, still not started → the same admin email ──
  // The RFQ equivalent of 3b, and it had the same hole: lib/rfq-reminders.ts
  // nudges the rep and stops there, so a quote sitting on a rep's name was never
  // escalated to anybody. Sales are copied on this email whenever it contains a
  // quote request — see sendOversightEscalation.
  //
  // "Not started" here is `status = new`, NOT a note trail. That is the RFQ
  // signal by design: one click onto Reviewing says a human has it.
  const { data: stalledRfqs, error: srErr } = await supabaseAdmin
    .from('rfq_requests')
    .select('id, reference, company, contact_name, application_label, project_name, created_at, assignee_id, assignee_name, assigned_at')
    .eq('status', UNSTARTED_STATUS)
    .not('assignee_id', 'is', null)
    .lt('assigned_at', quietBefore)
    .or(`escalated_at.is.null,escalated_at.lt.${escalateRepeatBefore}`)
    .order('assigned_at')

  if (srErr) {
    console.error('[ticket-reminders] could not load stalled quote requests:', srErr)
    note('stalled rfq query failed')
  } else {
    const rows = stalledRfqs ?? []
    const ids = [...new Set(rows.map(r => r.assignee_id).filter(Boolean) as string[])]
    const active = new Map<string, string>()
    if (ids.length) {
      const { data: emps } = await supabaseAdmin
        .from('employees')
        .select('id, name, is_active')
        .in('id', ids)
      for (const e of emps ?? []) {
        if (e.is_active && e.name) active.set(e.id as string, e.name as string)
      }
    }

    for (const q of rows) {
      // `assignee_name` is denormalised on the row, so it survives the person
      // leaving. Resolving against the live roster instead is what makes an
      // owner who no longer has an account visible rather than silently normal.
      const owner = q.assignee_id ? active.get(q.assignee_id as string) ?? null : null
      items.push({
        entity: 'rfq',
        state: 'stalled',
        id: q.id as string,
        reference: q.reference as string,
        who: [q.company, q.contact_name].filter(Boolean).join(' · ') || '—',
        what: [q.application_label, q.project_name].filter(Boolean).join(' · '),
        createdAt: q.created_at as string,
        owner,
        quietSince: (q.assigned_at as string) ?? (q.created_at as string),
      })
      rfqIds.push(q.id as string)
    }
  }

  if (items.length) {
    try {
      await sendOversightEscalation(items)
      const stamp = new Date().toISOString()
      // Stamped only after a send that reached at least one person — see
      // sendOversightEscalation, which throws when every recipient failed.
      if (ticketIds.length) {
        await supabaseAdmin.from('tickets').update({ escalated_at: stamp }).in('id', ticketIds)
      }
      if (rfqIds.length) {
        await supabaseAdmin.from('rfq_requests').update({ escalated_at: stamp }).in('id', rfqIds)
      }
      result.escalated.push(...items.map(i => i.reference))
    } catch (err) {
      console.error('[ticket-reminders] leadership escalation failed:', err)
    }
  }

  return result
}
