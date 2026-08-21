import { supabaseAdmin } from '@/lib/supabase-admin'
import { ticketLifecycles } from '@/lib/ticket-history'
import { RANGES, type RangeKey, type Bucket, type OwnerStat, type MonthPoint, type ReportRow, type TicketReport } from '@/lib/ticket-report-types'

export { RANGES }
export type { RangeKey, Bucket, OwnerStat, MonthPoint, ReportRow, TicketReport }

/* Support-ticket reporting.
   ────────────────────────────────────────────────────────────────────────────
   What this answers, and why each one is here rather than being a number for
   its own sake:

     Opened / Closed / Net      is the backlog growing or shrinking
     Reopen rate                did we call things done that were not done
     Median days to close       how long a customer actually waits
     Aging buckets              which specific tickets have gone quiet
     By owner                   workload and throughput, not a leaderboard
     By company                 which customers absorb the most support
     By model                   which EQUIPMENT keeps coming back — the one
                                that can change what gets built, not just who
                                answers the phone
     Resolution reasons         what actually fixes these machines

   ⚠️ Close times come from the AUDIT TRAIL, not a column — see
   lib/ticket-history.ts for why, and for what "no close row" means. Anything
   here that depends on a close date is therefore blank rather than wrong for a
   ticket closed through a path that did not audit.

   Medians, not means, throughout. One ticket left open over a holiday shutdown
   drags a mean into uselessness, and support data is full of those. */

const DAY = 86_400_000

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10
}

