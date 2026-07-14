'use client'

import { useState } from 'react'
import type { USRotorsOrder } from '@/lib/supabase'
import { Package, Search, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  HEADER_BOX, BODY_BOX, rowCx, Th, TableScroll, timeAgo,
  ListPageHeader, IdentityCell, tabCx, tabCountCx,
} from '@/components/admin/list'

const STATUSES = ['all', 'pending', 'processing', 'shipped', 'complete'] as const
type StatusFilter = (typeof STATUSES)[number]

const STATUS_LABELS: Record<USRotorsOrder['status'], string> = {
  pending:    'Pending',
  processing: 'Processing',
  shipped:    'Shipped',
  complete:   'Complete',
}

const STATUS_COLORS: Record<USRotorsOrder['status'], string> = {
  pending:    'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
  processing: 'bg-sky-100   dark:bg-sky-950/40   text-sky-700   dark:text-sky-400',
  shipped:    'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400',
  complete:   'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
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
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">

      {/* Page header */}
      <ListPageHeader
        overline="US Rotors"
        title="Orders"
        count={`${orders.length} C-Series ${orders.length === 1 ? 'order' : 'orders'} from the employee portal`}
      >
        {/* Status tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {STATUSES.map(s => {
            const active = filter === s
            return (
              <button key={s} onClick={() => setFilter(s)} className={tabCx(active)}>
                {s === 'all' ? 'All' : STATUS_LABELS[s as USRotorsOrder['status']]}
                <span className={tabCountCx(active)}>{counts[s]}</span>
              </button>
            )
          })}
        </div>
      </ListPageHeader>

      <div className="p-4 sm:p-8">

        {/* Toolbar */}
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
            <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-8 h-9 text-[12.5px] w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Floating header — hidden on mobile, where the rows read as a plain feed */}
        <TableScroll minWidth={680}>
        <div className={`hidden sm:grid ${COLS} ${HEADER_BOX}`}>
          <Th>Company</Th>
          <Th>Config</Th>
          <Th>Voltage</Th>
          <Th>Age</Th>
          <Th>Status</Th>
        </div>

        {/* Body */}
        <div className={BODY_BOX}>
          {visible.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">
                {search
                  ? `No orders match "${search}"`
                  : 'No orders yet. Orders submitted from the employee portal will appear here.'}
              </p>
            </div>
          ) : (
            visible.map((o, i) => (
              <div key={o.id} className={rowCx(COLS, { i })}>
                {/* Identity — company over ref · model ×qty */}
                <IdentityCell
                  icon={<Package size={13} />}
                  title={o.company}
                  subtitle={`${o.order_ref} · ${o.model} ×${o.quantity}`}
                />
                {/* Config */}
                <div className="hidden sm:block text-zinc-500 dark:text-zinc-400 truncate">{o.config}</div>
                {/* Voltage */}
                <div className="hidden sm:block font-mono text-zinc-500 dark:text-zinc-400 truncate">{o.motor_voltage}</div>
                {/* Age */}
                <div className="hidden sm:block text-zinc-400 dark:text-zinc-500 tabular-nums">{timeAgo(o.created_at)}</div>
                {/* Status — inline change dropdown */}
                <div className="relative">
                  <div className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer select-none',
                    STATUS_COLORS[o.status],
                    updating === o.id ? 'opacity-50' : '',
                  )}>
                    <span className="flex-1">{STATUS_LABELS[o.status]}</span>
                    <select
                      value={o.status}
                      disabled={updating === o.id}
                      onChange={e => updateStatus(o.id, e.target.value as USRotorsOrder['status'])}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full"
                    >
                      {(['pending', 'processing', 'shipped', 'complete'] as const).map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <ChevronDown size={11} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        </TableScroll>
      </div>
    </div>
  )
}
