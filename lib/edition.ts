// ─── Editions — the weekly unit the portal reports in ────────────────────────
//
// Changes ship most days, which makes "what went out this week" hard to talk
// about and impossible to reference later. An EDITION is one Monday-to-Sunday
// work week, named after the Monday that starts it, so any change has exactly
// one edition and everyone can name it the same way.
//
// ── The format is M.D.YY, no leading zeros ──────────────────────────────────
// The week beginning Monday 17 August 2026 is edition 8.17.26. Owner's call,
// made deliberately over a year-first spelling: this is the form people already
// say out loud, and it is the shortest thing that still reads as a date.
//
// The trade it accepts, so nobody rediscovers it as a bug: editions do NOT sort
// chronologically by name. In a folder of attachments 10.5.26 lands above
// 8.17.26, and 9.1.26 above 9.10.26. Every place an edition is written also
// carries the full date range, and the files carry their own timestamps, so this
// costs tidiness rather than information. Changing it is still one function —
// fmt() below, and nothing else.
//
// ── Why editions are DERIVED, never stored ──────────────────────────────────
// The edition of a change is a function of its date, so nothing has to be
// stamped, remembered, or kept in step. Every existing changelog entry already
// has an edition; the whole history is addressable without editing a single
// line of it. A stored edition would be one more field that can drift.

// ── Editions are the rule; an interim period is the documented exception ────
// Everything downstream — entry selection, the Word document, the email — reads
// the same fields, so an ad-hoc range can travel the identical path. What it
// must NOT do is arrive wearing an edition's name: an interim covering two days
// but titled "Edition 8.17.26" would collide with the real 8.17.26 that follows
// on Monday — same subject, same filename, different contents, same inbox.
// `kind` exists so the renderers can tell the reader which one they are holding.

export type ReportPeriod = {
  /** Canonical id, e.g. "8.17.26". Used in labels, subjects and filenames. */
  id: string
  /** e.g. "Edition 8.17.26". */
  label: string
  /** Midday UTC on the first day covered. Midday, not midnight, so a timezone
   *  shift can never move the boundary onto the adjacent day. */
  start: Date
  /** Midday UTC on the day AFTER the last one covered — exclusive upper bound. */
  end: Date
  /** Human range, e.g. "17–23 August 2026". */
  range: string
  /** 'edition' = a closed Monday-to-Sunday week. 'interim' = an ad-hoc range
   *  that is NOT an edition and must never be labelled as one. */
  kind: 'edition' | 'interim'
}

/** A closed Monday-to-Sunday week — the unit this portal normally reports in. */
export type Edition = ReportPeriod & { kind: 'edition' }

const DAY_MS = 864e5

/** House format: month.day.two-digit-year, no leading zeros on any part.
 *  Change this one function to restyle every edition label, subject and
 *  filename. Nothing else in the codebase spells an edition. */
function fmt(monday: Date): string {
  const month = monday.getUTCMonth() + 1
  const day = monday.getUTCDate()
  const year = monday.getUTCFullYear() % 100
  return `${month}.${day}.${year}`
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

function build(monday: Date): Edition {
  const end = new Date(monday.getTime() + 7 * DAY_MS)
  const endInclusive = new Date(end.getTime() - DAY_MS)
  return {
    id: fmt(monday),
    label: `Edition ${fmt(monday)}`,
    start: monday,
    end,
    range: rangeLabel(monday, endInclusive),
    kind: 'edition',
  }
}

/** The edition containing `d`. */
export function editionFor(d: Date): Edition {
  return build(mondayOf(d))
}

/** The edition BEFORE the one containing `d` — the last complete week. */
export function previousEdition(d: Date): Edition {
  return build(mondayOf(new Date(mondayOf(d).getTime() - DAY_MS)))
}

/**
 * Parse an edition reference. Accepts the house format and a year-first form,
 * and any day inside the week resolves to that week's Monday — so a caller never
 * has to work out which day the edition is named after.
 *
 *   8.17.26      house format, month.day.year
 *   2026-08-17   year-first, unambiguous — kept because it is what a date picker,
 *                a log line and a URL usually hand you
 *
 * Returns null rather than guessing on anything else.
 */
export function parseEdition(value: string): Edition | null {
  const d = parseDay(value)
  return d ? editionFor(d) : null
}

/**
 * One calendar day, at midday UTC. Accepts the same two spellings as an edition
 * reference — `2026-08-18` and `8.18.26` — because the callers are URLs, logs and
 * date pickers, which disagree about which one they hand you.
 */
function parseDay(value: string): Date | null {
  const v = value.trim()

  // Year-first is detected by a four-digit leading component, so the two forms
  // can never be confused with each other.
  const ymd = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/.exec(v)
  if (ymd) return fromParts(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))

  const mdy = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2})$/.exec(v)
  if (mdy) return fromParts(2000 + Number(mdy[3]), Number(mdy[1]), Number(mdy[2]))

  return null
}

function fromParts(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month - 1, day, 12))
  // Rejects a rolled-over date such as 2.31.26, which Date would silently turn
  // into 3 March rather than refusing.
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return d
}

/**
 * An INTERIM period — an inclusive run of days that is deliberately NOT an
 * edition. Both bounds are inclusive, so ('2026-08-18', '2026-08-19') covers
 * exactly those two days.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The weekly report is the record, and should stay the record. Occasionally the
 * owner wants a look at the last day or two without waiting for Monday, and the
 * wrong way to serve that is to re-send the current edition early: the same
 * edition then goes out twice, the second time containing more than the first,
 * and neither copy can be trusted as "the week".
 *
 * So an interim is a SUPPLEMENT, never a substitute. It carries its own label,
 * its own range and its own filename, and it leaves the edition containing it
 * completely untouched — Monday still sends the full week, still including every
 * day the interim already covered. Saying something twice is cheap; leaving two
 * different documents both claiming to be the same week is not.
 */
export function interimPeriod(from: string, to: string): ReportPeriod | null {
  const first = parseDay(from)
  const last = parseDay(to)
  if (!first || !last || last < first) return null

  return {
    // A single-day interim reads as "8.19.26", not "8.19.26-8.19.26".
    id: first.getTime() === last.getTime() ? fmt(last) : `${fmt(first)}-${fmt(last)}`,
    label: 'Interim update',
    start: first,
    end: new Date(last.getTime() + DAY_MS),   // exclusive — same convention as an edition
    range: rangeLabel(first, last),
    kind: 'interim',
  }
}
