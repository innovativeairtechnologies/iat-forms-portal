import { supabaseAdmin } from '@/lib/supabase-admin'
import { type Bucket, type RangeKey, DAY, rangeFor, tally } from '@/lib/report-shared'
import { prettyName } from '@/lib/display-name'

/* Portal adoption (/admin/reports/adoption).

   Who actually uses what was built, and — more usefully — who does not.

   The sign-in method split is the point of this report right now: Microsoft SSO
   shipped 2026-07-24 and the blocker has always been adoption rather than code.
   This makes "2 of 10 people have moved" a number on a page instead of a belief.

   ⚠️ `login_events` records SIGN-INS, not sessions. Someone who signs in once and
   works all week counts once; someone bounced by an expired session counts twice
   in a minute. So "active people" is the honest unit here, never "logins" — a
   login count measures session length, not use.

   ⚠️ Never-signed-in is computed against `profiles`, not `employees`. The
   employees table is not staff-only (every customer invite adds a row), so
   counting against it would report every customer as a staff member who has
   never logged in. */

export type AdoptionRow = {
  email: string
  name: string
  role: string
  logins: number
  lastSeen: string | null
  daysSinceSeen: number | null
  methods: string
}

export type AdoptionReport = {
  rangeKey: RangeKey
  rangeLabel: string
  totals: {
    activePeople: number
    totalLogins: number
    staffAccounts: number
    neverSignedIn: number
    ssoPeople: number
    passwordPeople: number
    dormant30: number
  }
  byRole: Bucket[]
  byMethod: Bucket[]
  byPortal: Bucket[]
  byMonth: Bucket[]
  never: Bucket[]
  rows: AdoptionRow[]
}

export async function buildAdoptionReport(rangeKey: RangeKey, now: Date = new Date()): Promise<AdoptionReport> {
  const range = rangeFor(rangeKey, now)

  const [{ data: events, error }, { data: profiles }] = await Promise.all([
    supabaseAdmin
      .from('login_events')
      .select('user_id, email, name, role, portal, method, created_at')
      .order('created_at', { ascending: false })
      .limit(50000),
    supabaseAdmin.from('profiles').select('id, display_name, role'),
  ])

  if (error) console.error('[adoption-report] read failed:', error.message)

  const all = events ?? []
  const inRange = all.filter(e => !range.from || new Date(e.created_at as string) >= range.from)

  // Per PERSON, keyed on lower-cased email — the same human appears with
  // different capitalisation across invite paths.
  const people = new Map<string, { name: string; role: string; logins: number; last: string; methods: Set<string> }>()
  for (const e of inRange) {
    const key = String(e.email ?? '').trim().toLowerCase()
    if (!key) continue
    const cur = people.get(key) ?? { name: '', role: '', logins: 0, last: '', methods: new Set<string>() }
    cur.logins += 1
    cur.name ||= prettyName((e.name as string) || key, 'User')
    cur.role ||= (e.role as string) ?? ''
    if (!cur.last || (e.created_at as string) > cur.last) cur.last = e.created_at as string
    if (e.method) cur.methods.add(String(e.method))
    people.set(key, cur)
  }

  const rows: AdoptionRow[] = [...people.entries()]
    .map(([email, v]) => ({
      email,
      name: v.name,
      role: v.role || 'unknown',
      logins: v.logins,
      lastSeen: v.last || null,
      daysSinceSeen: v.last ? Math.floor((now.getTime() - new Date(v.last).getTime()) / DAY) : null,
      methods: [...v.methods].sort().join(' + ') || 'unknown',
    }))
    .sort((a, b) => b.logins - a.logins || a.name.localeCompare(b.name))

  // Staff who have never appeared in the trail AT ALL (not just in range).
  //
  // ⚠️ JOIN ON user_id, NOT display_name. An earlier version matched
  // profiles.display_name against the login email and reported 10 of 11 staff as
  // never having signed in, when the real answer was 2 — display_name holds a
  // person's NAME ("Jacob Younker"), which never equals an email address.
  // login_events.user_id is populated on every row and is profiles.id.
  const everSeen = new Set(all.map(e => e.user_id as string).filter(Boolean))
  const staff = (profiles ?? []).filter(p => (p.role as string) !== 'customer')
  const never = staff
    .filter(p => !everSeen.has(p.id as string))
    .map(p => ({ label: `${prettyName(p.display_name as string, 'Unnamed')} · ${(p.role as string) ?? 'no role'}`, count: 0 }))

  const months = new Map<string, Set<string>>()
  for (const e of inRange) {
    const k = String(e.created_at).slice(0, 7)
    const who = String(e.email ?? '').toLowerCase()
    if (!who) continue
    ;(months.get(k) ?? months.set(k, new Set()).get(k)!).add(who)
  }

  const methodPeople = (m: string) => rows.filter(r => r.methods.includes(m)).length

  return {
    rangeKey: range.key,
    rangeLabel: range.label,
    totals: {
      activePeople: rows.length,
      totalLogins: inRange.length,
      staffAccounts: staff.length,
      neverSignedIn: never.length,
      ssoPeople: methodPeople('microsoft'),
      passwordPeople: methodPeople('password'),
      dormant30: rows.filter(r => (r.daysSinceSeen ?? 0) > 30).length,
    },
    byRole: tally(inRange.map(e => (e.role as string) || 'unknown')),
    byMethod: tally(inRange.map(e => (e.method as string) || 'unknown')),
    byPortal: tally(inRange.map(e => (e.portal as string) || 'unknown')),
    byMonth: [...months.entries()]
      .map(([label, set]) => ({ label, count: set.size }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    never,
    rows,
  }
}
