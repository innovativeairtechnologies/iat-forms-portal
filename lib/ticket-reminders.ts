import { supabaseAdmin } from './supabase-admin'
import {
  sendTicketAssigneeNudge,
  sendTicketUnclaimedReminder,
  type TicketReminderRow,
} from './resend-ticket-reminders'
import { sendUnassignedEscalation, type EscalationItem } from './resend-escalation'

// ─── Chasing support tickets that have stalled ───────────────────────────────
//
// Three sweeps, all keyed on a ticket that is still live (open or in progress):
//
//   1. Assigned, no activity in 24h → nudge the owner.
//   2. Nobody assigned at all       → REMINDER to the shared desk.
//   3. Nobody assigned at all       → ESCALATE to leadership, with the unassigned
//                                     quote requests folded into the same email.
//
// 2 and 3 fire on the same rows on purpose, and are not redundant: the desk is a
// shared mailbox that can go unread, and the escalation names two people who can
// decide who the work belongs to. Assigning an owner stops both.
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
/** How long before we chase the SAME ticket again. */
const REPEAT_HOURS = 48
/** How long before leadership is told again about the same unassigned row. */
const ESCALATE_REPEAT_HOURS = 48

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
  const now = Date.now()
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
      if (!employee?.email) {
        console.warn(`[ticket-reminders] owner ${ownerId} has no active email — ${list.length} ticket(s) chased by nobody`)
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
        kind: 'ticket',
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
        kind: 'rfq',
        id: q.id as string,
        reference: q.reference as string,
        who: [q.company, q.contact_name].filter(Boolean).join(' · ') || '—',
        what: [q.application_label, q.project_name].filter(Boolean).join(' · '),
        createdAt: q.created_at as string,
      })
      rfqIds.push(q.id as string)
    }
  }

  if (items.length) {
    try {
      await sendUnassignedEscalation(items)
      const stamp = new Date().toISOString()
      // Stamped only after a send that reached at least one person — see
      // sendUnassignedEscalation, which throws when every recipient failed.
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
