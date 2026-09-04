import { supabaseAdmin } from '@/lib/supabase-admin'
import { prettyName } from '@/lib/display-name'
import PageChrome from '@/app/admin/PageChrome'
import {
  minutesBetween, payrollWeek, rollup,
  type ClockSettings, type Segment, type Shift,
} from '@/lib/time-clock'
import TimeClockAdminClient from './TimeClockAdminClient'

// ─── /admin/time-clock — the payroll side ────────────────────────────────────
//
// Gated on `time_clock` via ADMIN_PATH_PERMS. ⚠️ An unmapped /admin path falls
// back to `dashboard`, which five scoped roles hold, so leaving it out of that
// map would have opened everyone's hours to all of them rather than failing shut.

export const dynamic = 'force-dynamic'

export default async function TimeClockAdminPage({
  searchParams,
}: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams
  const { start, end } = sp.week ? payrollWeek(new Date(`${sp.week}T12:00:00Z`)) : payrollWeek()
  const startInstant = new Date(`${start}T00:00:00`).toISOString()
  const endInstant = new Date(`${end}T23:59:59.999`).toISOString()

  const [{ data: settings }, { data: weekShifts }, { data: emps }, { data: denials }] = await Promise.all([
    supabaseAdmin.from('time_clock_settings').select('*').maybeSingle(),
    supabaseAdmin.from('time_shifts').select('*').gte('started_at', startInstant).lte('started_at', endInstant),
    supabaseAdmin.from('employees').select('id, name, employee_number, is_hourly, is_active'),
    supabaseAdmin.from('time_clock_denials').select('*').order('attempted_at', { ascending: false }).limit(8),
  ])

  const shifts = (weekShifts ?? []) as Shift[]
  const { data: segRows } = shifts.length
    ? await supabaseAdmin.from('time_segments').select('*').in('shift_id', shifts.map(s => s.id))
    : { data: [] as Segment[] }
  const segments = (segRows ?? []) as Segment[]

  const empById = new Map((emps ?? []).map(e => [e.id, e]))
  const totals = rollup(shifts, segments)
    .map(r => ({ ...r, name: prettyName(empById.get(r.employee_id)?.name ?? 'Unknown') }))
    .sort((a, b) => b.paidMinutes - a.paidMinutes)

  // Who is on the clock this minute — the question a supervisor actually walks
  // up to this page to ask.
  const openShifts = shifts.filter(s => !s.ended_at)
  const openSegByShift = new Map(segments.filter(s => !s.ended_at).map(s => [s.shift_id, s]))
  const onNow = openShifts.map(s => {
    const seg = openSegByShift.get(s.id)
    return {
      id: s.id,
      name: prettyName(empById.get(s.employee_id)?.name ?? 'Unknown'),
      since: s.started_at,
      minutes: segments.filter(x => x.shift_id === s.id && x.kind !== 'lunch')
        .reduce((m, x) => m + minutesBetween(x.started_at, x.ended_at), 0),
      doing: seg?.kind === 'lunch' ? 'Lunch' : seg?.kind === 'break' ? 'Break' : seg?.job_number ? `Job ${seg.job_number}` : 'No job set',
      offsiteStart: typeof s.start_distance_m === 'number' && settings ? s.start_distance_m > settings.radius_m : false,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  const flaggedOut = shifts.filter(
    s => s.ended_at && typeof s.end_distance_m === 'number' && settings && s.end_distance_m > settings.radius_m,
  ).length

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <PageChrome record="Time Clock" />
      <TimeClockAdminClient
        settings={settings as ClockSettings}
        week={{ start, end }}
        onNow={onNow}
        totals={totals}
        denials={(denials ?? []).map(d => ({
          ...d,
          name: prettyName(empById.get(d.employee_id ?? '')?.name ?? 'Unknown'),
        }))}
        flaggedOut={flaggedOut}
        hourlyMissingNumber={(emps ?? []).filter(e => e.is_active && e.is_hourly && !e.employee_number).length}
      />
    </div>
  )
}
