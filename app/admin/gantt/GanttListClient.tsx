'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CalendarRange, ChevronRight, Loader2, Filter } from 'lucide-react'
import { StatusPill, timeAgo, type Tone } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar, CardTable, Row,
  SortHeader, EmptyRow, Pagination, usePagedList, ListSearch, FilterDropdown,
  type FilterOption,
} from '@/components/admin/list-card'
import { layoutRange, addWeeks, fmtDate, fmtShort, type GanttChart } from '@/lib/gantt'
import { InfoTip } from './[id]/ui'
import { createChart } from './actions'

const STATUS_TONE: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'emerald' },
  complete: { label: 'Complete', tone: 'sky' },
  draft: { label: 'Draft', tone: 'slate' },
}

// Project | Ship Window | Tasks | Status | Updated | chevron. One template shared
// by the header + every row; wide screens let Project (2fr) eat the slack, narrow
// ones scroll sideways (CardTable bakes in the min-width + overflow).
const COLS = 'grid-cols-[minmax(200px,2fr)_200px_96px_110px_100px_36px]'

type SortKey = 'project' | 'ship' | 'tasks' | 'updated'
const NUMERIC_KEYS: SortKey[] = ['ship', 'tasks', 'updated']

// A chart plus everything the row needs, precomputed once (layoutRange is the
// expensive bit, and the ship sort needs its output).
type Derived = {
  chart: GanttChart
  windowTxt: string
  plan: string
  tcount: number
  meta: { label: string; tone: Tone }
  shipVal: number
  updatedVal: number
}

