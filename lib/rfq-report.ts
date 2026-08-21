import { supabaseAdmin } from '@/lib/supabase-admin'
import { type Bucket, type RangeKey, DAY, median, rangeFor, tally } from '@/lib/report-shared'
import { ROOM_PRESETS, PROCESS_PRESETS } from '@/lib/rfq'

/* Quote-request reporting (/admin/reports/rfq).

   ⚠️ WHAT THIS CANNOT TELL YOU, and why: **quote-to-order conversion.** Nothing
   links an rfq_request to a deal — an RFQ is re-keyed into DryWare by hand (see
   docs/rfq-moisture-survey.md, "Known gaps"). Until that link exists, this
   reports demand and responsiveness, not yield. Do not add a conversion tile by
   guessing at a join on company name; a wrong conversion rate is worse than none.

   ⚠️ There is no location data beyond a free-text `location` string. The survey
   captures elevation, not coordinates, so there is no geographic view to build. */

export type RfqRow = {
  id: string
  reference: string
  track: string
  application: string
  company: string
  contact: string
  location: string
  status: string
  assignee: string
  createdAt: string
  assignedAt: string | null
  /** Hours from submission to someone taking it. Null while unassigned. */
  hoursToAssign: number | null
  ageDays: number
  dateRequired: string
}

export type RfqReport = {
  rangeKey: RangeKey
  rangeLabel: string
  totals: {
    submitted: number
    roomTrack: number
    processTrack: number
    unassigned: number
    medianHoursToAssign: number | null
    oldestUnassignedDays: number | null
    withDeadline: number
  }
  byApplication: Bucket[]
  byStatus: Bucket[]
  byCompany: Bucket[]
  byAssignee: Bucket[]
  byMonth: Bucket[]
  rows: RfqRow[]
}

/** preset key → the label a human recognises, so the report does not read as
 *  `dry-room` and `pharma-process`. Falls back to the stored label. */
const PRESET_LABEL = new Map<string, string>([
  ...ROOM_PRESETS.map(p => [p.key, p.label] as [string, string]),
  ...PROCESS_PRESETS.map(p => [p.key, p.label] as [string, string]),
])

export async function buildRfqReport(rangeKey: RangeKey, now: Date = new Date()): Promise<RfqReport> {
  const range = rangeFor(rangeKey, now)

  const { data, error } = await supabaseAdmin
    .from('rfq_requests')
    .select('id, reference, track, application, application_label, company, contact_name, location, status, assignee_name, assigned_at, created_at, date_required')
    .order('created_at', { ascending: false })
    .limit(20000)

  if (error) console.error('[rfq-report] read failed:', error.message)

  const rows: RfqRow[] = (data ?? []).map(r => {
    const created = new Date(r.created_at as string)
    const assigned = r.assigned_at ? new Date(r.assigned_at as string) : null
    const key = (r.application as string) ?? ''
    return {
      id: r.id as string,
      reference: (r.reference as string) ?? '',
      track: (r.track as string) ?? '',
      application: PRESET_LABEL.get(key) ?? ((r.application_label as string) || key || 'Not specified'),
      company: ((r.company as string) ?? '').trim(),
      contact: ((r.contact_name as string) ?? '').trim(),
      location: ((r.location as string) ?? '').trim(),
      status: (r.status as string) ?? '',
      assignee: ((r.assignee_name as string) ?? '').trim() || 'Unassigned',
      createdAt: r.created_at as string,
      assignedAt: r.assigned_at as string | null,
      hoursToAssign: assigned ? Math.round(((assigned.getTime() - created.getTime()) / 3_600_000) * 10) / 10 : null,
      ageDays: Math.floor((now.getTime() - created.getTime()) / DAY),
      dateRequired: ((r.date_required as string) ?? '').trim(),
    }
  })

  const inRange = rows.filter(r => !range.from || new Date(r.createdAt) >= range.from)
  const unassigned = inRange.filter(r => r.assignee === 'Unassigned')
  const assignTimes = inRange.map(r => r.hoursToAssign).filter((n): n is number => n != null)

  const months = new Map<string, number>()
  for (const r of inRange) {
    const k = r.createdAt.slice(0, 7)
    months.set(k, (months.get(k) ?? 0) + 1)
  }

  return {
    rangeKey: range.key,
    rangeLabel: range.label,
    totals: {
      submitted: inRange.length,
      roomTrack: inRange.filter(r => r.track === 'room').length,
      processTrack: inRange.filter(r => r.track === 'process').length,
      unassigned: unassigned.length,
      medianHoursToAssign: median(assignTimes),
      oldestUnassignedDays: unassigned.length ? Math.max(...unassigned.map(r => r.ageDays)) : null,
      withDeadline: inRange.filter(r => r.dateRequired).length,
    },
    byApplication: tally(inRange.map(r => r.application), 'Not specified'),
    byStatus: tally(inRange.map(r => r.status)),
    byCompany: tally(inRange.map(r => r.company), 'No company given').slice(0, 15),
    byAssignee: tally(inRange.map(r => r.assignee)),
    byMonth: [...months.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label)),
    rows,
  }
}
