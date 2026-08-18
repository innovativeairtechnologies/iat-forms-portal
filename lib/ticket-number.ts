/**
 * Ticket numbers: IAT-SSSS-NNNN (migration 092).
 *
 *   SSSS  last four characters of the unit's serial number — human context, so
 *         staff can see which unit a ticket is about without opening it.
 *   NNNN  a global, never-resetting counter from next_ticket_seq().
 *
 * ALL of the uniqueness lives in NNNN. SSSS identifies nothing: two units can share
 * their last four characters, and one unit files many tickets over its life. Never
 * look a ticket up by SSSS, and never assume two numbers sharing SSSS are the same
 * unit.
 *
 * Both generation sites (customer intake and warranty approval) go through here so
 * the format can only ever change in one place.
 */

/**
 * Last four characters of a serial, stripped to alphanumerics and uppercased.
 *
 * Serials are entered by hand and arrive in shapes like "26-1234", "26 1234" or
 * "IAT26-1234", so punctuation and case are normalised before slicing — otherwise
 * the same physical unit produces a different tag depending on how it was typed.
 *
 * Returns '0000' when there is no usable serial. That is a real case: the support
 * wizard requires a serial, but /api/tickets does not enforce it, and the number
 * must still be issuable — losing a customer's ticket over a missing serial would
 * be far worse than an unhelpful tag.
 */
export function serialTag(serial: string | null | undefined): string {
  const clean = (serial || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  if (!clean) return '0000'
  return clean.slice(-4).padStart(4, '0')
}

/** Assemble the ticket number. `seq` comes from the next_ticket_seq() RPC. */
export function formatTicketNumber(serial: string | null | undefined, seq: number): string {
  return `IAT-${serialTag(serial)}-${String(seq).padStart(4, '0')}`
}

/**
 * Number to use when the sequence RPC is unreachable, so a ticket is never lost.
 *
 * Six digits from the clock, deliberately wider than any sequence value we will
 * realistically reach, so a fallback number cannot collide with a real one and trip
 * the UNIQUE constraint on the way to rescuing the ticket.
 */
export function fallbackTicketSeq(): number {
  return Number(Date.now().toString().slice(-6))
}
