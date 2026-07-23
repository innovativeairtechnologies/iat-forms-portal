'use client'

import { useState } from 'react'
import type { USRotorsOrder } from '@/lib/supabase'
import { Package, Search, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo, tabCx, tabCountCx, type Tone } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, Toolbar, CardTable, Row, EmptyRow,
  Pagination, usePagedList, ToneAvatar, CARD_TONE,
} from '@/components/admin/list-card'

const STATUSES = ['all', 'pending', 'processing', 'shipped', 'complete'] as const
type StatusFilter = (typeof STATUSES)[number]

const STATUS_LABELS: Record<USRotorsOrder['status'], string> = {
  pending:    'Pending',
  processing: 'Processing',
  shipped:    'Shipped',
  complete:   'Complete',
}

// Status → soft-wash Tone (matches the prior color hues: amber/sky/violet/emerald).
const STATUS_TONE: Record<USRotorsOrder['status'], Tone> = {
  pending:    'amber',
  processing: 'sky',
  shipped:    'violet',
  complete:   'emerald',
}

// Mobile keeps identity + status; config/voltage/age return at sm+.
const COLS = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[1.8fr_120px_120px_72px_128px]'

interface Props {
  orders: USRotorsOrder[]
}

export default function USRotorsOrdersClient({ orders }: Props) {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [localOrders, setLocalOrders] = useState<USRotorsOrder[]>(orders)

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = s === 'all' ? orders.length : orders.filter(o => o.status === s).length
    return acc
  }, {} as Record<StatusFilter, number>)

  const visible = localOrders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      o.order_ref.toLowerCase().includes(q) ||
      o.company.toLowerCase().includes(q) ||
      o.contact_name.toLowerCase().includes(q) ||
      o.contact_email.toLowerCase().includes(q) ||
      o.model.toLowerCase().includes(q)
    )
  })

  // Client-side pagination over the filtered set (reset to page 1 on filter/search).
  const { page, setPage, perPage, setPerPage, totalPages, start, end } =
    usePagedList(visible.length, { initialPerPage: 10, resetKey: `${filter}|${search}` })
  const pageRows = visible.slice(start, end)

  const updateStatus = async (id: string, status: USRotorsOrder['status']) => {
    setUpdating(id)
    try {
      await fetch('/api/us-rotors/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      setLocalOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    } finally {
      setUpdating(null)
    }
  }

  return (
    <ListCardPage>
      <ListCard>

        <CardHead
          overline="US Rotors"
          title="Orders"
          count={`${orders.length} C-Series ${orders.length === 1 ? 'order' : 'orders'} from the employee portal`}
        />

        {/* Status tabs (filter) + search */}
        <Toolbar>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {STATUSES.map(s => {
              const active = filter === s
              return (
                <button key={s} type="button" onClick={() => setFilter(s)} className={tabCx(active)}>
                  {s === 'all' ? 'All' : STATUS_LABELS[s as USRotorsOrder['status']]}
                  <span className={tabCountCx(active)}>{counts[s]}</span>
                </button>
              )
            })}
          </div>
          <div className="flex-1" />
          <div className="relative" style={{ width: 224 }}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search orders…"
              aria-label="Search orders"
              className="w-full h-9 pl-9 pr-8 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink-secondary placeholder:text-ink-faint outline-none focus:border-brand transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-secondary transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </Toolbar>

        {/* Table — Company · Config · Voltage · Age · Status */}
        <CardTable
          cols={COLS}
          minWidth={680}
          head={
            <>
              <span>Company</span>
              <span className="hidden sm:block">Config</span>
              <span className="hidden sm:block">Voltage</span>
              <span className="hidden sm:block">Age</span>
              <span>Status</span>
            </>
          }
        >
          {visible.length === 0 ? (
            <EmptyRow>
              <div className="flex flex-col items-center">
                <Package size={28} className="text-ink-faint mb-3" />
                <p className="text-[13px] text-ink-muted">
                  {search
                    ? `No orders match "${search}"`
                    : 'No orders yet. Orders submitted from the employee portal will appear here.'}
                </p>
              </div>
            </EmptyRow>
          ) : (
            pageRows.map(o => (
              <Row key={o.id} cols={COLS}>
                {/* Identity — company over ref · model ×qty */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <ToneAvatar name={o.company} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">{o.company}</p>
                    <p className="text-[11.5px] text-ink-muted truncate">{`${o.order_ref} · ${o.model} ×${o.quantity}`}</p>
                  </div>
                </div>

                {/* Config */}
                <div className="hidden sm:block text-[12.5px] text-ink-secondary truncate">{o.config}</div>

                {/* Voltage */}
                <div className="hidden sm:block text-[12.5px] font-mono text-ink-secondary truncate">{o.motor_voltage}</div>

                {/* Age */}
                <div className="hidden sm:block text-[12.5px] text-ink-muted tabular-nums">{timeAgo(o.created_at)}</div>

                {/* Status — inline change dropdown (native select overlays the pill) */}
                <div className="relative min-w-0">
                  <div className={cn(
                    'inline-flex items-center gap-1 max-w-full px-2 py-[3px] rounded-md text-[10px] font-semibold uppercase tracking-wider select-none cursor-pointer',
                    CARD_TONE[STATUS_TONE[o.status]].bg,
                    CARD_TONE[STATUS_TONE[o.status]].fg,
                    updating === o.id && 'opacity-50',
                  )}>
                    <span className="truncate">{STATUS_LABELS[o.status]}</span>
                    <ChevronDown size={11} className="flex-shrink-0" />
                    <select
                      value={o.status}
                      disabled={updating === o.id}
                      onChange={e => updateStatus(o.id, e.target.value as USRotorsOrder['status'])}
                      aria-label="Change order status"
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    >
                      {(['pending', 'processing', 'shipped', 'complete'] as const).map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Row>
            ))
          )}
        </CardTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={visible.length}
          totalPages={totalPages}
          onPage={setPage}
          onPerPage={setPerPage}
          unit="orders"
        />

      </ListCard>
    </ListCardPage>
  )
}
