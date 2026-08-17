// The RFQ triage vocabulary, in one place.
//
// Three consumers have to agree or the queue lies: the list filter, the detail
// page's dropdown, and the API that validates the write against the column's
// CHECK constraint (migration 087). Keep this file dependency-free — it is
// imported by a route handler and by client components alike.
//
// Deliberately short. This is a triage queue, not a pipeline: once an RFQ is
// real work it becomes a deal, and the stages live over there.

export const RFQ_STATUSES = ['new', 'reviewing', 'quoted', 'closed'] as const

export type RfqStatus = (typeof RFQ_STATUSES)[number]

export const RFQ_STATUS_LABELS: Record<RfqStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  quoted: 'Quoted',
  closed: 'Closed',
}

/** What each stage means, shown under the picker so the queue stays consistent. */
export const RFQ_STATUS_HELP: Record<RfqStatus, string> = {
  new: 'Nobody has picked this up yet.',
  reviewing: 'Someone is working it — sizing, questions out to the customer.',
  quoted: 'A number has gone back to them.',
  closed: 'Done, declined, or gone quiet. Off the queue.',
}

export function isRfqStatus(v: unknown): v is RfqStatus {
  return typeof v === 'string' && (RFQ_STATUSES as readonly string[]).includes(v)
}

/**
 * "Nobody has started this yet." The reminder sweep chases exactly this state —
 * assigned-but-still-new gets a nudge to the owner, unassigned-and-still-new
 * gets a REMINDER to the shared desk. Moving a survey to any other status is
 * what stops the chasing, which is why `reviewing` is worth a click even before
 * any real work happens.
 */
export const UNSTARTED_STATUS: RfqStatus = 'new'

/** Statuses that still need someone's attention — what the dashboard counts. */
export const OPEN_STATUSES: readonly RfqStatus[] = ['new', 'reviewing']
