'use client'

import { useMemo, useState } from 'react'
import { Search, ChevronsUpDown, ChevronUp, ChevronDown, MessageSquareText } from 'lucide-react'
import type { Deal } from '@/lib/supabase'
import { hasRecentActivity } from '@/lib/deals'
import { HEADER_BOX, BODY_BOX, rowCx, Th, TableScroll, StatusPill, DEAL_STATUS, IdentityCell } from '@/components/admin/list'

type SortKey = 'customer' | 'job_name' | 'unit_model' | 'rep' | 'rep_contact' | 'date_quoted' | 'status'
type SortDir = 'asc' | 'desc'

const COLS = 'grid-cols-[1.6fr_1fr_0.9fr_1fr_100px_90px_1.7fr]'
const sortable = 'hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'

// date_quoted is a bare Postgres `date` ('YYYY-MM-DD'). The shared formatDate
// would parse it as UTC midnight and render the PREVIOUS day anywhere west of
// UTC (all US timezones) — same trap RequestsQueueClient/EmployeeDetailClient
// already dodge with the T00:00:00 local-midnight suffix.
function formatDateOnly(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Nulls always sort last regardless of direction — flipping asc/desc should
// reorder the deals that HAVE a value, not surface the blank ones.
function cmpNullsLast(a: string | null, b: string | null, dir: SortDir, isDate = false) {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  const cmp = isDate ? new Date(a).getTime() - new Date(b).getTime() : a.localeCompare(b)
  return dir === 'asc' ? cmp : -cmp
}

export default function CRMView({ deals }: { deals: Deal[] }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date_quoted')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    // Text columns read A→Z on first click; only the date defaults to newest-first.
    else { setSortKey(key); setSortDir(key === 'date_quoted' ? 'desc' : 'asc') }
  }

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const q = search.trim().toLowerCase()
  const filtered = q
    ? deals.filter((d) =>
        d.customer.toLowerCase().includes(q) ||
        (d.job_name || '').toLowerCase().includes(q) ||
        (d.unit_model || '').toLowerCase().includes(q) ||
        (d.rep || '').toLowerCase().includes(q) ||
        (d.rep_contact || '').toLowerCase().includes(q),
      )
    : deals

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      cmpNullsLast(
        (a as unknown as Record<string, string | null>)[sortKey],
        (b as unknown as Record<string, string | null>)[sortKey],
        sortDir,
        sortKey === 'date_quoted',
      ),
    )
  }, [filtered, sortKey, sortDir])

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, job, model, rep…"
            className="pl-8 pr-3 h-9 text-[12.5px] w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all"
          />
        </div>
        <span className="ml-auto text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">
          {filtered.length} {filtered.length === 1 ? 'deal' : 'deals'}
        </span>
      </div>

      <TableScroll minWidth={900}>
        <div className={`grid ${COLS} ${HEADER_BOX}`}>
          <Th><button onClick={() => toggleSort('customer')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Customer <SortIcon col="customer" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th><button onClick={() => toggleSort('unit_model')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Unit Model <SortIcon col="unit_model" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th><button onClick={() => toggleSort('rep')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Rep <SortIcon col="rep" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th><button onClick={() => toggleSort('rep_contact')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Rep Contact <SortIcon col="rep_contact" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th><button onClick={() => toggleSort('date_quoted')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Quoted <SortIcon col="date_quoted" sortKey={sortKey} sortDir={sortDir} /></button></Th>
          <Th>Status</Th>
          <Th>Notes</Th>
        </div>

        <div className={BODY_BOX}>
          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">No deals match.</p>
            </div>
          ) : (
            sorted.map((d, i) => {
              const flagged = hasRecentActivity(d)
              const statusInfo = DEAL_STATUS[d.status ?? 'active']
              const note = d.notes || ''
              const isLong = note.length > 70
              const isExpanded = expanded.has(d.id)
              return (
                // Expanded notes need the row to grow — the shared ROW token
                // hard-codes h-[44px] and nothing clips overflow, so without
                // the override a wrapped note paints over the rows below it.
                <div key={d.id} className={`${rowCx(COLS, { i })} ${isExpanded ? 'py-2.5' : ''}`}>
                  <IdentityCell
                    leading={flagged ? <MessageSquareText size={13} className="text-emerald-500 flex-shrink-0" aria-label="Recent activity" /> : undefined}
                    title={d.customer}
                    subtitle={d.job_name || undefined}
                  />
                  <div className="min-w-0 text-zinc-600 dark:text-zinc-300 truncate">{d.unit_model || '—'}</div>
                  <div className="min-w-0 text-zinc-600 dark:text-zinc-300 truncate">{d.rep || '—'}</div>
                  <div className="min-w-0 text-zinc-500 dark:text-zinc-400 truncate">{d.rep_contact || '—'}</div>
                  <div className="min-w-0 text-zinc-500 dark:text-zinc-400 truncate">{d.date_quoted ? formatDateOnly(d.date_quoted) : '—'}</div>
                  <div><StatusPill tone={statusInfo.tone}>{statusInfo.label}</StatusPill></div>
                  <div className="min-w-0 text-zinc-500 dark:text-zinc-400">
                    {note ? (
                      <button
                        onClick={() => toggleExpanded(d.id)}
                        className={`text-left ${isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate block w-full'} hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors`}
                        title={isLong ? (isExpanded ? 'Click to collapse' : 'Click to expand') : undefined}
                      >
                        {isExpanded || !isLong ? note : `${note.slice(0, 70)}…`}
                      </button>
                    ) : '—'}
                  </div>
                </div>
              )
            })
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
