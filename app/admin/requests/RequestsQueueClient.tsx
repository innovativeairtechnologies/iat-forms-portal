'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react'
import type { TimeOffRequest, Employee } from '@/lib/supabase'
import DeleteRecordButton from '@/components/admin/DeleteRecordButton'
import { useBulkSelect, SelectBox, BulkBar, BulkDeleteButton } from '@/components/admin/bulk-select'
import {
  HEADER_BOX, BODY_BOX, rowCx, StatusPill, Avatar, Th, TableScroll,
  ListPageHeader, IdentityCell, tabCx, tabCountCx, type Tone,
} from '@/components/admin/list'

type RequestWithEmployee = TimeOffRequest & { employees: Employee }
type Filter = 'all' | 'pending' | 'approved' | 'denied'

const STATUS_TONE: Record<string, { label: string; tone: Tone }> = {
  pending:  { label: 'Pending',  tone: 'amber'   },
  approved: { label: 'Approved', tone: 'emerald' },
  denied:   { label: 'Denied',   tone: 'rose'    },
}

// Date-only strings ("2026-07-07") — pin to local midnight so they never shift a day.
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Mobile keeps identity / balance / status, with the Approve–Deny tray wrapping
// onto its own line (this queue has no detail page, so the actions must stay).
const COLS = 'grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[34px_2fr_92px_132px_104px_236px]'

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
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const pendingCount = requests.filter(r => r.status === 'pending').length

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const allSelected = filtered.length > 0 && filtered.every(r => sel.has(r.id))

  // Clear the selection when the tab changes so a bulk delete can never touch
  // requests outside the current view.
  useEffect(() => { sel.clear() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">

      {/* Page header */}
      <ListPageHeader
        overline="Time Off"
        title={title}
        count={pendingCount > 0 ? `${pendingCount} pending review` : 'All caught up'}
      >
        {/* Status tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {(['pending', 'approved', 'denied', 'all'] as Filter[]).map(f => {
            const count = f === 'all' ? requests.length : requests.filter(r => r.status === f).length
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)} className={`${tabCx(active)} capitalize`}>
                {f}
                <span className={tabCountCx(active)}>{count}</span>
              </button>
            )
          })}
        </div>
      </ListPageHeader>

      <div className="p-4 sm:p-8">

        {actionError && (
          <div className="mb-4 text-[13px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-xl px-4 py-3">{actionError}</div>
        )}

        {/* Floating header — hidden on mobile, where the rows read as a plain feed */}
        <TableScroll minWidth={900}>
        <div className={`hidden sm:grid ${COLS} ${HEADER_BOX}`}>
          <SelectBox checked={allSelected} onChange={() => sel.setAll(filtered.map(r => r.id), !allSelected)} />
          <Th>Employee</Th>
          <Th>Type</Th>
          <Th>Balance</Th>
          <Th>Status</Th>
          <Th />
        </div>

        {/* Body */}
        <div className={BODY_BOX}>
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Calendar size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">No {filter !== 'all' ? filter : ''} requests.</p>
            </div>
          ) : (
            filtered.map((req, i) => {
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
                <div key={req.id} className={rowCx(COLS, { i, selected: sel.has(req.id) })} title={req.notes || undefined}>
                  {/* Select */}
                  <SelectBox className="hidden sm:flex" checked={sel.has(req.id)} onChange={() => sel.toggle(req.id)} />
                  {/* Identity — employee over date range · hours */}
                  <IdentityCell
                    leading={<Avatar name={name} />}
                    title={name}
                    subtitle={`${range} · ${req.hours_requested}h`}
                  />
                  {/* Type */}
                  <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-300">
                    {req.type === 'pto'
                      ? <Calendar size={13} className="text-sky-500" />
                      : <Clock size={13} className="text-amber-500" />}
                    {req.type === 'pto' ? 'PTO' : 'Sick'}
                  </div>
                  {/* Balance */}
                  <div className={`text-[12px] tabular-nums ${overWarn ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {balance ?? '—'} hrs
                    {overWarn && <span className="text-[10px] ml-1">(over)</span>}
                  </div>
                  {/* Status */}
                  <div><StatusPill tone={st.tone}>{st.label}</StatusPill></div>
                  {/* Actions — full-width second line on mobile, trailing column at sm+ */}
                  <div className="col-span-full sm:col-auto flex items-center justify-end gap-1.5">
                    {req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => review(req.id, 'approved')}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 bg-[#089447] hover:bg-[#077a3c] text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 shadow-sm">
                          <CheckCircle2 size={13} />
                          {actionLoading === req.id + 'approved' ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => review(req.id, 'denied')}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 border border-red-200 dark:border-red-900/50 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                          <XCircle size={13} />
                          {actionLoading === req.id + 'denied' ? 'Denying…' : 'Deny'}
                        </button>
                      </>
                    )}
                    <DeleteRecordButton endpoint={`/api/requests/${req.id}`} entityLabel="request" compact />
                  </div>
                </div>
              )
            })
          )}
        </div>
        </TableScroll>
      </div>

      <BulkBar count={sel.count} onClear={sel.clear}>
        <BulkDeleteButton entity="time_off" ids={sel.ids} onDone={sel.clear} />
      </BulkBar>
    </div>
  )
}
