import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerIds } from '@/lib/staff'
import type { Employee } from '@/lib/supabase'
import {
  DEFAULT_NEWS, DEFAULT_EVENTS, DEFAULT_OPENINGS, DEFAULT_SPOTLIGHT,
  DEFAULT_NEW_HIRE, DEFAULT_PEOPLE_EVENTS,
  type NewsItem, type EventItem, type EventKind, type Opening, type Person, type PersonEvent,
} from '@/lib/home-content'

/* ─────────────────────────────────────────────────────────────────────────────
   lib/home-data.ts — server data layer for the company home (/home).

   Every editorial card reads live rows via the service role (bypasses RLS) and
   falls back to lib/home-content defaults per this rule:
     • Editorial cards (news, openings, spotlight, new-hire): a MISSING table
       (read error, pre-migration) OR an empty table → show the default. Defaults
       are placeholders until HR authors real rows.
     • The date-sensitive Calendar trusts an EXISTING table even when it returns
       no upcoming events (a real empty state) — only a missing table → defaults.
   People-derived cards (anniversaries, birthdays, newest hire, who's-out) come
   from existing tables (employees, time_off_requests) and are always live.
   ───────────────────────────────────────────────────────────────────────────── */

// ── Eastern "today" (IAT is US-based; matches the rest of the app) ────────────
function easternYMD(now = new Date()): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10)
  return { y: get('year'), m: get('month'), d: get('day') }
}
const ymdNum = (y: number, m: number, d: number) => y * 10000 + m * 100 + d
const dateStrNum = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return ymdNum(y, m, d)
}

// ── Federal holiday computation (for the Calendar's "next holiday" highlight) ──
function nthWeekdayYMD(year: number, month1: number, weekday: number, n: number) {
  const firstDow = new Date(year, month1 - 1, 1).getDay()
  const day = 1 + ((7 + weekday - firstDow) % 7) + (n - 1) * 7
  return { y: year, m: month1, d: day }
}
function lastWeekdayYMD(year: number, month1: number, weekday: number) {
  const last = new Date(year, month1, 0) // day 0 of next month = last day of this one
  const day = last.getDate() - ((7 + last.getDay() - weekday) % 7)
  return { y: year, m: month1, d: day }
}
function holidaysFor(year: number): { name: string; y: number; m: number; d: number }[] {
  const H = (name: string, ymd: { y: number; m: number; d: number }) => ({ name, ...ymd })
  return [
    H("New Year's Day", { y: year, m: 1, d: 1 }),
    H('Martin Luther King Jr. Day', nthWeekdayYMD(year, 1, 1, 3)),
    H("Presidents' Day", nthWeekdayYMD(year, 2, 1, 3)),
    H('Memorial Day', lastWeekdayYMD(year, 5, 1)),
    H('Juneteenth', { y: year, m: 6, d: 19 }),
    H('Independence Day', { y: year, m: 7, d: 4 }),
    H('Labor Day', nthWeekdayYMD(year, 9, 1, 1)),
    H('Columbus Day', nthWeekdayYMD(year, 10, 1, 2)),
    H('Veterans Day', { y: year, m: 11, d: 11 }),
    H('Thanksgiving', nthWeekdayYMD(year, 11, 4, 4)),
    H('Christmas Day', { y: year, m: 12, d: 25 }),
  ]
}
export function nextFederalHoliday(now = new Date()): { name: string; date: Date } | null {
  const { y, m, d } = easternYMD(now)
  const today = ymdNum(y, m, d)
  const next = [...holidaysFor(y), ...holidaysFor(y + 1)]
    .map((h) => ({ ...h, num: ymdNum(h.y, h.m, h.d) }))
    .filter((h) => h.num >= today)
    .sort((a, b) => a.num - b.num)[0]
  if (!next) return null
  return { name: next.name, date: new Date(next.y, next.m - 1, next.d) }
}

