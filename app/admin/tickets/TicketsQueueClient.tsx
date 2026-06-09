'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket, Search, X, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Ticket as TicketType } from '@/lib/supabase'

type Filter  = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed'
type SortKey = 'created_at' | 'customer_name' | 'priority' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Open',        cls: 'bg-blue-50   text-blue-600  dark:bg-blue-950/40  dark:text-blue-400'  },
  in_progress: { label: 'In Progress', cls: 'bg-amber-50  text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
  resolved:    { label: 'Resolved',    cls: 'bg-green-50  text-green-600 dark:bg-green-950/40 dark:text-green-400' },
  closed:      { label: 'Closed',      cls: 'bg-gray-100  text-gray-500  dark:bg-zinc-800     dark:text-gray-400'  },
}

const PRIORITY_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  low:      { label: 'Low',      dot: 'bg-green-400',  cls: 'bg-green-50  text-green-600  dark:bg-green-950/40  dark:text-green-400'  },
  med:      { label: 'Med',      dot: 'bg-yellow-400', cls: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400' },
  high:     { label: 'High',     dot: 'bg-red-500',    cls: 'bg-red-50    text-red-500    dark:bg-red-950/40    dark:text-red-400'    },
  critical: { label: 'Critical', dot: 'bg-red-700',    cls: 'bg-red-100   text-red-700    dark:bg-red-950/60    dark:text-red-300'    },
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, med: 2, low: 3 }

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open',        label: 'Open'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved'    },
  { value: 'closed',      label: 'Closed'      },
  { value: 'all',         label: 'All'         },
]

const COL = 'grid-cols-[112px_1fr_180px_88px_108px_72px_28px]'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function matchesSearch(ticket: TicketType, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  return (
    ticket.ticket_number.toLowerCase().includes(lower) ||
    ticket.customer_name.toLowerCase().includes(lower) ||
    (ticket.customer_company ?? '').toLowerCase().includes(lower) ||
    (ticket.customer_email ?? '').toLowerCase().includes(lower) ||
    ticket.serial_number.toLowerCase().includes(lower) ||
    ticket.model_number.toLowerCase().includes(lower) ||
    ticket.problem_description.toLowerCase().includes(lower)
  )
}

export default function TicketsQueueClient({ tickets }: { tickets: TicketType[] }) {
  const router = useRouter()
  const [filter, setFilter]   = useState<Filter>('open')
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const byStatus = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)
  const bySearch = byStatus.filter(t => matchesSearch(t, search))
  const sorted = [...bySearch].sort((a, b) => {
    let cmp = 0
    if      (sortKey === 'created_at')    cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    else if (sortKey === 'customer_name') cmp = a.customer_name.localeCompare(b.customer_name)
    else if (sortKey === 'priority')      cmp = (PRIORITY_ORDER[a.priority ?? 'med'] ?? 2) - (PRIORITY_ORDER[b.priority ?? 'med'] ?? 2)
    else if (sortKey === 'status')        cmp = a.status.localeCompare(b.status)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ChevronsUpDown size={10} className="text-gray-300 dark:text-gray-600" />
    return sortDir === 'asc'
      ? <ChevronUp   size={10} className="text-[#089447]" />
      : <ChevronDown size={10} className="text-[#089447]" />
  }

  return (
    <div className="flex-1 overflow-auto">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Support</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Tickets</h1>
      </div>

      <div className="p-8">

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">

          {/* Segmented filter */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-zinc-800 rounded-xl p-1">
            {FILTERS.map(({ value, label }) => {
              const count = value === 'all' ? tickets.length : tickets.filter(t => t.status === value).length
              return (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg whitespace-nowrap transition-all ${
                    filter === value
                      ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {label}
                  <span className={`ml-1.5 text-[10px] tabular-nums ${filter === value ? 'text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tickets…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-8 py-2 text-[12px] w-52 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-700 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 outline-none focus:border-gray-300 dark:focus:border-zinc-600 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                <X size={11} />
              </button>
            )}
          </div>

          <span className="ml-auto text-[12px] text-gray-400 tabular-nums">
            {sorted.length} {sorted.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">

          {/* Column headers */}
          <div className={`grid ${COL} border-b border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/40`}>
            <div className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              ID
            </div>
            <button
              onClick={() => toggleSort('customer_name')}
              className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-left"
            >
              Customer <SortIcon col="customer_name" />
            </button>
            <div className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Equipment
            </div>
            <button
              onClick={() => toggleSort('priority')}
              className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Priority <SortIcon col="priority" />
            </button>
            <button
              onClick={() => toggleSort('status')}
              className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Status <SortIcon col="status" />
            </button>
            <button
              onClick={() => toggleSort('created_at')}
              className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Age <SortIcon col="created_at" />
            </button>
            <div />
          </div>

          {/* Rows */}
          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <Ticket size={28} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-[13px] text-gray-400">
                {search
                  ? `No tickets match "${search}"`
                  : `No ${filter !== 'all' ? FILTERS.find(f => f.value === filter)?.label.toLowerCase() : ''} tickets.`}
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {sorted.map((ticket, i) => {
                const s = STATUS_CONFIG[ticket.status]   ?? STATUS_CONFIG.open
                const p = PRIORITY_CONFIG[ticket.priority ?? 'med'] ?? PRIORITY_CONFIG.med
                return (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                    className={`grid ${COL} items-center cursor-pointer hover:bg-gray-50/80 dark:hover:bg-zinc-800/40 transition-colors group ${
                      i !== 0 ? 'border-t border-gray-50 dark:border-zinc-800/60' : ''
                    } ${i % 2 === 1 ? 'bg-gray-50/40 dark:bg-zinc-800/10' : ''}`}
                  >
                    {/* ID */}
                    <div className="px-4 py-3">
                      <span className="text-[11px] font-mono font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {ticket.ticket_number}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="px-3 py-3 min-w-0 flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-gray-500 dark:text-gray-400">
                        {initials(ticket.customer_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-gray-800 dark:text-gray-100 truncate group-hover:text-[#089447] transition-colors">
                          {ticket.customer_name}
                        </p>
                        {ticket.customer_company && (
                          <p className="text-[11px] text-gray-400 truncate">{ticket.customer_company}</p>
                        )}
                      </div>
                    </div>

                    {/* Equipment */}
                    <div className="px-3 py-3 min-w-0">
                      <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 truncate">{ticket.model_number}</p>
                      <p className="text-[11px] text-gray-400 truncate">S/N {ticket.serial_number}</p>
                    </div>

                    {/* Priority */}
                    <div className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.dot}`} />
                        {p.label}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="px-3 py-3">
                      <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
                        {s.label}
                      </span>
                    </div>

                    {/* Age */}
                    <div className="px-3 py-3">
                      <span className="text-[12px] text-gray-400 tabular-nums">{timeAgo(ticket.created_at)}</span>
                    </div>

                    {/* Chevron */}
                    <div className="pr-3 flex justify-end">
                      <ChevronRight size={13} className="text-gray-200 dark:text-gray-700 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors" />
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>

      </div>
    </div>
  )
}
