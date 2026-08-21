import { supabaseAdmin } from '@/lib/supabase-admin'
import { type Bucket, type RangeKey, DAY, rangeFor, tally } from '@/lib/report-shared'

/* Tool crib reporting (/admin/reports/tools).

   The useful output here is a LIST, not a chart: who is holding what, and for
   how long. A distribution of tool categories is mildly interesting; "this meter
   has been out for six weeks and nobody has asked for it" is the thing that gets
   a tool back.

   ⚠️ The range filter applies to MOVEMENTS (check-outs, check-ins, transfers),
   because that is the only thing here that happens on a date. The out-now list
   deliberately ignores it — a tool checked out four months ago is exactly what
   you want at the top, and a date filter would hide precisely the worst case.

   ⚠️ `held_by` is an employees.id and the crib records `held_since` and `due_at`
   on the TOOL, not on an event. So "how long has this been out" comes from the
   tool row; the event trail is history, not current state. Reading duration from
   the last check_out event instead would go wrong the moment a tool is
   transferred between people without coming back. */

export type CribToolRow = {
  id: string
  tag: string
  name: string
  category: string
  makeModel: string
  status: string
  holder: string
  heldSince: string
  /** Whole days out. Null when not checked out. */
  daysOut: number | null
  dueAt: string
  /** Positive when past due. Null when no due date or not out. */
  daysOverdue: number | null
  cost: number
}

export type CribReport = {
  rangeKey: RangeKey
  rangeLabel: string
  totals: {
    tools: number
    checkedOut: number
    available: number
    overdue: number
    longestOutDays: number | null
    holders: number
    movementsInRange: number
    inventoryValue: number
  }
  outNow: Bucket[]
  overdue: Bucket[]
  byHolder: Bucket[]
  byCategory: Bucket[]
  byStatus: Bucket[]
  activityByMonth: Bucket[]
  byAction: Bucket[]
  rows: CribToolRow[]
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export async function buildCribReport(rangeKey: RangeKey, now: Date = new Date()): Promise<CribReport> {
  const range = rangeFor(rangeKey, now)

  const [{ data: tools, error }, { data: events }, { data: employees }] = await Promise.all([
    supabaseAdmin
      .from('crib_tools')
      .select('id, tag_code, name, category, make, model, status, held_by, held_since, due_at, purchase_cost')
      .limit(5000),
    supabaseAdmin
      .from('crib_events')
      .select('action, actor_name, subject_name, created_at')
      .order('created_at', { ascending: false })
      .limit(20000),
    supabaseAdmin.from('employees').select('id, name'),
  ])

  if (error) console.error('[crib-report] tool read failed:', error.message)

  const names = new Map((employees ?? []).map(e => [e.id as string, e.name as string]))
  const today = now.getTime()

  const rows: CribToolRow[] = (tools ?? []).map(t => {
    const out = (t.status as string) === 'checked_out'
    const since = (t.held_since as string) ?? ''
    const due = (t.due_at as string) ?? ''
    return {
      id: t.id as string,
      tag: ((t.tag_code as string) ?? '').trim(),
      name: ((t.name as string) ?? '').trim(),
      category: ((t.category as string) ?? '').trim(),
      makeModel: [t.make, t.model].filter(Boolean).join(' ').trim(),
      status: (t.status as string) ?? '',
      holder: t.held_by ? (names.get(t.held_by as string) ?? 'Unknown') : '',
      heldSince: since,
      daysOut: out && since ? Math.floor((today - new Date(since).getTime()) / DAY) : null,
      dueAt: due,
      daysOverdue: out && due ? Math.max(0, Math.floor((today - new Date(due).getTime()) / DAY)) || null : null,
      cost: num(t.purchase_cost),
    }
  })

  const out = rows.filter(r => r.status === 'checked_out')
  const overdue = out.filter(r => r.daysOverdue != null && r.daysOverdue > 0)
  const inRange = (events ?? []).filter(e => !range.from || new Date(e.created_at as string) >= range.from)

  const months = new Map<string, number>()
  for (const e of inRange) {
    const k = String(e.created_at).slice(0, 7)
    months.set(k, (months.get(k) ?? 0) + 1)
  }

  // Longest out first — this is a worklist, so the worst case leads.
  const bySoonest = [...out].sort((a, b) => (b.daysOut ?? 0) - (a.daysOut ?? 0))

  return {
    rangeKey: range.key,
    rangeLabel: range.label,
    totals: {
      tools: rows.length,
      checkedOut: out.length,
      available: rows.filter(r => r.status === 'available').length,
      overdue: overdue.length,
      longestOutDays: out.length ? Math.max(...out.map(r => r.daysOut ?? 0)) : null,
      holders: new Set(out.map(r => r.holder).filter(Boolean)).size,
      movementsInRange: inRange.length,
      inventoryValue: Math.round(rows.reduce((s, r) => s + r.cost, 0)),
    },
    outNow: bySoonest.map(r => ({
      label: `${r.tag || 'no tag'} · ${r.name || 'unnamed'} — ${r.holder || 'holder unknown'}`,
      count: r.daysOut ?? 0,
      note: r.dueAt ? `due ${r.dueAt}` : 'no due date',
    })),
    overdue: overdue
      .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0))
      .map(r => ({
        label: `${r.tag || 'no tag'} · ${r.name || 'unnamed'} — ${r.holder || 'holder unknown'}`,
        count: r.daysOverdue ?? 0,
        note: `due ${r.dueAt}`,
      })),
    byHolder: tally(out.map(r => r.holder), 'Holder not recorded'),
    byCategory: tally(rows.map(r => r.category), 'No category'),
    byStatus: tally(rows.map(r => r.status)),
    activityByMonth: [...months.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    byAction: tally(inRange.map(e => (e.action as string) ?? '')),
    rows,
  }
}
