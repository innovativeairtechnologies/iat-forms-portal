'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Ticket, Search, X, ChevronUp, ChevronDown, ChevronsUpDown,
  MoreHorizontal, Clock, CheckCircle2, ExternalLink, ShieldCheck, ShieldAlert,
} from 'lucide-react'
import type { Ticket as TicketType } from '@/lib/supabase'
import { updateTicket } from './actions'
import {
  HEADER_BOX, BODY_BOX, rowCx, StatusPill, Avatar, timeAgo, Th, TICKET_STATUS, PRIORITY, TableScroll,
  ListPageHeader, IdentityCell, tabCx, tabCountCx,
} from '@/components/admin/list'
import { BulkDeleteButton } from '@/components/admin/bulk-select'

type TicketRow = TicketType & { owner?: { id: string; name: string } | null }
type Filter  = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed'
type SortKey = 'created_at' | 'customer_name' | 'priority' | 'status'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, med: 2, low: 3 }

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',         label: 'All'         },
  { value: 'open',        label: 'Open'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved'    },
  { value: 'closed',      label: 'Closed'      },
]

// Mobile keeps the audit-log trio (identity / status / age); assignee, priority,
// checkbox and kebab appear at sm+ so the row never scrolls sideways on a phone.
const COLS = 'grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[34px_2fr_1fr_120px_150px_76px_40px]'

function matchesSearch(ticket: TicketRow, q: string): boolean {
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

export default function TicketsQueueClient({ tickets, warrantyBySerial = {} }: { tickets: TicketRow[]; warrantyBySerial?: Record<string, 'in' | 'expiring' | 'out' | 'unknown'> }) {
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

  // Drop the selection when the visible set narrows (tab/search/sort) so a bulk
  // delete can never act on rows the admin can no longer see.
  useEffect(() => { setSelected(new Set()) }, [filter, search, sortKey, sortDir])

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
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(sorted.map(t => t.id)))

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

  const sortable = 'hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">

      {/* Page header */}
      <ListPageHeader
        overline="Support"
        title="Tickets"
        count={`${sorted.length} ${sorted.length === 1 ? 'ticket' : 'tickets'}`}
      >
        {/* Status tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {FILTERS.map(({ value, label }) => {
            const count = value === 'all' ? tickets.length : tickets.filter(t => t.status === value).length
            const active = filter === value
            return (
              <button key={value} onClick={() => setFilter(value)} className={tabCx(active)}>
                {label}
                <span className={tabCountCx(active)}>{count}</span>
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
        <TableScroll minWidth={920}>
        <div className={`hidden sm:grid ${COLS} ${HEADER_BOX}`}>
          <div className="flex items-center justify-center">
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer" />
          </div>
          <Th><button onClick={() => toggleSort('customer_name')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Customer <SortIcon col="customer_name" /></button></Th>
          <Th>Assignee</Th>
          <Th><button onClick={() => toggleSort('priority')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Priority <SortIcon col="priority" /></button></Th>
          <Th><button onClick={() => toggleSort('status')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Status <SortIcon col="status" /></button></Th>
          <Th><button onClick={() => toggleSort('created_at')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Created <SortIcon col="created_at" /></button></Th>
          <Th />
        </div>

        {/* Body */}
        <div className={BODY_BOX}>
          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <Ticket size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">
                {search ? `No tickets match "${search}"` : `No ${filter !== 'all' ? FILTERS.find(f => f.value === filter)?.label.toLowerCase() : ''} tickets.`}
              </p>
            </div>
          ) : (
            sorted.map((ticket, i) => {
              const st = TICKET_STATUS[ticket.status] ?? TICKET_STATUS.open
              const prio = PRIORITY[ticket.priority ?? 'med'] ?? PRIORITY.med
              const isSel = selected.has(ticket.id)
              return (
                <div key={ticket.id} onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                  className={`${rowCx(COLS, { i, selected: isSel })} cursor-pointer group`}>
                  {/* Checkbox */}
                  <div className="hidden sm:flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSel} onChange={() => toggle(ticket.id)}
                      className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer" />
                  </div>
                  {/* Identity — customer over ticket # · model */}
                  <IdentityCell
                    leading={<Avatar name={ticket.customer_name} />}
                    title={ticket.customer_name}
                    subtitle={`${ticket.ticket_number} · ${ticket.model_number}`}
                  />
                  {/* Assignee */}
                  <div className="hidden sm:flex items-center gap-2 min-w-0">
                    {ticket.owner ? (
                      <>
                        <Avatar name={ticket.owner.name} size={20} />
                        <span className="text-[12px] text-zinc-600 dark:text-zinc-300 truncate">{ticket.owner.name}</span>
                      </>
                    ) : (
                      <span className="text-[12px] text-zinc-300 dark:text-zinc-600">Unassigned</span>
                    )}
                  </div>
                  {/* Priority */}
                  <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-300">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${prio.dot}`} />
                    {prio.label}
                  </div>
                  {/* Status + warranty signal */}
                  <div className="flex items-center gap-1.5">
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    {(() => {
                      const w = warrantyBySerial[ticket.serial_number]
                      if (w === 'in')       return <StatusPill tone="emerald" icon={<ShieldCheck size={9} />}>In</StatusPill>
                      if (w === 'expiring') return <StatusPill tone="amber" icon={<ShieldAlert size={9} />}>Exp</StatusPill>
                      if (w === 'out')      return <StatusPill tone="rose" icon={<ShieldAlert size={9} />}>Out</StatusPill>
                      return null
                    })()}
                  </div>
                  {/* Created */}
                  <div className="text-zinc-400 dark:text-zinc-500 tabular-nums">{timeAgo(ticket.created_at)}</div>
                  {/* Kebab */}
                  <div className="hidden sm:flex justify-center relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setMenuFor(menuFor === ticket.id ? null : ticket.id)}
                      className="p-1.5 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <MoreHorizontal size={15} />
                    </button>
                    {menuFor === ticket.id && (
                      <div ref={menuRef} className="absolute right-8 top-1/2 -translate-y-1/2 z-30 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1">
                        <MenuItem icon={<ExternalLink size={13} />} label="Open" onClick={() => { setMenuFor(null); router.push(`/admin/tickets/${ticket.id}`) }} />
                        {ticket.status !== 'in_progress' && <MenuItem icon={<Clock size={13} />} label="Mark In Progress" onClick={() => setStatusFor([ticket.id], 'in_progress')} />}
                        {ticket.status !== 'resolved' && <MenuItem icon={<CheckCircle2 size={13} />} label="Resolve" onClick={() => setStatusFor([ticket.id], 'resolved')} />}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
        </TableScroll>
      </div>

      {/* Floating bulk-action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-700 shadow-2xl pl-4 pr-2 py-1.5">
          <span className="text-[12px] font-semibold text-white mr-2 whitespace-nowrap">Selected: {selected.size}</span>
          <button onClick={() => setStatusFor(Array.from(selected), 'in_progress')} disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap disabled:opacity-50">
            <Clock size={13} /> In Progress
          </button>
          <button onClick={() => setStatusFor(Array.from(selected), 'resolved')} disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap disabled:opacity-50">
            <CheckCircle2 size={13} /> Resolve
          </button>
          <BulkDeleteButton entity="tickets" ids={Array.from(selected)} onDone={() => setSelected(new Set())} />
          <button onClick={() => setSelected(new Set())} disabled={pending}
            className="ml-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50">
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors text-left">
      <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
      {label}
    </button>
  )
}
