'use client'

import { useMemo, useState } from 'react'
import { ChevronsUpDown, ChevronUp, ChevronDown, Trash2, Maximize2 } from 'lucide-react'
import type { Deal } from '@/lib/supabase'
import { computeWeighted, isFocused } from '@/lib/deals'
import { formatCurrency } from '@/lib/utils'
import { HEADER_BOX, BODY_BOX, rowCx, Th, TableScroll, IdentityCell } from '@/components/admin/list'

type Row = Deal & { weighted: number }
type SortKey = 'customer' | 'assigned_to' | 'total_cost' | 'confidence' | 'weighted' | 'projected'
type SortDir = 'asc' | 'desc'

const COLS = 'grid-cols-[1.6fr_100px_100px_110px_120px_1.8fr_56px]'
const sortable = 'hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'
const editable = 'w-full bg-transparent border border-transparent rounded-md px-1.5 py-1 -mx-1.5 text-zinc-800 dark:text-zinc-100 outline-none hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors'

function cmpStr(a: string | null, b: string | null) {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b)
}

export default function FocusedView({
  deals,
  onPatchLocal,
  onPersist,
  onDelete,
  onView,
}: {
  deals: Deal[]
  onPatchLocal: (id: string, patch: Partial<Deal>) => void
  onPersist: (id: string, patch: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onView: (id: string, orderedIds: string[]) => void
}) {
  const [assignedFilter, setAssignedFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('weighted')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  // Rows whose inline inputs currently have focus. isFocused() is re-evaluated
  // on every keystroke (the inputs patch shared state onChange), so without
  // this a deal qualifying only via confidence would unmount mid-edit the
  // moment a partial value dips below 60 — and an unmounted input never fires
  // onBlur, silently dropping the persist. Editing rows stay mounted until blur.
  const [editing, setEditing] = useState<Set<string>>(new Set())

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const assignedOptions = useMemo(
    () => [...new Set(deals.map((d) => d.assigned_to).filter((v): v is string => !!v))].sort(),
    [deals],
  )
  const groupOptions = useMemo(() => [...new Set(deals.map((d) => d.group_name))].sort(), [deals])

  const rows: Row[] = useMemo(() => deals.map((d) => ({ ...d, weighted: computeWeighted(d) })), [deals])

  const focused = rows.filter((d) => isFocused(d) || editing.has(d.id))
  const filtered = focused.filter((d) =>
    (!assignedFilter || d.assigned_to === assignedFilter) &&
    (!groupFilter || d.group_name === groupFilter),
  )

  const markEditing = (id: string) =>
    setEditing((prev) => { const next = new Set(prev); next.add(id); return next })
  const unmarkEditing = (id: string) =>
    setEditing((prev) => { const next = new Set(prev); next.delete(id); return next })

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'customer':    cmp = a.customer.localeCompare(b.customer); break
        case 'assigned_to': cmp = cmpStr(a.assigned_to, b.assigned_to); break
        case 'total_cost':  cmp = a.total_cost - b.total_cost; break
        case 'confidence':  cmp = a.confidence - b.confidence; break
        case 'weighted':    cmp = a.weighted - b.weighted; break
        case 'projected':   cmp = cmpStr(a.projected, b.projected); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const setConfidence = (d: Row, raw: string) => {
    const n = Math.round(Math.max(0, Math.min(100, Number(raw) || 0)))
    onPatchLocal(d.id, { confidence: n })
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          className="h-9 text-[12.5px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-200 px-2.5 outline-none focus:border-emerald-500/50"
        >
          <option value="">Everyone</option>
          {assignedOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="h-9 text-[12.5px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-200 px-2.5 outline-none focus:border-emerald-500/50"
        >
          <option value="">All groups</option>
          {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="ml-auto text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">
          {filtered.length} of {focused.length} focused {focused.length === 1 ? 'deal' : 'deals'}
        </span>
      </div>

      <TableScroll minWidth={880}>
        <div className={`grid ${COLS} ${HEADER_BOX}`}>
          <Th><button onClick={() => toggleSort('customer')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Customer <SortIcon col="customer" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th align="right"><button onClick={() => toggleSort('total_cost')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Cost <SortIcon col="total_cost" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th align="right"><button onClick={() => toggleSort('confidence')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Conf. <SortIcon col="confidence" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th align="right"><button onClick={() => toggleSort('weighted')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Weighted <SortIcon col="weighted" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th>Projected</Th>
          <Th>Notes</Th>
          <Th />
        </div>

        <div className={BODY_BOX}>
          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">
                {focused.length === 0 ? 'Nothing needs attention right now.' : 'No focused deals match this filter.'}
              </p>
            </div>
          ) : (
            sorted.map((d, i) => (
              <div key={d.id} className={rowCx(COLS, { i })}>
                <IdentityCell title={d.customer} subtitle={d.assigned_to || undefined} />
                <div className="text-right tabular-nums text-zinc-700 dark:text-zinc-200">{formatCurrency(d.total_cost)}</div>
                <div className="text-right">
                  <input
                    type="number" min={0} max={100} step={1}
                    value={d.confidence}
                    onFocus={() => markEditing(d.id)}
                    onChange={(e) => setConfidence(d, e.target.value)}
                    onBlur={(e) => {
                      onPersist(d.id, { confidence: Math.round(Math.max(0, Math.min(100, Number(e.target.value) || 0))) })
                      unmarkEditing(d.id)
                    }}
                    className={`${editable} text-right tabular-nums`}
                  />
                </div>
                <div className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(d.weighted)}</div>
                <div className="min-w-0">
                  <input
                    value={d.projected || ''}
                    placeholder="e.g. Q4 2026"
                    onFocus={() => markEditing(d.id)}
                    onChange={(e) => onPatchLocal(d.id, { projected: e.target.value || null })}
                    onBlur={(e) => {
                      onPersist(d.id, { projected: e.target.value || null })
                      unmarkEditing(d.id)
                    }}
                    className={`${editable} placeholder:text-zinc-300 dark:placeholder:text-zinc-600`}
                  />
                </div>
                <div className="min-w-0">
                  <input
                    value={d.notes || ''}
                    placeholder="Add a note…"
                    onFocus={() => markEditing(d.id)}
                    onChange={(e) => onPatchLocal(d.id, { notes: e.target.value || null })}
                    onBlur={(e) => {
                      onPersist(d.id, { notes: e.target.value || null })
                      unmarkEditing(d.id)
                    }}
                    className={`${editable} placeholder:text-zinc-300 dark:placeholder:text-zinc-600`}
                  />
                </div>
                <div className="flex justify-center items-center gap-2">
                  <button
                    onClick={() => onView(d.id, sorted.map((s) => s.id))}
                    className="text-zinc-300 dark:text-zinc-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    title="View deal"
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete the ${d.customer} deal?`)) onDelete(d.id) }}
                    className="text-zinc-300 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                    title="Delete deal"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </TableScroll>
    </div>
  )
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={10} className="text-zinc-300 dark:text-zinc-600" />
  return sortDir === 'asc' ? <ChevronUp size={10} className="text-emerald-500" /> : <ChevronDown size={10} className="text-emerald-500" />
}
