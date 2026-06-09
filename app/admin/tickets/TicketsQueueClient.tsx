'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket, ChevronRight, Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Ticket as TicketType } from '@/lib/supabase'

type Filter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed'

const STATUS_STYLES: Record<string, { cls: string; label: string }> = {
  open:        { cls: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',       label: 'Open'        },
  in_progress: { cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800', label: 'In Progress' },
  resolved:    { cls: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800', label: 'Resolved'    },
  closed:      { cls: 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',           label: 'Closed'      },
}

const PRIORITY_STYLES: Record<string, { cls: string; label: string }> = {
  low:  { cls: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',   label: 'Low'  },
  med:  { cls: 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', label: 'Med'  },
  high: { cls: 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800',               label: 'High' },
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open',        label: 'Open'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved'    },
  { value: 'closed',      label: 'Closed'      },
  { value: 'all',         label: 'All'         },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function matchesSearch(ticket: TicketType, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    ticket.ticket_number.toLowerCase().includes(q) ||
    ticket.customer_name.toLowerCase().includes(q) ||
    (ticket.customer_company ?? '').toLowerCase().includes(q) ||
    (ticket.customer_email ?? '').toLowerCase().includes(q) ||
    ticket.serial_number.toLowerCase().includes(q) ||
    ticket.model_number.toLowerCase().includes(q) ||
    ticket.problem_description.toLowerCase().includes(q)
  )
}

export default function TicketsQueueClient({ tickets }: { tickets: TicketType[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('open')
  const [search, setSearch] = useState('')

  const openCount = tickets.filter(t => t.status === 'open').length
  const byStatus = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)
  const filtered = byStatus.filter(t => matchesSearch(t, search))

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Support</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Tickets</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">
          {openCount > 0 ? `${openCount} open ticket${openCount !== 1 ? 's' : ''}` : 'No open tickets'}
        </p>
      </div>

      <div className="p-8">

        {/* Search bar */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tickets by name, number, serial, or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-[13px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-gray-700 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 outline-none focus:border-gray-300 dark:focus:border-gray-600 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-gray-100 dark:border-gray-800">
          {FILTERS.map(({ value, label }) => {
            const count = value === 'all' ? tickets.length : tickets.filter(t => t.status === value).length
            return (
              <button key={value} onClick={() => setFilter(value)}
                className={`px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
                  filter === value
                    ? 'border-[#089447] text-[#089447]'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-200 dark:hover:border-gray-600'
                }`}>
                {label}{' '}
                <span className={`text-[11px] tabular-nums ${filter === value ? 'text-gray-500' : 'text-gray-300 dark:text-gray-600'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center">
            <Ticket size={32} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-[14px] text-gray-400">
              {search ? `No tickets match "${search}"` : `No ${filter !== 'all' ? FILTERS.find(f => f.value === filter)?.label.toLowerCase() : ''} tickets.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map(ticket => {
                const s = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.open
                const p = PRIORITY_STYLES[ticket.priority ?? 'med'] ?? PRIORITY_STYLES.med
                return (
                  <motion.div key={ticket.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 cursor-pointer hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm transition-all group"
                    onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">

                        {/* Top row: ticket # + status + priority + age */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[12px] font-bold text-gray-400 dark:text-gray-500 font-mono tracking-wide">
                            {ticket.ticket_number}
                          </span>
                          <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${s.cls}`}>
                            {s.label}
                          </span>
                          <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${p.cls}`}>
                            {p.label}
                          </span>
                          <span className="text-[11px] text-gray-300 dark:text-gray-600 ml-auto">{timeAgo(ticket.created_at)}</span>
                        </div>

                        {/* Customer */}
                        <div className="flex items-baseline gap-2 mb-1.5">
                          <p className="text-[14px] font-semibold text-gray-800 dark:text-white">{ticket.customer_name}</p>
                          {ticket.customer_company && (
                            <p className="text-[12px] text-gray-400">{ticket.customer_company}</p>
                          )}
                        </div>

                        {/* Equipment */}
                        <div className="flex items-center gap-4 mb-2">
                          <span className="text-[12px] text-gray-400">
                            S/N: <span className="font-medium text-gray-600 dark:text-gray-300">{ticket.serial_number}</span>
                          </span>
                          <span className="text-[12px] text-gray-400">
                            Model: <span className="font-medium text-gray-600 dark:text-gray-300">{ticket.model_number}</span>
                          </span>
                          <span className="text-[12px] text-gray-400">{ticket.voltage}</span>
                        </div>

                        {/* Problem preview */}
                        <p className="text-[13px] text-gray-400 dark:text-gray-500 line-clamp-2 mb-1.5">{ticket.problem_description}</p>

                        {/* Owner */}
                        {ticket.owner && (
                          <p className="text-[11px] text-gray-300 dark:text-gray-600">
                            Owner: <span className="font-medium text-gray-500 dark:text-gray-400">{(ticket.owner as { name: string }).name}</span>
                          </p>
                        )}

                      </div>
                      <ChevronRight size={16} className="text-gray-200 dark:text-gray-700 group-hover:text-gray-400 dark:group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

      </div>
    </div>
  )
}