// ── Live read helper: null = couldn't read (missing table), array otherwise ───
async function safeSelect(table: string, build: (q: any) => any): Promise<any[] | null> {
  try {
    const { data, error } = await build(supabaseAdmin.from(table).select('*'))
    if (error) return null
    return data ?? []
  } catch {
    return null
  }
}

async function getStaffEmployees(): Promise<Employee[]> {
  try {
    const [{ data }, customers] = await Promise.all([
      supabaseAdmin.from('employees').select('*'),
      getCustomerIds(),
    ])
    return ((data || []) as Employee[]).filter(
      (e: any) => e.is_active !== false && !customers.has(e.id),
    )
  } catch {
    return []
  }
}

// ── Card assembly ─────────────────────────────────────────────────────────────
function mapNews(rows: any[]): NewsItem[] {
  return rows.map((r) => ({
    id: r.id, title: r.title, body: r.body, category: r.category,
    pinned: !!r.pinned, date: r.published_at ?? r.created_at,
  }))
}

function upcomingEvents(list: EventItem[], today: number): EventItem[] {
  return list
    .filter((e) => dateStrNum(e.endsOn || e.startsOn) >= today)
    .sort((a, b) => dateStrNum(a.startsOn) - dateStrNum(b.startsOn))
    .slice(0, 6)
}

