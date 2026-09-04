import { NextRequest, NextResponse } from 'next/server'
import { requireTimeClockAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { decimalHours, etDate, payrollWeek, type Segment, type Shift } from '@/lib/time-clock'

// ─── The QuickBooks hand-off ─────────────────────────────────────────────────
//
// One row per employee per job per day, which is the grain QuickBooks time
// entries actually take. Rolling it up any coarser (a week per job) loses the
// day, and QuickBooks wants the day.
//
// ⚠️ DECIMAL HOURS, NEVER hh:mm. QuickBooks reads 7.25, not 7:15, and a colon
// imports as something else entirely.
//
// ⚠️ Open shifts are EXCLUDED. A row reading 3.10 hours because somebody is still
// on the clock would be entered into payroll as a finished day. The file says so
// in its header and the UI says so on the button, because a silently short week
// is the kind of error nobody catches until somebody is underpaid.

export const dynamic = 'force-dynamic'

const csvCell = (v: unknown) => {
  const s = String(v ?? '')
  // A leading =, +, - or @ makes Excel treat the cell as a formula. Job numbers
  // come from outside, so they are neutralised rather than trusted.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function GET(req: NextRequest) {
  const denied = await requireTimeClockAuth()
  if (denied) return denied

  const weekOf = req.nextUrl.searchParams.get('week')
  const { start, end } = weekOf ? payrollWeek(new Date(`${weekOf}T12:00:00Z`)) : payrollWeek()

  // Eastern day boundaries as instants — asked for as ET midnights rather than by
  // assuming a -04:00/-05:00 offset, so a week spanning a DST switch is right.
  const startInstant = new Date(`${start}T00:00:00`).toISOString()
  const endInstant = new Date(`${end}T23:59:59.999`).toISOString()

  const { data: shifts } = await supabaseAdmin
    .from('time_shifts').select('*')
    .gte('started_at', startInstant).lte('started_at', endInstant)
  const closed = ((shifts ?? []) as Shift[]).filter(s => s.ended_at)
  const openCount = (shifts ?? []).length - closed.length

  const { data: segs } = closed.length
    ? await supabaseAdmin.from('time_segments').select('*').in('shift_id', closed.map(s => s.id))
    : { data: [] as Segment[] }

  const { data: emps } = await supabaseAdmin
    .from('employees').select('id, name, employee_number')
  const empById = new Map((emps ?? []).map(e => [e.id, e]))

  // Per employee → per job → per DAY. rollup() in lib/time-clock is the weekly
  // view; payroll is entered by day, so the segments are walked again here at
  // that finer grain rather than re-deriving a day from a weekly total.
  // ⚠️ The bucket keeps its own parts rather than encoding them into the key and
  // splitting them back out. Job numbers are free text from outside this system:
  // any separator picked here — space, pipe, anything printable — is a character
  // some job number is eventually allowed to contain, and the split would then
  // silently attribute hours to the wrong job.
  const shiftOwner = new Map(closed.map(s => [s.id, s.employee_id]))
  const cells = new Map<string, { emp: string; job: string; day: string; mins: number }>()
  for (const seg of (segs ?? []) as Segment[]) {
    if (seg.kind === 'lunch') continue
    const emp = shiftOwner.get(seg.shift_id)
    if (!emp || !seg.ended_at) continue
    const mins = (Date.parse(seg.ended_at) - Date.parse(seg.started_at)) / 60_000
    if (mins <= 0) continue
    const job = seg.job_number?.trim() || ''
    const day = etDate(seg.started_at)
    const key = JSON.stringify([emp, job, day])
    const cell = cells.get(key)
    if (cell) cell.mins += mins
    else cells.set(key, { emp, job, day, mins })
  }

  const rows = [...cells.values()]
    .map(({ emp, job, day, mins }) => {
      const e = empById.get(emp)
      return {
        name: e?.name ?? 'Unknown',
        number: e?.employee_number ?? '',
        job: job || 'UNALLOCATED',
        day,
        hours: decimalHours(mins),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.day.localeCompare(b.day) || a.job.localeCompare(b.job))

  const lines = [
    `# IAT time clock - payroll week ${start} to ${end} (Eastern). Decimal hours. Lunch excluded.`,
    openCount > 0
      ? `# WARNING: ${openCount} shift(s) in this week are still open and are NOT in this file.`
      : '# All shifts in this week are closed.',
    ['Employee', 'Employee number', 'Date', 'Job number', 'Hours'].join(','),
    ...rows.map(r => [r.name, r.number, r.day, r.job, r.hours].map(csvCell).join(',')),
  ]

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="iat-time-${start}-to-${end}.csv"`,
    },
  })
}
