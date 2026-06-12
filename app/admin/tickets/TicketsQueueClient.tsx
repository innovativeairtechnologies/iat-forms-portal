'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Ticket, Search, X, ChevronUp, ChevronDown, ChevronsUpDown,
  MoreHorizontal, Clock, CheckCircle2, ExternalLink,
} from 'lucide-react'
import type { Ticket as TicketType } from '@/lib/supabase'
import { updateTicket } from './actions'

type Filter  = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed'
type SortKey = 'created_at' | 'customer_name' | 'priority' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Open',        cls: 'border-sky-300/60 bg-sky-50 text-sky-600 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400' },
  in_progress: { label: 'In Progress', cls: 'border-amber-300/60 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400' },
  resolved:    { label: 'Resolved',    cls: 'border-emerald-300/60 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400' },
  closed:      { label: 'Closed',      cls: 'border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400' },
}

const PRIORITY_DOT: Record<string, { label: string; dot: string }> = {
  low:      { label: 'Low',      dot: 'bg-sky-400' },
  med:      { label: 'Med',      dot: 'bg-amber-400' },
  high:     { label: 'High',     dot: 'bg-rose-500' },
  critical: { label: 'Critical', dot: 'bg-rose-700' },
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, med: 2, low: 3 }

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',         label: 'All'         },
  { value: 'open',        label: 'Open'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved'    },
  { value: 'closed',      label: 'Closed'      },
]

