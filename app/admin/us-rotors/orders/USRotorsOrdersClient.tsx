'use client'

import { useState } from 'react'
import type { USRotorsOrder } from '@/lib/supabase'
import { Package, Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

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
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100 dark:border-zinc-800">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'px-4 py-2.5 text-[13px] font-medium capitalize border-b-2 -mb-px transition-colors',
              filter === s
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
            )}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s as USRotorsOrder['status']]}
            {counts[s] > 0 && (
              <span className={cn(
                'ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                filter === s ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500',
              )}>
                {counts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search orders…"
          className="w-full text-[13px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-gray-300 dark:focus:border-zinc-700 transition-all"
        />
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
            <Package size={18} className="text-gray-400" />
          </div>
          <p className="text-[14px] font-semibold text-gray-500 dark:text-gray-400">No orders found</p>
          <p className="text-[12px] text-gray-300 dark:text-gray-600 mt-1">Orders submitted from the employee portal will appear here.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[90px_1.2fr_1fr_80px_80px_110px_72px_110px] gap-0 px-4 py-2.5 border-b border-gray-50 dark:border-zinc-800">
            {['Ref', 'Company / Contact', 'Model', 'Qty', 'Config', 'Voltage', 'Age', 'Status'].map(h => (
              <span key={h} className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{h}</span>
            ))}
          </div>

          <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60">
            {visible.map(o => (
              <li
                key={o.id}
                className="grid grid-cols-[90px_1.2fr_1fr_80px_80px_110px_72px_110px] gap-0 px-4 py-3 items-center hover:bg-gray-50/50 dark:hover:bg-zinc-800/20 transition-colors"
              >
                {/* Ref */}
                <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate">{o.order_ref}</span>

                {/* Company / Contact */}
                <div className="min-w-0 pr-3">
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{o.company}</p>
                  <p className="text-[11px] text-gray-400 truncate">{o.contact_name} · {o.contact_email}</p>
                </div>

                {/* Model */}
                <span className="text-[12px] text-gray-600 dark:text-gray-300 truncate pr-2">{o.model}</span>

                {/* Qty */}
                <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{o.quantity}</span>

                {/* Config */}
                <span className="text-[12px] text-gray-500 dark:text-gray-400">{o.config}</span>

                {/* Voltage */}
                <span className="text-[12px] font-mono text-gray-500 dark:text-gray-400">{o.motor_voltage}</span>

                {/* Age */}
                <span className="text-[12px] text-gray-400">{timeAgo(o.created_at)}</span>

                {/* Status */}
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
