'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react'
import type { TimeOffRequest, Employee } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import DeleteRecordButton from '@/components/admin/DeleteRecordButton'
import { useBulkSelect, SelectBox, BulkBar, BulkDeleteButton } from '@/components/admin/bulk-select'
import { StatusPill, tabCx, tabCountCx, type Tone } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar, CardTable, Row,
  EmptyRow, Pagination, usePagedList, ToneAvatar, ListSearch,
} from '@/components/admin/list-card'

type RequestWithEmployee = TimeOffRequest & { employees: Employee }
type Filter = 'all' | 'pending' | 'approved' | 'denied'

const STATUS_TONE: Record<string, { label: string; tone: Tone }> = {
  pending:  { label: 'Pending',  tone: 'amber'   },
  approved: { label: 'Approved', tone: 'emerald' },
  denied:   { label: 'Denied',   tone: 'rose'    },
}

// Select · Employee · Type · Balance · Status · Actions. One fixed grid shared by
// the header and every Row; the card table scrolls sideways below ~960px.
const COLS = 'grid-cols-[36px_minmax(220px,2.2fr)_100px_128px_112px_252px]'

// Date-only strings ("2026-07-07") — pin to local midnight so they never shift a day.
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RequestsQueueClient({
  requests,
  title = 'Time Off Requests',
}: {
  requests: RequestWithEmployee[]
  title?: string
}) {
  const router = useRouter()
  const sel = useBulkSelect()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<Filter>('pending')
  const [query, setQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Queue summary over the full dataset for this page. The /requests/[type]
  // routes are pre-scoped server-side, so these read PTO-only / sick-only there.
  const pendingReqs = requests.filter(r => r.status === 'pending')
  const pendingCount = pendingReqs.length
  const hoursPending = pendingReqs.reduce((a, r) => a + (r.hours_requested || 0), 0)
  const overBalance = pendingReqs.filter(r => {
    const bal = r.type === 'pto' ? r.employees?.pto_balance : r.employees?.sick_balance
    return (bal ?? Infinity) < r.hours_requested
  }).length

  // Tab filter + search → the working view (before pagination).
  const q = query.trim().toLowerCase()
  const filtered = requests.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false
    if (q) {
      const hay = [r.employees?.name, r.employees?.email, r.notes].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const allSelected = filtered.length > 0 && filtered.every(r => sel.has(r.id))

  // Clear the selection when the view changes so a bulk delete can never touch
  // requests outside what's on screen.
  useEffect(() => { sel.clear() }, [filter, query]) // eslint-disable-line react-hooks/exhaustive-deps

  const paged = usePagedList(filtered.length, { initialPerPage: 10, resetKey: `${filter}|${query}` })
  const pageRows = filtered.slice(paged.start, paged.end)

  const review = async (id: string, decision: 'approved' | 'denied') => {
    setActionLoading(id + decision)
    setActionError(null)
    const res = await fetch(`/api/requests/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    setActionLoading(null)
    if (!res.ok) {
      const d = await res.json()
      setActionError(d.error || 'Action failed')
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <ListCardPage>
      <ListCard>

        <CardHead
          overline="Time Off"
          title={title}
          count={pendingCount > 0 ? `${pendingCount} pending review` : 'All caught up'}
        />

        {/* Queue summary — hours & over-balance aren't visible in the tab counts */}
        <StatStrip>
          <Stat tone="amber" label="Pending review" value={pendingCount.toLocaleString()} sub="needs a decision" />
          <Stat tone="sky"   label="Hours pending"  value={`${hoursPending.toLocaleString()}h`} sub="awaiting review" />
          <Stat tone={overBalance > 0 ? 'rose' : 'slate'} label="Over balance" value={overBalance.toLocaleString()} sub="exceeds available" />
        </StatStrip>

        {/* Status tabs + search */}
        <Toolbar>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {(['pending', 'approved', 'denied', 'all'] as Filter[]).map(f => {
              const count = f === 'all' ? requests.length : requests.filter(r => r.status === f).length
              const active = filter === f
              return (
                <button key={f} onClick={() => setFilter(f)} className={cn(tabCx(active), 'capitalize')}>
                  {f}
                  <span className={tabCountCx(active)}>{count}</span>
                </button>
              )
            })}
          </div>
          <div className="flex-1" />
          {query && (
            <span className="text-[12px] text-ink-muted tabular-nums whitespace-nowrap">
              {filtered.length} match{filtered.length === 1 ? '' : 'es'}
            </span>
          )}
          <ListSearch value={query} onChange={setQuery} placeholder="Search employee…" width={220} />
        </Toolbar>

        {/* Action error */}
        {actionError && (
          <div className="px-5 py-3 border-b border-hairline">
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
              <XCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          </div>
        )}

        {/* Table */}
        <CardTable
          cols={COLS}
          minWidth={960}
          head={<>
            <SelectBox checked={allSelected} onChange={() => sel.setAll(filtered.map(r => r.id), !allSelected)} />
            <span>Employee</span>
            <span>Type</span>
            <span>Balance</span>
            <span>Status</span>
            <span />
          </>}
        >
          {filtered.length === 0 ? (
            <EmptyRow>
              <Calendar size={26} className="text-ink-faint mx-auto mb-2.5" />
              No {filter !== 'all' ? filter : ''} requests{query ? ' match your search' : ''}.
            </EmptyRow>
          ) : (
            pageRows.map(req => {
              const st = STATUS_TONE[req.status] ?? STATUS_TONE.pending
              const employee = req.employees
              const name = employee?.name || employee?.email || 'Unknown'
              const balance = req.type === 'pto' ? employee?.pto_balance : employee?.sick_balance
              const insufficient = (balance ?? Infinity) < req.hours_requested
              const overWarn = insufficient && req.status === 'pending'
              const range = req.start_date === req.end_date
                ? formatDate(req.start_date)
                : `${formatDate(req.start_date)}–${formatDate(req.end_date)}`

              return (
                <Row key={req.id} cols={COLS} selected={sel.has(req.id)}>
                  {/* Select */}
                  <SelectBox checked={sel.has(req.id)} onChange={() => sel.toggle(req.id)} />
                  {/* Identity — employee over date range · hours (notes on hover) */}
                  <div className="flex items-center gap-2.5 min-w-0" title={req.notes || undefined}>
                    <ToneAvatar name={name} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">{name}</p>
                      <p className="text-[11.5px] text-ink-muted truncate tabular-nums">{range} · {req.hours_requested}h</p>
                    </div>
                  </div>
                  {/* Type */}
                  <div className="flex items-center gap-1.5 text-[12.5px] text-ink-secondary">
                    {req.type === 'pto'
                      ? <Calendar size={13} className="text-sky-500" />
                      : <Clock size={13} className="text-amber-500" />}
                    {req.type === 'pto' ? 'PTO' : 'Sick'}
                  </div>
                  {/* Balance */}
                  <div className={cn('text-[12.5px] tabular-nums', overWarn ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-ink-muted')}>
                    {balance ?? '—'} hrs
                    {overWarn && <span className="text-[10px] ml-1">(over)</span>}
                  </div>
                  {/* Status */}
                  <div><StatusPill tone={st.tone}>{st.label}</StatusPill></div>
                  {/* Actions — approve/deny (pending only) + delete */}
                  <div className="flex items-center justify-end gap-1.5">
                    {req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => review(req.id, 'approved')}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 bg-brand hover:bg-brand-hover text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                          <CheckCircle2 size={13} />
                          {actionLoading === req.id + 'approved' ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => review(req.id, 'denied')}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 bg-surface hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 border border-red-200 dark:border-red-900/50 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                          <XCircle size={13} />
                          {actionLoading === req.id + 'denied' ? 'Denying…' : 'Deny'}
                        </button>
                      </>
                    )}
                    <DeleteRecordButton endpoint={`/api/requests/${req.id}`} entityLabel="request" compact />
                  </div>
                </Row>
              )
            })
          )}
        </CardTable>

        {/* Pagination */}
        <Pagination
          page={paged.page}
          perPage={paged.perPage}
          total={filtered.length}
          totalPages={paged.totalPages}
          onPage={paged.setPage}
          onPerPage={paged.setPerPage}
          unit="requests"
        />
      </ListCard>

      <BulkBar count={sel.count} onClear={sel.clear}>
        <BulkDeleteButton entity="time_off" ids={sel.ids} onDone={sel.clear} />
      </BulkBar>
    </ListCardPage>
  )
}