const COL = 'grid-cols-[44px_120px_1fr_190px_96px_120px_80px_44px]'

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuFor) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuFor])

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

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allSelected = sorted.length > 0 && sorted.every(t => selected.has(t.id))
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(sorted.map(t => t.id)))

  const setStatusFor = (ids: string[], status: TicketType['status']) => {
    startTransition(async () => {
      await Promise.all(ids.map(id => {
        const t = tickets.find(x => x.id === id)
        if (!t) return Promise.resolve({ error: null })
        return updateTicket(id, { status, priority: t.priority ?? 'med', owner_id: t.owner_id ?? null })
      }))
      setSelected(new Set())
      setMenuFor(null)
      router.refresh()
    })
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ChevronsUpDown size={10} className="text-zinc-300 dark:text-zinc-600" />
    return sortDir === 'asc'
      ? <ChevronUp   size={10} className="text-emerald-500" />
      : <ChevronDown size={10} className="text-emerald-500" />
  }

  const headerBtn = 'px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors text-left'

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Support</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Tickets</h1>
      </div>

      <div className="p-8">

        {/* Status tabs — underline style */}
        <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800 mb-4">
          {FILTERS.map(({ value, label }) => {
            const count = value === 'all' ? tickets.length : tickets.filter(t => t.status === value).length
            const active = filter === value
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`relative pb-2.5 text-[13px] whitespace-nowrap transition-colors ${
                  active
                    ? 'font-semibold text-zinc-900 dark:text-white'
                    : 'font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                {label}
                <span className={`ml-1.5 text-[11px] tabular-nums ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600'}`}>
                  {count}
                </span>
                {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-emerald-500" />}
              </button>
            )
          })}
        </div>

        {/* Toolbar row */}
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-8 h-9 text-[12.5px] w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
              >
                <X size={11} />
              </button>
            )}
          </div>

          <span className="ml-auto text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">
            {sorted.length} {sorted.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-900/40 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none overflow-hidden">

          {/* Column headers */}
          <div className={`grid ${COL} items-center border-b border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60`}>
            <div className="flex items-center justify-center py-2.5">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer"
              />
            </div>
            <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
              ID
            </div>
            <button onClick={() => toggleSort('customer_name')} className={headerBtn}>
              Customer <SortIcon col="customer_name" />
            </button>
            <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
              Equipment
            </div>
            <button onClick={() => toggleSort('priority')} className={headerBtn}>
              Priority <SortIcon col="priority" />
            </button>
            <button onClick={() => toggleSort('status')} className={headerBtn}>
              Status <SortIcon col="status" />
            </button>
            <button onClick={() => toggleSort('created_at')} className={headerBtn}>
              Created <SortIcon col="created_at" />
            </button>
            <div />
          </div>

          {/* Rows */}
          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <Ticket size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">
                {search
                  ? `No tickets match "${search}"`
                  : `No ${filter !== 'all' ? FILTERS.find(f => f.value === filter)?.label.toLowerCase() : ''} tickets.`}
              </p>
            </div>
          ) : (
            sorted.map((ticket, i) => {
              const pill = STATUS_PILL[ticket.status] ?? STATUS_PILL.open
              const prio = PRIORITY_DOT[ticket.priority ?? 'med'] ?? PRIORITY_DOT.med
              const isSel = selected.has(ticket.id)
              return (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                  className={`grid ${COL} items-center cursor-pointer transition-colors group relative ${
                    i !== 0 ? 'border-t border-zinc-100 dark:border-zinc-800/60' : ''
                  } ${isSel ? 'bg-emerald-50/60 dark:bg-emerald-500/[0.06]' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}
                >
                  {/* Checkbox */}
                  <div className="flex items-center justify-center py-3.5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(ticket.id)}
                      className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* ID */}
                  <div className="px-3 py-3.5">
                    <span className="text-[11px] font-mono font-semibold text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                      {ticket.ticket_number}
                    </span>
                  </div>

                  {/* Customer */}
                  <div className="px-3 py-3.5 min-w-0 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-zinc-500 dark:text-zinc-300">
                      {initials(ticket.customer_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {ticket.customer_name}
                      </p>
                      {ticket.customer_company && (
                        <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500 truncate">{ticket.customer_company}</p>
                      )}
                    </div>
                  </div>

                  {/* Equipment */}
                  <div className="px-3 py-3.5 min-w-0">
                    <p className="text-[12.5px] text-zinc-600 dark:text-zinc-300 truncate">{ticket.model_number}</p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">S/N {ticket.serial_number}</p>
                  </div>

                  {/* Priority */}
                  <div className="px-3 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-300">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${prio.dot}`} />
                      {prio.label}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="px-3 py-3.5">
                    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-[3px] rounded-md border ${pill.cls}`}>
                      {pill.label}
                    </span>
                  </div>

                  {/* Created */}
                  <div className="px-3 py-3.5">
                    <span className="text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">{timeAgo(ticket.created_at)}</span>
                  </div>

                  {/* Kebab */}
                  <div className="flex justify-center relative" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuFor(menuFor === ticket.id ? null : ticket.id)}
                      className="p-1.5 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    {menuFor === ticket.id && (
                      <div ref={menuRef} className="absolute right-8 top-1/2 -translate-y-1/2 z-30 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1">
                        <MenuItem icon={<ExternalLink size={13} />} label="Open" onClick={() => { setMenuFor(null); router.push(`/admin/tickets/${ticket.id}`) }} />
                        {ticket.status !== 'in_progress' && (
                          <MenuItem icon={<Clock size={13} />} label="Mark In Progress" onClick={() => setStatusFor([ticket.id], 'in_progress')} />
                        )}
                        {ticket.status !== 'resolved' && (
                          <MenuItem icon={<CheckCircle2 size={13} />} label="Resolve" onClick={() => setStatusFor([ticket.id], 'resolved')} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

      </div>

      {/* Floating bulk-action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-700 shadow-2xl pl-4 pr-2 py-1.5">
          <span className="text-[12px] font-semibold text-white mr-2 whitespace-nowrap">
            Selected: {selected.size}
          </span>
          <button
            onClick={() => setStatusFor(Array.from(selected), 'in_progress')}
            disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <Clock size={13} /> In Progress
          </button>
          <button
            onClick={() => setStatusFor(Array.from(selected), 'resolved')}
            disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <CheckCircle2 size={13} /> Resolve
          </button>
          <button
            onClick={() => setSelected(new Set())}
            disabled={pending}
            className="ml-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors text-left"
    >
      <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
      {label}
    </button>
  )
}
