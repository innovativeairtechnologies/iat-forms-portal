// ─── Editions — the weekly unit the portal reports in ────────────────────────
//
// Changes ship most days, which makes "what went out this week" hard to talk
// about and impossible to reference later. An EDITION is one Monday-to-Sunday
// work week, named after the Monday that starts it, so any change has exactly
// one edition and everyone can name it the same way.
//
// ── Why the id is year-first ────────────────────────────────────────────────
// The obvious spelling is 8.17.26, and that is how it gets said out loud. It is
// a poor identifier though: it does not sort (8.17.26 lands before 12.1.26 in
// every list, filename and mailbox that orders by name), and outside the US it
// reads as the 8th of the 17th month. 2026.08.17 keeps the dots and keeps the
// Monday date, but sorts correctly everywhere it will be written down — inbox
// subject lines, docx attachments, changelog headings.
//
// Flipping the house style is one line: change fmt() below and nothing else.
//
// ── Why editions are DERIVED, never stored ──────────────────────────────────
// The edition of a change is a function of its date, so nothing has to be
// stamped, remembered, or kept in step. Every existing changelog entry already
// has an edition; the whole history is addressable without editing a single
// line of it. A stored edition would be one more field that can drift.

export type Edition = {
  /** Sortable canonical id, e.g. "2026.08.17". */
  id: string
  /** e.g. "Edition 2026.08.17". */
  label: string
  /** Monday, midday UTC. Midday, not midnight, so a timezone shift can never
   *  move the boundary onto the adjacent day. */
  start: Date
  /** The FOLLOWING Monday, midday UTC — exclusive upper bound. */
  end: Date
  /** Human range, e.g. "17–23 August 2026". */
  range: string
}

const DAY_MS = 864e5

/** House format. Change this one function to restyle every edition label. */
function fmt(monday: Date): string {
  const y = monday.getUTCFullYear()
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0')
  const d = String(monday.getUTCDate()).padStart(2, '0')
  return `${y}.${m}.${d}`
}

/** Midday UTC on the Monday of the week containing `d`. */
function mondayOf(d: Date): Date {
  const midday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12))
  // getUTCDay is 0=Sunday..6=Saturday; this maps Monday to 0 so Sunday counts
  // back six days rather than forward one.
  const offset = (midday.getUTCDay() + 6) % 7
  return new Date(midday.getTime() - offset * DAY_MS)
}

function rangeLabel(start: Date, endInclusive: Date): string {
  const sameMonth = start.getUTCMonth() === endInclusive.getUTCMonth()
    && start.getUTCFullYear() === endInclusive.getUTCFullYear()
  const month = (x: Date) => x.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
  const year = endInclusive.getUTCFullYear()
  return sameMonth
    ? `${start.getUTCDate()}–${endInclusive.getUTCDate()} ${month(endInclusive)} ${year}`
    : `${start.getUTCDate()} ${month(start)} – ${endInclusive.getUTCDate()} ${month(endInclusive)} ${year}`
}

/** The edition containing `d`. */
export function editionFor(d: Date): Edition {
  const start = mondayOf(d)
  const end = new Date(start.getTime() + 7 * DAY_MS)
  const endInclusive = new Date(end.getTime() - DAY_MS)
  return { id: fmt(start), label: `Edition ${fmt(start)}`, start, end, range: rangeLabel(start, endInclusive) }
}

/** The edition BEFORE the one containing `d` — the last complete week. */
export function previousEdition(d: Date): Edition {
  return editionFor(new Date(mondayOf(d).getTime() - DAY_MS))
}

/** Parse a `YYYY-MM-DD` or `YYYY.MM.DD` into its edition; null if unparseable.
 *  Backs the ?edition= preview parameter on the cron route. */
export function parseEdition(value: string): Edition | null {
  const m = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/.exec(value.trim())
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
  return Number.isNaN(d.getTime()) ? null : editionFor(d)
}
