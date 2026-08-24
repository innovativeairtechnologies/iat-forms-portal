import { supabaseAdmin } from './supabase-admin'
import { ticketLifecycles, WAITING_STATUS } from './ticket-history'
import { ticketAlertRecipients } from './ticket-recipients'
import {
  sendWaitingNudgeToCustomer,
  sendWaitingFinalWarningToCustomer,
} from './resend-customer-tickets'
import { sendTicketAutoResolvedAlert } from './resend-tickets'
import { logAudit } from './audit'

// ─── Tickets parked on the customer ──────────────────────────────────────────
//
// A ticket in `waiting_on_customer` is one WE cannot progress: we asked the
// customer something and they have not answered. Left alone those tickets sit in
// the queue forever, so this sweep runs them down a fixed ladder:
//
//   day 7   → nudge the customer, naming the date it will close
//   day 13  → final warning, "closing tomorrow"
//   day 14  → move to `resolved` and tell the OWNER it still needs closing
//
// ⚠️ It resolves, it does NOT close. Closing requires an owner and closing notes
// written by a person (app/admin/tickets/actions.ts). A cron has neither, and
// inventing a note to satisfy our own rule would hollow the rule out — the whole
// point of requiring notes is that somebody accounted for the work. So the sweep
// does the part it can defend and hands the last step to a named human.
//
// ── Why the owner-nudge sweep must not also fire ────────────────────────────
// lib/ticket-reminders.ts chases any ticket in LIVE_STATUSES that has gone quiet.
// `waiting_on_customer` is deliberately NOT in that list: nagging someone daily
// about a ticket they are correctly blocked on is how people learn to ignore the
// nudge entirely.
//
// ── Idempotency without a new column ────────────────────────────────────────
// The reminder sweeps use timestamp columns from migration 090. This one uses
// audit_log rows instead (`ticket.waiting_notice`, with `metadata.kind`), for two
// reasons: it needed no DDL beyond the status constraint, and chasing a customer
// is something that belongs in the audit trail on its own merits.
//
// Notices are only counted if they were written AFTER the current wait began, so
// a ticket parked, answered, and parked again gets chased again from day zero.

/** Days of silence before the first nudge. */
export const WAITING_NUDGE_DAYS = 7
/** Days of silence before the "closing tomorrow" warning. */
export const WAITING_FINAL_WARNING_DAYS = 13
/** Days of silence before the ticket is auto-resolved. */
export const WAITING_RESOLVE_DAYS = 14

const NOTICE_ACTION = 'ticket.waiting_notice'
type NoticeKind = 'day7' | 'final24'

export type WaitingSweepResult = {
  nudged: string[]
  warned: string[]
  autoResolved: string[]
  /** Waiting, but with no audit row saying when it started — see below. */
  undated: string[]
  skipped: string | null
}

const EMPTY: WaitingSweepResult = { nudged: [], warned: [], autoResolved: [], undated: [], skipped: null }

const DAY_MS = 86_400_000

type Row = {
  id: string
  ticket_number: string
  customer_name: string | null
  customer_company: string | null
  customer_email: string | null
  owner_id: string | null
}