/** Descending count, then name, so equal counts do not shuffle between loads. */
function tally(pairs: (string | null | undefined)[], fallback = 'Not recorded'): Bucket[] {
  const m = new Map<string, number>()
  for (const raw of pairs) {
    const k = (raw ?? '').trim() || fallback
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export async function buildTicketReport(rangeKey: RangeKey, now: Date = new Date()): Promise<TicketReport> {
  const range = RANGES.find(r => r.key === rangeKey) ?? RANGES[3]
  const from = range.days ? new Date(now.getTime() - range.days * DAY) : null

  const [{ data: tickets, error }, { data: employees }] = await Promise.all([
    supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, customer_name, customer_company, model_number, serial_number, status, priority, request_type, owner_id, created_at, resolved_reason')
      .order('created_at', { ascending: false })
      .limit(20000),
    supabaseAdmin.from('employees').select('id, name'),
  ])

  if (error) console.error('[ticket-report] ticket read failed:', error.message)

  const all = tickets ?? []
  const names = new Map((employees ?? []).map(e => [e.id as string, e.name as string]))
  const lifecycles = await ticketLifecycles(all.map(t => t.id as string))

  const rows: ReportRow[] = all.map(t => {
    const lc = lifecycles[t.id as string] ?? { closedAt: null, firstClosedAt: null, reopenCount: 0 }
    const created = new Date(t.created_at as string)
    const closed = lc.closedAt ? new Date(lc.closedAt) : null
    const firstClosed = lc.firstClosedAt ? new Date(lc.firstClosedAt) : null
    return {
      id: t.id as string,
      ticketNumber: (t.ticket_number as string) ?? '',
      customer: (t.customer_name as string) ?? '',
      company: ((t.customer_company as string) ?? '').trim(),
      model: ((t.model_number as string) ?? '').trim(),
      serial: ((t.serial_number as string) ?? '').trim(),
      status: (t.status as string) ?? '',
      priority: (t.priority as string) ?? '',
      requestType: (t.request_type as string) ?? 'support',
      owner: t.owner_id ? (names.get(t.owner_id as string) ?? 'Unknown') : 'Unassigned',
      createdAt: t.created_at as string,
      closedAt: lc.closedAt,
      reopenCount: lc.reopenCount,
      // First close, so a reopen does not flatter the number.
      daysToClose: firstClosed ? Math.round(((firstClosed.getTime() - created.getTime()) / DAY) * 10) / 10 : null,
      ageDays: closed ? null : Math.floor((now.getTime() - created.getTime()) / DAY),
      resolvedReason: ((t.resolved_reason as string) ?? '').trim(),
    }
  })

  const inRange = (iso: string | null) => !!iso && (!from || new Date(iso) >= from)

  const openedInRange = rows.filter(r => inRange(r.createdAt))
  const closedInRange = rows.filter(r => inRange(r.closedAt))
  // A reopen has no date of its own here (the count is a total), so it is
  // attributed to the ticket's own window. Honest for "all time"; approximate for
  // a short range, and labeled as such in the UI.
  const reopenedInRange = rows.filter(r => r.reopenCount > 0 && inRange(r.createdAt))

  const notClosed = rows.filter(r => r.status !== 'closed')
  const closeTimes = closedInRange.map(r => r.daysToClose).filter((n): n is number => n != null)
  const everClosed = rows.filter(r => r.closedAt || r.status === 'closed').length

  const ages = notClosed.map(r => r.ageDays ?? 0)
  const bucketOf = (d: number) => (d <= 7 ? '0–7 days' : d <= 30 ? '8–30 days' : d <= 90 ? '31–90 days' : 'Over 90 days')
  const agingOrder = ['0–7 days', '8–30 days', '31–90 days', 'Over 90 days']
  const agingMap = tally(notClosed.map(r => bucketOf(r.ageDays ?? 0)))
  const aging = agingOrder.map(label => ({ label, count: agingMap.find(b => b.label === label)?.count ?? 0 }))

  const owners = new Map<string, { assigned: number; closed: number; times: number[] }>()
  for (const r of rows) {
    const cur = owners.get(r.owner) ?? { assigned: 0, closed: 0, times: [] }
    cur.assigned += 1
    if (r.closedAt) {
      cur.closed += 1
      if (r.daysToClose != null) cur.times.push(r.daysToClose)
    }
    owners.set(r.owner, cur)
  }
  const byOwner: OwnerStat[] = [...owners.entries()]
    .map(([owner, v]) => ({ owner, assigned: v.assigned, closed: v.closed, medianDaysToClose: median(v.times) }))
    .sort((a, b) => b.assigned - a.assigned || a.owner.localeCompare(b.owner))

  const monthKey = (iso: string) => iso.slice(0, 7)
  const months = new Map<string, { opened: number; closed: number }>()
  for (const r of rows) {
    if (inRange(r.createdAt)) {
      const k = monthKey(r.createdAt)
      const c = months.get(k) ?? { opened: 0, closed: 0 }
      c.opened += 1
      months.set(k, c)
    }
    if (inRange(r.closedAt) && r.closedAt) {
      const k = monthKey(r.closedAt)
      const c = months.get(k) ?? { opened: 0, closed: 0 }
      c.closed += 1
      months.set(k, c)
    }
  }
  const monthly: MonthPoint[] = [...months.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    rangeKey: range.key,
    rangeLabel: range.label,
    from: from ? from.toISOString() : null,
    totals: {
      openedInRange: openedInRange.length,
      closedInRange: closedInRange.length,
      net: openedInRange.length - closedInRange.length,
      reopenedInRange: reopenedInRange.length,
      openNow: notClosed.length,
      unassignedNow: notClosed.filter(r => r.owner === 'Unassigned').length,
      medianDaysToClose: median(closeTimes),
      reopenRatePct: everClosed ? Math.round((rows.filter(r => r.reopenCount > 0).length / everClosed) * 1000) / 10 : null,
      oldestOpenDays: ages.length ? Math.max(...ages) : null,
    },
    aging,
    byStatus: tally(rows.map(r => r.status)),
    byOwner,
    byCompany: tally(openedInRange.map(r => r.company), 'No company given').slice(0, 15),
    byModel: tally(openedInRange.map(r => r.model), 'No model given').slice(0, 15),
    byReason: tally(closedInRange.map(r => r.resolvedReason), 'No reason recorded'),
    monthly,
    rows,
  }
}
