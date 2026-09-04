// ─── Time clock — the shared model ───────────────────────────────────────────
//
// One place for the geofence maths, the state machine and the rollup that the
// weekly report and the QuickBooks export both read. The punch UI, the API route
// and the admin report all import from here so "what counts as paid" is answered
// once.
//
// Everything is stored in UTC (timestamptz) and REPORTED in Eastern — IAT is one
// site in Georgia and payroll weeks are the office's weeks, not UTC's. Read the
// date through Intl with a timeZone rather than an offset, so the week boundary
// survives both daylight-saving switches.

export type PunchAction =
  | 'clock_in'
  | 'clock_out'
  | 'lunch_start'
  | 'lunch_end'
  | 'break_start'
  | 'break_end'
  | 'switch_job'

export type SegmentKind = 'work' | 'lunch' | 'break'

export type ClockSettings = {
  site_label: string
  lat: number
  lng: number
  radius_m: number
  max_accuracy_m: number
  enforce_geofence: boolean
}

export type Segment = {
  id: string
  shift_id: string
  kind: SegmentKind
  job_number: string | null
  started_at: string
  ended_at: string | null
}

export type Shift = {
  id: string
  employee_id: string
  started_at: string
  ended_at: string | null
  start_distance_m: number | null
  end_distance_m: number | null
  source: string
  edited_by: string | null
  edit_note: string | null
  notes: string | null
}

/**
 * 🔴 LUNCH IS UNPAID, BREAKS ARE PAID.
 *
 * Stated here as a constant rather than assumed at four call sites, because it is
 * the one number payroll will argue about and it must be changeable in one place.
 * If IAT ever pays lunch, flip this and every total — live board, weekly report
 * and CSV — moves together.
 */
export const PAID_KINDS: readonly SegmentKind[] = ['work', 'break']

/** Distance in metres between two lat/lng points. Haversine on a spherical earth:
 *  good to ~0.5% over a few hundred metres, which is far tighter than the phone
 *  GPS it is comparing against. */
export function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_008.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export type FenceVerdict =
  | { ok: true; distance_m: number | null }
  | { ok: false; distance_m: number | null; reason: string }

/**
 * Is this fix good enough, and close enough, to punch on?
 *
 * ⚠️ Called on the SERVER with the browser's raw coordinates. The browser is never
 * asked whether it is inside — it reports where it thinks it is and the server
 * decides, so a patched client cannot assert its way in. This is a deterrent, not
 * proof: a determined person can feed the browser a fake location, and no
 * client-side geolocation can prevent that. It stops clocking in from the sofa,
 * which is the actual problem.
 */
export function checkFence(
  settings: ClockSettings,
  fix: { lat?: number | null; lng?: number | null; accuracy_m?: number | null },
): FenceVerdict {
  if (!settings.enforce_geofence) {
    const d =
      typeof fix.lat === 'number' && typeof fix.lng === 'number'
        ? metresBetween(settings.lat, settings.lng, fix.lat, fix.lng)
        : null
    return { ok: true, distance_m: d }
  }

  if (typeof fix.lat !== 'number' || typeof fix.lng !== 'number') {
    return { ok: false, distance_m: null, reason: 'no_location' }
  }

  // A fix this vague is not evidence of being anywhere. Accepting it would make
  // the fence decorative: a 5km accuracy circle "contains" the office from home.
  if (typeof fix.accuracy_m === 'number' && fix.accuracy_m > settings.max_accuracy_m) {
    return {
      ok: false,
      distance_m: metresBetween(settings.lat, settings.lng, fix.lat, fix.lng),
      reason: 'accuracy',
    }
  }

  const distance_m = metresBetween(settings.lat, settings.lng, fix.lat, fix.lng)
  // Credit the reported accuracy: if the circle they might be in touches the
  // site, they get the benefit of the doubt. Refusing someone standing at the
  // door because the phone is unsure is the failure that gets a time clock
  // abandoned.
  const slack = typeof fix.accuracy_m === 'number' ? Math.min(fix.accuracy_m, settings.max_accuracy_m) : 0
  if (distance_m - slack > settings.radius_m) {
    return { ok: false, distance_m, reason: 'too_far' }
  }
  return { ok: true, distance_m }
}

export function fenceMessage(reason: string, settings: ClockSettings, distance_m: number | null): string {
  const away = distance_m == null ? '' : ` You are about ${Math.round(distance_m).toLocaleString()}m from ${settings.site_label}.`
  if (reason === 'no_location') return 'Location is off, so the clock cannot tell you are at the shop. Turn on location for this site and try again.'
  if (reason === 'accuracy') return `Your phone is not sure where it is yet — give it a few seconds outside a metal building and try again.${away}`
  return `You have to be at ${settings.site_label} to punch.${away} If you are here, tell an admin — the pin may need moving.`
}