export default function GanttListClient({ charts }: { charts: GanttChart[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // View controls (all additive — the page had none before, so the default is the
  // server order: updated_at DESC, preserved by leaving sortKey null).
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('__all')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const make = async (kind: 'blank' | 'auckland') => {
    setBusy(kind)
    try {
      const { id } = await createChart(kind)
      router.push(`/admin/gantt/${id}`)
    } finally {
      setBusy(null)
    }
  }

  const rows = useMemo<Derived[]>(
    () =>
      charts.map((c) => {
        const R = layoutRange(c)
        return {
          chart: c,
          windowTxt: `${fmtShort(addWeeks(c.start_date, R.shipBest))} – ${fmtDate(addWeeks(c.start_date, R.shipWorst))}`,
          plan: fmtDate(addWeeks(c.start_date, R.ship)),
          tcount: c.tasks.filter((t) => t.kind === 'task').length,
          meta: STATUS_TONE[c.status] || STATUS_TONE.active,
          shipVal: R.ship,
          updatedVal: c.updated_at ? new Date(c.updated_at).getTime() : 0,
        }
      }),
    [charts],
  )

  const summary = useMemo(() => {
    let active = 0, complete = 0, tasks = 0
    for (const d of rows) {
      if (d.chart.status === 'active') active++
      else if (d.chart.status === 'complete') complete++
      tasks += d.tcount
    }
    return { active, complete, tasks }
  }, [rows])

  const statusOptions = useMemo<FilterOption[]>(() => {
    const present = new Set(charts.map((c) => c.status))
    return (['active', 'complete', 'draft'] as const)
      .filter((s) => present.has(s))
      .map((s) => ({ value: s, label: STATUS_TONE[s].label }))
  }, [charts])

  // status filter + search + sort → the working view (before pagination).
  const view = useMemo(() => {
    let r = rows
    if (statusFilter !== '__all') r = r.filter((d) => d.chart.status === statusFilter)
    const q = query.trim().toLowerCase()
    if (q) {
      r = r.filter((d) =>
        [d.chart.name, d.chart.customer].filter(Boolean).join(' ').toLowerCase().includes(q),
      )
    }
    if (!sortKey) return r // null = untouched server order (updated_at DESC)
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (d: Derived): number | string =>
      sortKey === 'project' ? d.chart.name.toLowerCase()
      : sortKey === 'ship' ? d.shipVal
      : sortKey === 'tasks' ? d.tcount
      : d.updatedVal
    return [...r].sort((a, b) => {
      const av = val(a), bv = val(b)
      return av < bv ? -1 * dir : av > bv ? dir : 0
    })
  }, [rows, statusFilter, query, sortKey, sortDir])

  const { page, setPage, perPage, setPerPage, totalPages, start, end } = usePagedList(view.length, {
    initialPerPage: 10,
    resetKey: `${statusFilter}|${query}|${sortKey}|${sortDir}`,
  })
  const pageRows = view.slice(start, end)

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir(NUMERIC_KEYS.includes(k) ? 'desc' : 'asc') }
  }

  const actions = (
    <>
      <button
        onClick={() => make('auckland')}
        disabled={!!busy}
        className="h-9 px-3 rounded-lg border border-hairline bg-surface-soft text-ink-secondary hover:border-hairline-strong text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60 transition-colors"
      >
        {busy === 'auckland' ? <Loader2 size={15} className="animate-spin" /> : <CalendarRange size={15} />} New from template
      </button>
      <button
        onClick={() => make('blank')}
        disabled={!!busy}
        className="h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60 transition-colors"
      >
        {busy === 'blank' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} New chart
      </button>
    </>
  )

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Planning"
          title="Gantt"
          count={
            <span className="inline-flex items-center gap-1 flex-wrap">
              {charts.length} project {charts.length === 1 ? 'timeline' : 'timelines'} · realistic ship-date forecasts for customer builds
              <InfoTip text={<>Each timeline shows a customer build as a <b>range</b> of ship dates, not one date — long-lead parts and testing rarely land exactly on plan. Open one and hover any <b>?</b> to see what a control does. The date to quote a customer is the <b>“80% confident by”</b> date — confirm it with the project lead before committing.</>} />
            </span>
          }
          actions={actions}
        />

        {charts.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <span className="w-11 h-11 rounded-xl bg-surface-strong flex items-center justify-center text-ink-muted mb-3">
              <CalendarRange size={20} />
            </span>
            <p className="text-[15px] font-semibold text-ink">No project timelines yet</p>
            <p className="text-[13px] text-ink-muted mt-1 max-w-sm">
              Create your first timeline to forecast a customer build&apos;s ship window.
            </p>
          </div>
        ) : (
          <>
            {/* ── Stat strip (dataset-wide summary) ── */}
            <StatStrip>
              <Stat tone="sky"     label="Timelines"   value={rows.length.toLocaleString()} />
              <Stat tone="emerald" label="Active"      value={summary.active.toLocaleString()} />
              <Stat tone="violet"  label="Complete"    value={summary.complete.toLocaleString()} />
              <Stat tone="amber"   label="Total tasks" value={summary.tasks.toLocaleString()} />
            </StatStrip>

            {/* ── Filters ── */}
            <Toolbar>
              <ListSearch value={query} onChange={setQuery} placeholder="Search timelines, customers…" />
              <FilterDropdown
                icon={Filter}
                allLabel="All statuses"
                value={statusFilter}
                options={statusOptions}
                onChange={setStatusFilter}
              />
              <div className="flex-1" />
              {(query || statusFilter !== '__all') && (
                <span className="text-[12px] text-ink-muted tabular-nums">
                  {view.length} match{view.length === 1 ? '' : 'es'}
                </span>
              )}
            </Toolbar>

            {/* ── Table ── */}
            <CardTable
              cols={COLS}
              minWidth={840}
              head={
                <>
                  <SortHeader label="Project" active={sortKey === 'project'} dir={sortDir} onClick={() => toggleSort('project')} />
                  <SortHeader label="Ship Window" active={sortKey === 'ship'} dir={sortDir} onClick={() => toggleSort('ship')} />
                  <SortHeader label="Tasks" active={sortKey === 'tasks'} dir={sortDir} onClick={() => toggleSort('tasks')} />
                  <span>Status</span>
                  <SortHeader label="Updated" active={sortKey === 'updated'} dir={sortDir} onClick={() => toggleSort('updated')} />
                  <span />
                </>
              }
            >
              {pageRows.map((d) => {
                const c = d.chart
                return (
                  <Row key={c.id} cols={COLS} href={`/admin/gantt/${c.id}`}>
                    {/* Identity — project name over customer */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-surface-soft flex items-center justify-center flex-shrink-0 text-ink-muted">
                        <CalendarRange size={13} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{c.name}</p>
                        <p className="text-[11.5px] text-ink-muted truncate">{c.customer || '—'}</p>
                      </div>
                    </div>

                    {/* Ship window (+ plan) */}
                    <div className="min-w-0">
                      <div className="text-[12.5px] text-ink-secondary tabular-nums truncate">{d.windowTxt}</div>
                      <div className="text-[11px] text-ink-muted tabular-nums truncate">plan {d.plan}</div>
                    </div>

                    {/* Tasks */}
                    <div className="text-[12.5px] text-ink-secondary tabular-nums">{d.tcount} {d.tcount === 1 ? 'task' : 'tasks'}</div>

                    {/* Status */}
                    <div><StatusPill tone={d.meta.tone}>{d.meta.label}</StatusPill></div>

                    {/* Updated */}
                    <div className="text-[12.5px] text-ink-muted tabular-nums">{c.updated_at ? timeAgo(c.updated_at) : '—'}</div>

                    {/* Chevron */}
                    <div className="flex justify-center">
                      <ChevronRight size={14} className="text-ink-faint group-hover:text-brand transition-colors" />
                    </div>
                  </Row>
                )
              })}

              {pageRows.length === 0 && <EmptyRow>No timelines match your search.</EmptyRow>}
            </CardTable>

            {/* ── Pagination ── */}
            <Pagination
              page={page}
              perPage={perPage}
              total={view.length}
              totalPages={totalPages}
              onPage={setPage}
              onPerPage={setPerPage}
              unit="timelines"
            />
          </>
        )}
      </ListCard>
    </ListCardPage>
  )
}
