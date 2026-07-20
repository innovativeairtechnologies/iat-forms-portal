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

export type CoreValue = { title: string; body: string }

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

// IAT's core values. Only one is confirmed from the current intranet; add the
// rest here and the card renders them automatically (title + one line each).
export const CORE_VALUES: CoreValue[] = [
  {
    title: 'Solve Problems',
    body: 'We exist to solve our customers’ problems and enrich the lives of others. We’re a customer-service company — we just happen to build dehumidifiers.',
  },
]

// Employee referral program shown on the Open Positions card.
export const REFERRAL = {
  bonus: '$2,000',
  lead: 'Refer a friend',
}

// IT support contact. TODO: point `email` at the real IT inbox — it currently
// routes to the portal admin so the button never bounces in the meantime.
export const IT_SUPPORT = {
  blurb: 'Need help with access, equipment, software, or a broken link? Email IT and we’ll follow up.',
  email: 'jacob.younker@dehumidifiers.com',
}
