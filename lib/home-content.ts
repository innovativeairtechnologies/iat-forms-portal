// ─────────────────────────────────────────────────────────────────────────────
// lib/home-content.ts — the company home (/home) content contract + defaults.
//
// The home page is a "CMS with sensible defaults": every editorial card reads
// live rows from Supabase (see lib/home-data.ts) and falls back to the defaults
// below when its table is empty or hasn't been migrated yet. So /home looks
// complete on day one and the moment HR authors a row, that row takes over.
//
// The view-model types here are what the page renders — the data layer maps DB
// rows (migration 058) onto them. Pure data, no server/client APIs, so this
// imports cleanly anywhere.
// ─────────────────────────────────────────────────────────────────────────────

export type NewsItem = {
  id: string
  title: string
  body?: string | null
  category?: string | null
  pinned?: boolean
  /** ISO timestamp — the date shown on the card. */
  date: string
}

export type EventKind = 'event' | 'holiday' | 'training' | 'visit' | 'closure'

export type EventItem = {
  id: string
  title: string
  description?: string | null
  /** 'YYYY-MM-DD'. */
  startsOn: string
  endsOn?: string | null
  kind: EventKind
}

export type Opening = {
  id: string
  title: string
  department?: string | null
  location?: string | null
  employmentType?: string | null
  /** External link or a mailto:; null renders as a non-linked row. */
  applyUrl?: string | null
}

/** Spotlight / new-employee card person. */
export type Person = {
  name: string
  title?: string | null
  department?: string | null
  avatarUrl?: string | null
  blurb?: string | null
  /** Small meta line, e.g. "Joined Jul 2026" or "4 years at IAT". */
  meta?: string | null
}

/** A single row in the Birthdays & Anniversaries card. */
export type PersonEvent = {
  name: string
  avatarUrl?: string | null
  kind: 'birthday' | 'anniversary'
  /** "Jul 16" for a birthday, "5 yr" for an anniversary. */
  label: string
  /** 'YYYY-MM-DD' of the upcoming occurrence — used only for sorting. */
  when: string
}

/**
 * `icon` is a KEY, not a component — this module is imported by server and client
 * alike, and a React component here would drag the icon library across that line.
 * app/home/home-modals.tsx maps the key to the actual glyph.
 */
export type CoreValue = { title: string; body: string; icon: CoreValueIcon }

export type CoreValueIcon =
  | 'clean' | 'innovate' | 'quality' | 'solve' | 'integrity'
  | 'fun' | 'golden' | 'scripture' | 'team'

// ── Defaults (fallbacks shown until a table has rows) ─────────────────────────

export const DEFAULT_NEWS: NewsItem[] = [
  {
    id: 'd-news-1',
    title: 'Company Picnic',
    body: 'Save the date — the company picnic is on September 19th. Details to come.',
    category: 'event',
    pinned: true,
    date: '2026-09-19T09:00:00Z',
  },
  {
    id: 'd-news-2',
    title: 'New Intranet Home Page',
    body: 'The intranet home page has been redesigned around company-wide info.',
    category: 'news',
    date: '2026-07-10T09:00:00Z',
  },
  {
    id: 'd-news-3',
    title: 'Q3 Kickoff Notes Posted',
    body: 'Notes from the quarterly kickoff meeting are now available.',
    category: 'news',
    date: '2026-07-03T09:00:00Z',
  },
  {
    id: 'd-news-4',
    title: 'Safety Reminder',
    body: 'Please review the updated shop floor safety guidelines.',
    category: 'safety',
    date: '2026-06-28T09:00:00Z',
  },
]

export const DEFAULT_EVENTS: EventItem[] = [
  { id: 'd-evt-1', title: 'Logis Tech Visiting', description: 'Logis Tech is coming in on Thursday.', startsOn: '2026-07-16', kind: 'visit' },
  { id: 'd-evt-2', title: 'All-Hands Meeting', description: 'Company-wide update, 2:00 PM in the main conference room.', startsOn: '2026-07-18', kind: 'event' },
  { id: 'd-evt-3', title: 'Office Closed — Labor Day', description: 'No production or office hours.', startsOn: '2026-09-07', kind: 'closure' },
  { id: 'd-evt-4', title: 'Quarterly Safety Training', description: 'Mandatory training session; sign-up link coming soon.', startsOn: '2026-09-15', kind: 'training' },
]

export const DEFAULT_OPENINGS: Opening[] = [
  { id: 'd-job-1', title: 'Senior Electrical & Controls Engineer', department: 'Engineering', employmentType: 'Full-time' },
  { id: 'd-job-2', title: 'Junior Electrical Controls Designer', department: 'Engineering', employmentType: 'Full-time' },
  { id: 'd-job-3', title: 'Testing & QC Technician', department: 'Quality', employmentType: 'Full-time' },
  { id: 'd-job-4', title: 'Production Associate', department: 'Production', employmentType: 'Full-time' },
  { id: 'd-job-5', title: 'Electrical Wiring Technician', department: 'Production', employmentType: 'Full-time' },
]

export const DEFAULT_SPOTLIGHT: Person = {
  name: 'Alicia Turner',
  title: 'Fabrication Team Lead',
  blurb: 'Alicia has been with IAT for 4 years and recently led the shop floor safety overhaul.',
  meta: '4 years at IAT',
}

export const DEFAULT_NEW_HIRE: Person = {
  name: 'Marcus Webb',
  title: 'Mechanical Design Engineer',
  department: 'Engineering',
  blurb: 'Marcus joins the Engineering team this month. Say hello when you see him around.',
  meta: 'Joined this month',
}

