'use client'

import { Fragment, useMemo, useState } from 'react'
import { Search, ChevronsUpDown, ChevronUp, ChevronDown, Star } from 'lucide-react'
import type { Deal } from '@/lib/supabase'
import { computeWeighted, computeSummary } from '@/lib/deals'
import { formatCurrency } from '@/lib/utils'
import { HEADER_BOX, BODY_BOX, rowCx, Th, TableScroll, IdentityCell, filterPillCx } from '@/components/admin/list'

type Row = Deal & { weighted: number }
type SortKey = 'customer' | 'group_name' | 'assigned_to' | 'total_cost' | 'confidence' | 'weighted' | 'projected' | 'status'
type SortDir = 'asc' | 'desc'

// Mobile shows the top metrics only (customer / total cost / status) and the row
// opens the detail modal for everything else; the full grid appears at sm+.
const COLS = 'grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[30px_2fr_1.1fr_110px_84px_110px_100px_130px]'
const sortable = 'hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'

function cmpStr(a: string | null, b: string | null) {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b)
}
function cmpNum(a: number, b: number) { return a - b }

export default function PipelineView({
  deals,
  onStatusChange,
  onView,
  onToggleFocus,
}: {
  deals: Deal[]
  onStatusChange: (id: string, status: 'Won' | 'Lost' | null) => void
  onView: (id: string, orderedIds: string[]) => void
  onToggleFocus: (id: string, next: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const [repFilter, setRepFilter] = useState<string | null>(null) // null = All (grouped)
  const [sortKey, setSortKey] = useState<SortKey>('total_cost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'customer' || key === 'group_name' || key === 'assigned_to' ? 'asc' : 'desc') }
  }

  const rows: Row[] = useMemo(() => deals.map((d) => ({ ...d, weighted: computeWeighted(d) })), [deals])

  const repOptions = useMemo(() => [...new Set(rows.map((r) => r.group_name))].sort(), [rows])

  const q = search.trim().toLowerCase()
  const searched = q
    ? rows.filter((d) =>
        d.customer.toLowerCase().includes(q) ||
        d.group_name.toLowerCase().includes(q) ||
        (d.assigned_to || '').toLowerCase().includes(q) ||
        (d.rep || '').toLowerCase().includes(q),
      )
    : rows

  const sorted = useMemo(() => {
    const out = [...searched].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'customer':    cmp = a.customer.localeCompare(b.customer); break
        case 'group_name':  cmp = a.group_name.localeCompare(b.group_name); break
        case 'assigned_to': cmp = cmpStr(a.assigned_to, b.assigned_to); break
        case 'total_cost':  cmp = cmpNum(a.total_cost, b.total_cost); break
        case 'confidence':  cmp = cmpNum(a.confidence, b.confidence); break
        case 'weighted':    cmp = cmpNum(a.weighted, b.weighted); break
        case 'projected':   cmp = cmpStr(a.projected, b.projected); break
        case 'status':      cmp = cmpStr(a.status, b.status); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return out
  }, [searched, sortKey, sortDir])

  // A specific rep → flat filtered list; All → grouped sections with a band.
  const shown = repFilter ? sorted.filter((d) => d.group_name === repFilter) : sorted

  const groups = useMemo(() => {
    if (repFilter) return null
    const byGroup = new Map<string, Row[]>()
    for (const d of sorted) {
      const list = byGroup.get(d.group_name) ?? []
      list.push(d)
      byGroup.set(d.group_name, list)
    }
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [sorted, repFilter])

  const summary = useMemo(() => computeSummary(shown), [shown])

  // Ids in on-screen order — the detail modal's prev/next walks this.
  const visibleIds = useMemo(
    () => (groups ? groups.flatMap(([, r]) => r) : shown).map((d) => d.id),
    [groups, shown],
  )
  const view = (id: string) => onView(id, visibleIds)

  return (
    <div>
      {/* Summary strip — reacts to the current search + rep filter. Phones keep
          only the two headline numbers; the count tiles return at sm+. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
        <StatTile label="Total Value" value={formatCurrency(summary.totalCost)} />
        <StatTile label="Weighted" value={formatCurrency(summary.totalWeighted)} accent />
        <StatTile label="Open" value={String(summary.openCount)} className="hidden sm:block" />
        <StatTile label="Won" value={String(summary.wonCount)} tone="emerald" className="hidden sm:block" />
        <StatTile label="Lost" value={String(summary.lostCount)} tone="rose" className="hidden sm:block" />
        <StatTile label="Win Rate" value={summary.winRate === null ? '—' : `${summary.winRate.toFixed(0)}%`} className="hidden sm:block" />
      </div>

      {/* Toolbar: search + rep filter pills */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, group, rep…"
            className="pl-8 pr-3 h-9 text-[12.5px] w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap ml-auto">
          <button onClick={() => setRepFilter(null)} className={filterPillCx(repFilter === null)}>All reps</button>
          {repOptions.map((g) => (
            <button key={g} onClick={() => setRepFilter(g)} className={filterPillCx(repFilter === g)}>{g}</button>
          ))}
        </div>
      </div>

      <TableScroll minWidth={900}>
        <div className={`hidden sm:grid ${COLS} ${HEADER_BOX}`}>
          <Th />
          <Th><button onClick={() => toggleSort('customer')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Customer <SortIcon col="customer" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th><button onClick={() => toggleSort('assigned_to')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Assigned <SortIcon col="assigned_to" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th align="right"><button onClick={() => toggleSort('total_cost')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Total Cost <SortIcon col="total_cost" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th align="right"><button onClick={() => toggleSort('confidence')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Conf. <SortIcon col="confidence" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th align="right"><button onClick={() => toggleSort('weighted')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Weighted <SortIcon col="weighted" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th><button onClick={() => toggleSort('projected')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Projected <SortIcon col="projected" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th>Status</Th>
        </div>

        <div className={BODY_BOX}>
          {shown.length === 0 ? (
            <EmptyRow />
          ) : groups ? (
            groups.map(([group, groupRows]) => {
              const gs = computeSummary(groupRows)
              return (
                <Fragment key={group}>
                  <RepBand group={group} count={groupRows.length} total={gs.totalCost} weighted={gs.totalWeighted} />
                  {groupRows.map((d, i) => <DealRow key={d.id} d={d} i={i + 1} onStatusChange={onStatusChange} onOpen={view} onToggleFocus={onToggleFocus} />)}
                </Fragment>
              )
            })
          ) : (
            shown.map((d, i) => <DealRow key={d.id} d={d} i={i} onStatusChange={onStatusChange} onOpen={view} onToggleFocus={onToggleFocus} />)
          )}
        </div>
      </TableScroll>
    </div>
  )
}

// Prominent per-rep separator band (replaces the old thin group line).
function RepBand({ group, count, total, weighted }: { group: string; count: number; total: number; weighted: number }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-100 dark:border-zinc-800/60 first:border-t-0 first:rounded-t-xl">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-semibold text-zinc-500 dark:text-zinc-300 flex-shrink-0">
          {group.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">{group}</p>
          <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider tabular-nums">{count} {count === 1 ? 'deal' : 'deals'}</p>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[12.5px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{formatCurrency(total)}</p>
        <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(weighted)} weighted</p>
      </div>
    </div>
  )
}

function DealRow({ d, i, onStatusChange, onOpen, onToggleFocus }: {
  d: Row; i: number
  onStatusChange: (id: string, status: 'Won' | 'Lost' | null) => void
  onOpen: (id: string) => void
  onToggleFocus: (id: string, next: boolean) => void
}) {
  const focused = d.focused === true
  return (
    <div className={`${rowCx(COLS, { i })} cursor-pointer`} onClick={() => onOpen(d.id)}>
      <div className="hidden sm:flex items-center justify-center">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFocus(d.id, !focused) }}
          title={focused ? 'Remove from Focused' : 'Add to Focused'}
          className="p-0.5 -m-0.5"
        >
          <Star size={15} className={focused ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-400 transition-colors'} />
        </button>
      </div>
      <IdentityCell title={d.customer} subtitle={d.group_name} />
      <div className="hidden sm:block min-w-0 text-zinc-600 dark:text-zinc-300 truncate">{d.assigned_to || '—'}</div>
      <div className="text-right tabular-nums text-zinc-700 dark:text-zinc-200">{formatCurrency(d.total_cost)}</div>
      <div className="hidden sm:block text-right tabular-nums text-zinc-500 dark:text-zinc-400">{d.confidence}%</div>
      <div className="hidden sm:block text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(d.weighted)}</div>
      <div className="hidden sm:block min-w-0 text-zinc-500 dark:text-zinc-400 truncate">{d.projected || '—'}</div>
      <div>
        <select
          value={d.status ?? ''}
          onChange={(e) => onStatusChange(d.id, e.target.value === '' ? null : (e.target.value as 'Won' | 'Lost'))}
          onClick={(e) => e.stopPropagation()}
          className={`text-[11px] font-semibold uppercase tracking-wider rounded-md px-2 py-[3px] border-0 outline-none cursor-pointer ${
            d.status === 'Won' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
            : d.status === 'Lost' ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400'
            : 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400'
          }`}
        >
          <option value="">Active</option>
          <option value="Won">Won</option>
          <option value="Lost">Lost</option>
        </select>
      </div>
    </div>
  )
}

function StatTile({ label, value, tone, accent, className = '' }: { label: string; value: string; tone?: 'emerald' | 'rose'; accent?: boolean; className?: string }) {
  const valueCls = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'rose' ? 'text-rose-500 dark:text-rose-400'
    : accent ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-zinc-900 dark:text-white'
  return (
    <div className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none px-3 py-2.5 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-1">{label}</p>
      <p className={`text-[17px] font-bold tabular-nums leading-none ${valueCls}`}>{value}</p>
    </div>
  )
}

function EmptyRow() {
  return (
    <div className="py-16 text-center">
      <p className="text-[13px] text-zinc-400 dark:text-zinc-500">No deals match.</p>
    </div>
  )
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={10} className="text-zinc-300 dark:text-zinc-600" />
  return sortDir === 'asc' ? <ChevronUp size={10} className="text-emerald-500" /> : <ChevronDown size={10} className="text-emerald-500" />
}