// ─── The state machine ───────────────────────────────────────────────────────

export type ClockState = 'off' | 'working' | 'lunch' | 'break'

export function stateOf(shift: Shift | null, openSegment: Segment | null): ClockState {
  if (!shift || shift.ended_at) return 'off'
  if (!openSegment) return 'working'
  if (openSegment.kind === 'lunch') return 'lunch'
  if (openSegment.kind === 'break') return 'break'
  return 'working'
}

/** Which actions make sense right now. The UI renders exactly these, so an
 *  impossible button is never drawn and the route never has to explain one. */
export function allowedActions(state: ClockState): PunchAction[] {
  switch (state) {
    case 'off':     return ['clock_in']
    case 'working': return ['switch_job', 'lunch_start', 'break_start', 'clock_out']
    case 'lunch':   return ['lunch_end', 'clock_out']
    case 'break':   return ['break_end', 'clock_out']
  }
}

// ─── Durations and the payroll week ──────────────────────────────────────────

export function minutesBetween(startIso: string, endIso: string | null, now = Date.now()): number {
  const a = Date.parse(startIso)
  const b = endIso ? Date.parse(endIso) : now
  return Math.max(0, (b - a) / 60_000)
}

/** "6h 42m" — the form every readout uses. Hours never roll into days: a payroll
 *  reader wants 41h 15m, not "1d 17h". */
export function hhmm(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes))
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** Decimal hours to 2dp — what QuickBooks wants in the CSV, never hh:mm. */
export function decimalHours(totalMinutes: number): number {
  return Math.round((totalMinutes / 60) * 100) / 100
}

/** The Eastern calendar date of an instant, as YYYY-MM-DD. */
export function etDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/**
 * The Monday-to-Sunday payroll week containing `on`, as Eastern dates.
 * Monday because that is how the rest of the portal counts weeks
 * (coreValueOfWeek) — one convention, not two.
 */
export function payrollWeek(on: Date = new Date()): { start: string; end: string } {
  const ymd = etDate(on)
  const [y, m, d] = ymd.split('-').map(Number)
  const noonUtc = Date.UTC(y, m - 1, d, 12)
  const dow = new Date(noonUtc).getUTCDay() // 0 Sun … 6 Sat
  const backToMonday = (dow + 6) % 7
  const start = new Date(noonUtc - backToMonday * 86_400_000)
  const end = new Date(noonUtc + (6 - backToMonday) * 86_400_000)
  return { start: etDate(start), end: etDate(end) }
}

// ─── The rollup both the report and the export read ──────────────────────────

export type JobTotal = { job: string | null; minutes: number }
export type EmployeeRollup = {
  employee_id: string
  paidMinutes: number
  lunchMinutes: number
  jobs: JobTotal[]
  /** Paid minutes nobody attributed to a job. Shown, never hidden — an hour with
   *  no job on it is a question for the supervisor, not a rounding error. */
  unallocatedMinutes: number
  byDay: Record<string, number>
}

/**
 * Fold shifts + segments into per-employee payroll totals.
 *
 * ⚠️ Totals come from SEGMENTS, not from clock-in minus clock-out. The two agree
 * only when segments tile the shift perfectly, and they will not when a shift is
 * still open or was corrected by hand. Segments are the record of what was
 * actually being done, so they are the record that pays.
 */
export function rollup(shifts: Shift[], segments: Segment[], now = Date.now()): EmployeeRollup[] {
  const shiftOwner = new Map(shifts.map(s => [s.id, s.employee_id]))
  const out = new Map<string, EmployeeRollup>()
  const jobMap = new Map<string, Map<string, number>>()

  for (const seg of segments) {
    const employee_id = shiftOwner.get(seg.shift_id)
    if (!employee_id) continue
    const mins = minutesBetween(seg.started_at, seg.ended_at, now)
    if (mins <= 0) continue

    let r = out.get(employee_id)
    if (!r) {
      r = { employee_id, paidMinutes: 0, lunchMinutes: 0, jobs: [], unallocatedMinutes: 0, byDay: {} }
      out.set(employee_id, r)
      jobMap.set(employee_id, new Map())
    }

    if (seg.kind === 'lunch') { r.lunchMinutes += mins; continue }

    r.paidMinutes += mins
    const day = etDate(seg.started_at)
    r.byDay[day] = (r.byDay[day] ?? 0) + mins

    const key = seg.job_number?.trim() || ''
    const jm = jobMap.get(employee_id)!
    jm.set(key, (jm.get(key) ?? 0) + mins)
    if (!key) r.unallocatedMinutes += mins
  }

  for (const [employee_id, jm] of jobMap) {
    const r = out.get(employee_id)!
    r.jobs = [...jm.entries()]
      .map(([job, minutes]) => ({ job: job || null, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
  }
  return [...out.values()]
}