/** Date the ticket will auto-resolve, for the day-7 nudge. */
function closesOn(waitingSince: string): string {
  const d = new Date(new Date(waitingSince).getTime() + WAITING_RESOLVE_DAYS * DAY_MS)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export async function runWaitingSweep(now: Date = new Date()): Promise<WaitingSweepResult> {
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select('id, ticket_number, customer_name, customer_company, customer_email, owner_id')
    .eq('status', WAITING_STATUS)
    .limit(500)

  if (error) {
    console.error('[ticket-waiting] ticket read failed:', error.message)
    return { ...EMPTY, skipped: error.message }
  }

  const rows = (data ?? []) as Row[]
  if (!rows.length) return { ...EMPTY }

  const ids = rows.map(r => r.id)
  const lifecycles = await ticketLifecycles(ids)

  // Which chase emails have already gone out for the CURRENT wait.
  const { data: notices } = await supabaseAdmin
    .from('audit_log')
    .select('entity_id, created_at, metadata')
    .eq('action', NOTICE_ACTION)
    .in('entity_id', ids)
    .limit(2000)

  const sentAlready = (id: string, kind: NoticeKind, since: string) =>
    (notices ?? []).some(n =>
      n.entity_id === id &&
      (n.metadata as { kind?: string } | null)?.kind === kind &&
      new Date(n.created_at as string).getTime() >= new Date(since).getTime()
    )

  const result: WaitingSweepResult = { nudged: [], warned: [], autoResolved: [], undated: [], skipped: null }

  for (const t of rows) {
    const waitingSince = lifecycles[t.id]?.waitingSince ?? null

    // ⚠️ FAIL SAFE. Close times and wait times both come from the audit trail,
    // which is a derived source: a status set through a path that skipped
    // logAudit leaves no row. Without a start date we cannot say how long this
    // has waited, and the wrong move is to assume it is old and resolve it out
    // from under someone. Report it and leave it alone.
    if (!waitingSince) {
      result.undated.push(t.ticket_number)
      continue
    }

    const days = (now.getTime() - new Date(waitingSince).getTime()) / DAY_MS

    // Ladder, highest rung first — a ticket that has blown past 14 days is
    // resolved rather than nudged, even if it somehow never got its earlier mail.
    if (days >= WAITING_RESOLVE_DAYS) {
      const { error: upErr } = await supabaseAdmin
        .from('tickets')
        .update({ status: 'resolved' })
        .eq('id', t.id)
        // Guard against a race with a human editing the same ticket: only move it
        // if it is STILL waiting. Without this, a ticket someone just answered
        // could be resolved a moment later by this sweep.
        .eq('status', WAITING_STATUS)

      if (upErr) {
        console.error(`[ticket-waiting] auto-resolve failed for ${t.ticket_number}:`, upErr.message)
        continue
      }

      // `resolved_reason` is deliberately left unset. It is a fixed list chosen
      // for reporting and none of the fifteen entries means "the customer never
      // came back"; the person who closes this picks the honest one.
      await logAudit({
        actor: { id: null, name: 'Automatic' },
        action: 'ticket.status',
        entityType: 'ticket',
        entityId: t.id,
        summary: `Ticket ${t.ticket_number} auto-resolved after ${Math.floor(days)} days waiting on the customer`,
        metadata: { from: WAITING_STATUS, to: 'resolved', via: 'waiting-sweep', days: Math.floor(days) },
      })

      // The owner is told; the desk catches it when there is no owner. The
      // CUSTOMER is deliberately not emailed again — they were warned at day 7
      // and again 24 hours ago, and the warning said it would close itself.
      const recipients = await ticketAlertRecipients(t.owner_id)
      if (recipients.length) {
        try {
          await sendTicketAutoResolvedAlert({
            ticket_number: t.ticket_number,
            ticketId: t.id,
            customer_name: t.customer_name,
            customer_company: t.customer_company,
            waitingSince,
            daysWaited: Math.floor(days),
          }, recipients)
        } catch (err) {
          console.error(`[ticket-waiting] auto-resolved alert threw for ${t.ticket_number}:`, err)
        }
      }
      result.autoResolved.push(t.ticket_number)
      continue
    }

    if (days >= WAITING_FINAL_WARNING_DAYS && !sentAlready(t.id, 'final24', waitingSince)) {
      if (!t.customer_email) continue
      try {
        // Narrowed explicitly: the Ticket type declares these non-null, the rows
        // genuinely can be. The guard above covers the address; the name falls
        // back to an empty string, which the mail helpers already read as "no
        // name" and greet with "Hello,".
        await sendWaitingFinalWarningToCustomer({
          ticket_number: t.ticket_number,
          customer_name: t.customer_name ?? '',
          customer_email: t.customer_email,
        })
      } catch (err) {
        // Not stamped, so the next run retries rather than silently swallowing it.
        console.error(`[ticket-waiting] final warning threw for ${t.ticket_number}:`, err)
        continue
      }
      await logAudit({
        actor: { id: null, name: 'Automatic' },
        action: NOTICE_ACTION,
        entityType: 'ticket',
        entityId: t.id,
        summary: `Final warning sent to the customer for ${t.ticket_number} — closes in 24 hours`,
        metadata: { kind: 'final24', days: Math.floor(days) },
      })
      result.warned.push(t.ticket_number)
      continue
    }

    if (days >= WAITING_NUDGE_DAYS && !sentAlready(t.id, 'day7', waitingSince)) {
      if (!t.customer_email) continue
      try {
        await sendWaitingNudgeToCustomer({
          ticket_number: t.ticket_number,
          customer_name: t.customer_name ?? '',
          customer_email: t.customer_email,
        }, closesOn(waitingSince))
      } catch (err) {
        console.error(`[ticket-waiting] nudge threw for ${t.ticket_number}:`, err)
        continue
      }
      await logAudit({
        actor: { id: null, name: 'Automatic' },
        action: NOTICE_ACTION,
        entityType: 'ticket',
        entityId: t.id,
        summary: `Nudge sent to the customer for ${t.ticket_number} — ${Math.floor(days)} days without a reply`,
        metadata: { kind: 'day7', days: Math.floor(days) },
      })
      result.nudged.push(t.ticket_number)
    }
  }

  return result
}
