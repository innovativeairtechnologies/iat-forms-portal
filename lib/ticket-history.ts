import { supabaseAdmin } from '@/lib/supabase-admin'

/* Ticket lifecycle, derived from the audit trail.
   ────────────────────────────────────────────────────────────────────────────
   ⚠️ THE TICKETS TABLE HAS NO `closed_at`. It records `created_at` and
   `customer_resolved_at` and nothing else about when a status changed. So every
   question that depends on WHEN a ticket was closed — the 30-day reopen window,
   time-to-close, reopen rate — is answered from `audit_log` instead.

   That works because app/admin/tickets/actions.ts has always written a
   `ticket.status` audit row with `{ from, to }` metadata on every staff status
   change. Verified 2026-08-21: 8 close events on record, covering all 3
   then-closed tickets with exact timestamps.

   ⚠️ THIS IS A DERIVED SOURCE, NOT A GUARANTEED ONE. A close that happened
   through a path which does not call logAudit leaves no row, and this reports
   "never closed". Every consumer must therefore decide what a missing row means
   and FAIL OPEN where a customer is involved — see isReopenWindowOpen below.

   The intended end state is a real `closed_at` column with this as the backfill
   source. It is not built yet only because the Supabase CLI was unauthorized on
   2026-08-21 and DDL cannot go through PostgREST. When that changes, add the
   column, backfill from here, and reduce this module to the backfill script. */

/** Days a customer may reopen a closed ticket before it must become a new one. */
export const REOPEN_WINDOW_DAYS = 30

export type TicketLifecycle = {
  /** Most recent transition INTO 'closed'. */
  closedAt: string | null
  /** First ever close, so "time to first close" is not flattered by a reopen. */
  firstClosedAt: string | null
  /** Transitions OUT of 'closed'. */
  reopenCount: number
  /**
   * Most recent transition INTO 'waiting_on_customer', cleared the moment it
   * leaves that state — so the 14-day clock restarts if a ticket is parked,
   * answered, and parked again. Null for a ticket not currently waiting.
   */
  waitingSince: string | null
}

type StatusRow = { entity_id: string; created_at: string; metadata: { from?: string; to?: string } | null }

const EMPTY: TicketLifecycle = { closedAt: null, firstClosedAt: null, reopenCount: 0, waitingSince: null }

/** The parked-on-the-customer status. Kept here because both the close logic and
 *  the waiting sweep key on it. */
export const WAITING_STATUS = 'waiting_on_customer'

/**
 * Lifecycle for many tickets at once. One query, then grouped in memory — the
 * per-ticket alternative is a query per row, and the reports page needs every
 * ticket at once.
 *
 * Rows are read oldest-first so `firstClosedAt` is simply the first one seen.
 */
export async function ticketLifecycles(ticketIds?: string[]): Promise<Record<string, TicketLifecycle>> {
  let q = supabaseAdmin
    .from('audit_log')
    .select('entity_id, created_at, metadata')
    .eq('action', 'ticket.status')
    .order('created_at', { ascending: true })
    .limit(10000)

  if (ticketIds?.length) q = q.in('entity_id', ticketIds)

  const { data, error } = await q
  if (error) {
    // A reporting page must not 500 because the trail is unreadable, and the
    // reopen gate must not lock a customer out for the same reason.
    console.error('[ticket-history] audit read failed:', error.message)
    return {}
  }

  const out: Record<string, TicketLifecycle> = {}
  for (const r of (data ?? []) as StatusRow[]) {
    const id = r.entity_id
    if (!id) continue
    const cur = out[id] ?? { ...EMPTY }
    const to = r.metadata?.to
    const from = r.metadata?.from
    if (to === 'closed') {
      cur.closedAt = r.created_at
      cur.firstClosedAt ??= r.created_at
    } else if (from === 'closed') {
      cur.reopenCount += 1
      // Left a closed state, so it is no longer closed as of this row.
      cur.closedAt = null
    }

    // Waiting is tracked the same way and INDEPENDENTLY of the close fields: rows
    // are walked oldest-first, so the last transition in wins and any transition
    // out clears it. A ticket parked, answered, then parked again therefore
    // reports the SECOND park — which is the one the 14-day clock should run from.
    if (to === WAITING_STATUS) cur.waitingSince = r.created_at
    else if (from === WAITING_STATUS) cur.waitingSince = null

    out[id] = cur
  }
  return out
}

/** Lifecycle for one ticket. */
export async function ticketLifecycle(ticketId: string): Promise<TicketLifecycle> {
  const all = await ticketLifecycles([ticketId])
  return all[ticketId] ?? { ...EMPTY }
}

export type ReopenDecision = {
  /** True when the customer may add to this ticket. */
  allowed: boolean
  /** When it was closed, whenever that is known — set on BOTH outcomes. The
   *  blocked path needs it for the message; the allowed path needs it for the
   *  "reopened, closed since <date>" alert. Null for a ticket that is not closed
   *  or has no close row. */
  closedAt: string | null
  /** Only meaningful when blocked. */
  daysSinceClose?: number
}

/**
 * May a customer still add to this ticket?
 *
 * ⚠️ FAILS OPEN, in three separate ways, and each is deliberate:
 *
 *   - a ticket that is not closed        → always allowed
 *   - a closed ticket with NO close row  → allowed (we cannot prove it is stale)
 *   - an unreadable audit trail          → allowed (see ticketLifecycles)
 *
 * The cost of wrongly allowing is a reopened ticket someone has to triage. The
 * cost of wrongly blocking is a customer with a broken dehumidifier being told
 * to go away by a rule they cannot see or argue with. Those are not comparable,
 * so the tie goes to the customer every time.
 */
export async function reopenDecision(
  ticketId: string,
  status: string,
  now: Date = new Date(),
): Promise<ReopenDecision> {
  if (status !== 'closed') return { allowed: true, closedAt: null }

  const { closedAt } = await ticketLifecycle(ticketId)
  if (!closedAt) return { allowed: true, closedAt: null }

  const days = (now.getTime() - new Date(closedAt).getTime()) / 86_400_000
  if (days <= REOPEN_WINDOW_DAYS) return { allowed: true, closedAt }
  return { allowed: false, closedAt, daysSinceClose: Math.floor(days) }
}