/** Upcoming birthdays + work anniversaries within `windowDays`, soonest first. */
function peopleEvents(employees: Employee[], now: Date, windowDays = 45): PersonEvent[] {
  const { y, m, d } = easternYMD(now)
  const today = ymdNum(y, m, d)
  const horizon = (() => {
    const h = new Date(y, m - 1, d + windowDays)
    return ymdNum(h.getFullYear(), h.getMonth() + 1, h.getDate())
  })()

  const inWindow = (mm: number, dd: number): { num: number; year: number } | null => {
    // Next occurrence of month/day, this year or next.
    let year = y
    let num = ymdNum(year, mm, dd)
    if (num < today) { year = y + 1; num = ymdNum(year, mm, dd) }
    return num <= horizon ? { num, year } : null
  }
  const whenStr = (num: number) =>
    `${Math.floor(num / 10000)}-${String(Math.floor((num % 10000) / 100)).padStart(2, '0')}-${String(num % 100).padStart(2, '0')}`
  const monthDay = (mm: number, dd: number) =>
    new Date(2000, mm - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const out: PersonEvent[] = []
  for (const e of employees) {
    const name = (e.name || '').trim()
    if (!name) continue
    const avatarUrl = (e as any).avatar_url ?? null

    const bd = (e as any).birthday as string | null
    if (bd) {
      const [, bm, bdd] = bd.split('-').map(Number)
      const occ = inWindow(bm, bdd)
      if (occ) out.push({ name, avatarUrl, kind: 'birthday', label: monthDay(bm, bdd), when: whenStr(occ.num) })
    }

    if (e.hire_date) {
      const [hy, hm, hd] = e.hire_date.split('-').map(Number)
      const occ = inWindow(hm, hd)
      if (occ) {
        const years = occ.year - hy
        if (years >= 1) out.push({ name, avatarUrl, kind: 'anniversary', label: `${years} yr`, when: whenStr(occ.num) })
      }
    }
  }
  return out.sort((a, b) => dateStrNum(a.when) - dateStrNum(b.when)).slice(0, 6)
}

function newestHire(employees: Employee[], now: Date): Person | null {
  const { y, m, d } = easternYMD(now)
  const today = ymdNum(y, m, d)
  const withDate = employees
    .filter((e) => e.hire_date && dateStrNum(e.hire_date) <= today)
    .sort((a, b) => dateStrNum(b.hire_date!) - dateStrNum(a.hire_date!))
  const e = withDate[0]
  if (!e) return null
  const joined = new Date(e.hire_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return {
    name: (e.name || '').trim(),
    title: e.job_title,
    department: e.department,
    avatarUrl: (e as any).avatar_url ?? null,
    blurb: e.bio,
    meta: `Joined ${joined}`,
  }
}

function spotlightFromRow(rows: any[], employees: Employee[], kind: 'spotlight' | 'welcome'): Person | null {
  const row = rows.find((r) => r.kind === kind && r.active)
  if (!row) return null
  const emp = employees.find((e) => e.id === row.employee_id)
  const name = (emp?.name || '').trim()
  if (!name) return null
  return {
    name,
    title: row.headline || emp?.job_title,
    department: emp?.department,
    avatarUrl: (emp as any)?.avatar_url ?? null,
    blurb: row.blurb || emp?.bio,
    meta: null,
  }
}

export type WhosOut = { name: string; startsOn: string; endsOn: string }

export type HomeData = {
  news: NewsItem[]
  events: EventItem[]
  nextHoliday: { name: string; date: Date } | null
  openings: Opening[]
  spotlight: Person
  newHire: Person
  peopleEvents: PersonEvent[]
  whosOut: WhosOut[]
  /** Active staff headcount (excludes customers) — shown on the home KPI row. */
  headcount: number
}

export async function getHomeData(now = new Date()): Promise<HomeData> {
  const { y, m, d } = easternYMD(now)
  const today = ymdNum(y, m, d)
  const in14 = (() => {
    const h = new Date(y, m - 1, d + 14)
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
  })()
  const todayStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const [newsRows, eventRows, openingRows, spotlightRows, employees, offRows] = await Promise.all([
    safeSelect('announcements', (q) => q.order('pinned', { ascending: false }).order('published_at', { ascending: false }).limit(6)),
    safeSelect('company_events', (q) => q),
    safeSelect('job_openings', (q) => q.eq('is_open', true).order('sort', { ascending: true }).order('created_at', { ascending: true }).limit(8)),
    safeSelect('employee_spotlights', (q) => q.eq('active', true).order('created_at', { ascending: false })),
    getStaffEmployees(),
    safeSelect('time_off_requests', (q) => q.eq('status', 'approved').gte('end_date', todayStr).lte('start_date', in14).order('start_date', { ascending: true }).limit(6)),
  ])

  // News — editorial: missing OR empty → default.
  const news = newsRows && newsRows.length > 0 ? mapNews(newsRows) : DEFAULT_NEWS

  // Events — date-sensitive: missing table → default; existing table → live (even if empty).
  const events = upcomingEvents(
    eventRows === null
      ? DEFAULT_EVENTS
      : eventRows.map((r): EventItem => ({
          id: r.id, title: r.title, description: r.description,
          startsOn: r.starts_on, endsOn: r.ends_on, kind: (r.kind as EventKind) || 'event',
        })),
    today,
  )

  // Openings — editorial: missing OR empty → default.
  const openings: Opening[] = openingRows && openingRows.length > 0
    ? openingRows.map((r) => ({
        id: r.id, title: r.title, department: r.department, location: r.location,
        employmentType: r.employment_type, applyUrl: r.apply_url,
      }))
    : DEFAULT_OPENINGS

  const spotRows = spotlightRows ?? []
  const spotlight = spotlightFromRow(spotRows, employees, 'spotlight') ?? DEFAULT_SPOTLIGHT
  const newHire = spotlightFromRow(spotRows, employees, 'welcome') ?? newestHire(employees, now) ?? DEFAULT_NEW_HIRE

  const pe = peopleEvents(employees, now)
  const finalPeople = pe.length > 0 ? pe : DEFAULT_PEOPLE_EVENTS

  const nameById = new Map(employees.map((e) => [e.id, (e.name || '').trim()]))
  const whosOut: WhosOut[] = (offRows ?? [])
    .map((r) => ({ name: nameById.get(r.employee_id) || 'Someone', startsOn: r.start_date, endsOn: r.end_date }))
    .filter((r) => r.name)

  return {
    news, events, nextHoliday: nextFederalHoliday(now), openings,
    spotlight, newHire, peopleEvents: finalPeople, whosOut,
    headcount: employees.length,
  }
}