export const DEFAULT_PEOPLE_EVENTS: PersonEvent[] = [
  { name: 'Sarah Mitchell', kind: 'birthday', label: 'Jul 16', when: '2026-07-16' },
  { name: 'David Chen', kind: 'anniversary', label: '5 yr', when: '2026-07-19' },
  { name: 'Maria Gonzalez', kind: 'birthday', label: 'Jul 22', when: '2026-07-22' },
  { name: 'James Patterson', kind: 'anniversary', label: '2 yr', when: '2026-07-24' },
]

// ── Static brand content (rarely changes; lives in code, not the DB) ──────────

export const FUN_FACTS: string[] = [
  'Carrots used to be purple — orange ones were cultivated later in the Netherlands.',
  'Dehumidifiers and air conditioners work on the same core principle: condensing moisture out of the air.',
  'Honey never spoils — sealed jars found in ancient tombs were still edible.',
  'A group of flamingos is called a "flamboyance."',
  'The air in your lungs weighs about a kilogram — you just don’t feel it.',
  'Bubble wrap was originally invented as textured wallpaper.',
  'The Eiffel Tower can grow more than 15 cm taller in summer as the metal expands.',
]

// IAT's core values (from dehumidifiers.com/core-values). The home shows ONE per
// week, rotating — see coreValueOfWeek() below. Edit the list here; keep the order
// stable so the weekly rotation is predictable.
export const CORE_VALUES_INTRO = 'We believe in something bigger, something greater than ourselves.'

/**
 * ⚠️ ORDER IS LOAD-BEARING. This is the rotation used in the weekly staff
 * meeting, and the Hub exists to show the same value the room is discussing that
 * week. Reordering this array silently desynchronises the two. Add or remove a
 * value and every subsequent week shifts — re-check ROTATION_ANCHOR if you do.
 */
export const CORE_VALUES: CoreValue[] = [
  { title: 'Clean is King', icon: 'clean', body: 'A clean workspace is an efficient workspace.' },
  { title: 'Innovative Thinking', icon: 'innovate', body: 'We are committed to building a company full of 3-dimensional thinkers.' },
  { title: 'Quality Matters', icon: 'quality', body: 'If our equipment doesn’t perform, then we’re not solving problems — we’re creating them.' },
  { title: 'Solve Problems', icon: 'solve', body: 'We exist to solve our customers’ problems and enrich the lives of others. We are a customer-service company — we just happen to build dehumidifiers.' },
  { title: 'Integrity Matters', icon: 'integrity', body: 'We believe that character matters, all the time.' },
  { title: 'Have Fun', icon: 'fun', body: 'A career doesn’t have to be work.' },
  { title: 'Golden Rule', icon: 'golden', body: 'Treat others — including the company and the customer — the way you’d want to be treated.' },
  { title: 'Colossians 3:23', icon: 'scripture', body: 'We work hard, and we play hard, for the Lord.' },
  { title: 'Teamwork', icon: 'team', body: 'We win together, we lose together. We work together as a team to accomplish remarkable things that we could not do alone.' },
]

/**
 * The week that shows CORE_VALUES[0] ("Clean is King"), as a Monday in
 * America/New_York. Every other week counts forward from here.
 *
 * WHY AN ANCHOR AT ALL: the rotation used to be `weekNumber % 9` counted from the
 * Unix epoch, which is stable but arbitrary — it had no reason to agree with the
 * staff meeting, and didn't. Pinning one known week to one known value is what
 * actually keeps the Hub and the meeting in step.
 *
 * TO RESYNC: if the Hub is showing the wrong value, set this to any Monday whose
 * staff-meeting value was "Clean is King". Nothing else needs to change.
 */
export const ROTATION_ANCHOR_MONDAY = '2026-08-17'

/**
 * The core value to feature this week. Deterministic weekly rotation: the index
 * advances every Monday (Eastern) and is the same for everyone all week, so one
 * value stays up for the week. When the manual "pin one for the week" control is
 * built, it will override this. Pure (no server deps) — safe to call anywhere.
 */
/** Monday-based week number for a Y/M/D, counted from the epoch. */
function weekNumber(y: number, m: number, d: number): number {
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000)
  return Math.floor((days + 3) / 7) // 1970-01-01 was a Thursday; +3 starts weeks on Monday
}

export function coreValueOfWeek(now: Date): { value: CoreValue; index: number; total: number } {
  const total = CORE_VALUES.length

  // Read the date in Eastern time so the value turns over on the office's Monday,
  // not UTC's.
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const g = (t: string) => parseInt(p.find((x) => x.type === t)!.value, 10)
  const thisWeek = weekNumber(g('year'), g('month'), g('day'))

  const [ay, am, ad] = ROTATION_ANCHOR_MONDAY.split('-').map(Number)
  const anchorWeek = weekNumber(ay, am, ad)

  // Weeks elapsed since the anchor, wrapped. The double modulo keeps it correct
  // for dates BEFORE the anchor, where the difference is negative.
  const index = (((thisWeek - anchorWeek) % total) + total) % total
  return { value: CORE_VALUES[index], index, total }
}

// Employee referral program shown on the Open Positions card.
export const REFERRAL = {
  bonus: '$2,000',
  lead: 'Refer a friend',
}

// Shop-floor safety streak shown on the home KPI row. The counter auto-increments
// each day from `since`; just edit this date whenever the streak resets.
export const SAFETY = {
  since: '2025-12-19', // day after the last recordable incident
}

// IT support contact. TODO: point `email` at the real IT inbox — it currently
// routes to the portal admin so the button never bounces in the meantime.
export const IT_SUPPORT = {
  blurb: 'Need help with access, equipment, software, or a broken link? Email IT and we’ll follow up.',
  email: 'jacob.younker@dehumidifiers.com',
}
