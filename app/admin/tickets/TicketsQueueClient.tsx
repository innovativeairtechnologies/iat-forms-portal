'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Ticket, Search, X, MoreHorizontal, Clock, CheckCircle2, ExternalLink, ShieldCheck, ShieldAlert,
} from 'lucide-react'
import type { Ticket as TicketType } from '@/lib/supabase'
import { updateTicket } from './actions'
import {
  StatusPill, Avatar, timeAgo, TICKET_STATUS, PRIORITY, tabCx, tabCountCx,
} from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, Toolbar, CardTable, Row, SortHeader,
  Pagination, usePagedList, ToneAvatar,
} from '@/components/admin/list-card'
import { BulkDeleteButton } from '@/components/admin/bulk-select'

type TicketRow = TicketType & { owner?: { id: string; name: string } | null }
type Status  = 'open' | 'in_progress' | 'resolved' | 'closed'
/** Two kinds of tab share one ribbon: by STATUS, and by WHO OWNS IT. */
type Filter  = 'all' | 'mine' | 'unassigned' | Status
type SortKey = 'created_at' | 'customer_name' | 'priority' | 'status'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, med: 2, low: 3 }

/**
 * `mine` and `unassigned` are ownership filters, not statuses, so they cut
 * across every status rather than sitting inside one — "My Tickets" includes the
 * closed ones. That is deliberate: a filter named after a person should mean
 * every ticket that is theirs, and quietly hiding some behind a status rule is
 * the kind of thing nobody discovers until a ticket is missing. Sort by status
 * to push the closed ones down.
 *
 * `mine` is dropped from the ribbon when the signed-in account has no matching
 * employees row (see myEmployeeId in page.tsx) — a tab that can only ever say
 * zero is worse than no tab.
 */
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',         label: 'All'         },
  { value: 'mine',        label: 'My Tickets'  },
  { value: 'unassigned',  label: 'Unassigned'  },
  { value: 'open',        label: 'Open'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved'    },
  { value: 'closed',      label: 'Closed'      },
]

/** The generic "No <label> tickets." reads wrong for the ownership tabs —
 *  "No my tickets." — so those two get their own sentence. */
function emptyLabel(filter: Filter): string {
  if (filter === 'mine') return 'Nothing is assigned to you.'
  if (filter === 'unassigned') return 'Every ticket has an owner.'
  if (filter === 'all') return 'No tickets.'
  return `No ${FILTERS.find(f => f.value === filter)?.label.toLowerCase()} tickets.`
}

/** One predicate for the tab counts and the visible rows, so a badge can never
 *  disagree with the list under it. */
function matchesFilter(t: TicketRow, filter: Filter, meId: string | null): boolean {
  if (filter === 'all') return true
  if (filter === 'mine') return !!meId && t.owner_id === meId
  if (filter === 'unassigned') return !t.owner_id
  return t.status === filter
}

// Mobile keeps the audit-log trio (identity / status / age); assignee, priority,
// checkbox and kebab appear at sm+ so the row never scrolls sideways on a phone.
// Header cells mirror this same visibility so columns line up at every breakpoint.
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

export default function TicketsQueueClient({ tickets, warrantyBySerial = {}, meId = null }: { tickets: TicketRow[]; warrantyBySerial?: Record<string, 'in' | 'expiring' | 'out' | 'unknown'>; meId?: string | null }) {
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

  const byFilter = tickets.filter(t => matchesFilter(t, filter, meId))
  const bySearch = byFilter.filter(t => matchesSearch(t, search))
  const sorted = [...bySearch].sort((a, b) => {
    let cmp = 0
    if      (sortKey === 'created_at')    cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    else if (sortKey === 'customer_name') cmp = a.customer_name.localeCompare(b.customer_name)
    else if (sortKey === 'priority')      cmp = (PRIORITY_ORDER[a.priority ?? 'med'] ?? 2) - (PRIORITY_ORDER[b.priority ?? 'med'] ?? 2)
    else if (sortKey === 'status')        cmp = a.status.localeCompare(b.status)
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Client-side pagination over the filtered + sorted view (default 10 per page).
  const { page, setPage, perPage, setPerPage, totalPages, start, end } =
    usePagedList(sorted.length, { initialPerPage: 10, resetKey: `${filter}|${search}|${sortKey}|${sortDir}` })
  const pageRows = sorted.slice(start, end)

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Select-all acts on the whole filtered set (not just the current page), matching
  // the pre-pagination behavior where every filtered row was on screen at once.
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

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Support"
          title="Tickets"
          count={`${sorted.length} ${sorted.length === 1 ? 'ticket' : 'tickets'}`}
        />

        {/* Filter tabs. Ownership (My Tickets / Unassigned) and status share one
            ribbon; counts come from the SAME predicate as the rows, so a badge
            cannot disagree with the list under it. A thin divider separates the
            two kinds so the ribbon does not read as one flat list of statuses. */}
        <div className="flex items-center gap-1 px-3 border-b border-hairline overflow-x-auto scrollbar-hide">
          {FILTERS
            .filter(({ value }) => value !== 'mine' || meId)
            .map(({ value, label }) => {
              const count = tickets.filter(t => matchesFilter(t, value, meId)).length
              const active = filter === value
              const endsOwnershipGroup = value === 'unassigned'
              return (
                <div key={value} className="flex items-center">
                  <button onClick={() => setFilter(value)} className={tabCx(active)}>
                    {label}
                    <span className={tabCountCx(active)}>{count}</span>
                  </button>
                  {endsOwnershipGroup && <span className="mx-1.5 h-4 w-px flex-shrink-0 bg-hairline" aria-hidden="true" />}
                </div>
              )
            })}
        </div>

        {/* Search */}
        <Toolbar>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search tickets"
              className="w-[240px] h-9 pl-9 pr-8 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink-secondary placeholder:text-ink-faint outline-none focus:border-brand transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-secondary transition-colors">
                <X size={12} />
              </button>
            )}
          </div>
        </Toolbar>

        {/* Table — CardTable bakes in the overflow-x-auto/overflow-y-hidden fix */}
        <CardTable
          cols={COLS}
          minWidth={920}
          head={
            <>
              <div className="hidden sm:flex items-center justify-center">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all tickets"
                  className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer" />
              </div>
              <SortHeader label="Customer" active={sortKey === 'customer_name'} dir={sortDir} onClick={() => toggleSort('customer_name')} />
              <span className="hidden sm:block">Assignee</span>
              <div className="hidden sm:block"><SortHeader label="Priority" active={sortKey === 'priority'} dir={sortDir} onClick={() => toggleSort('priority')} /></div>
              <SortHeader label="Status" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
              <SortHeader label="Created" active={sortKey === 'created_at'} dir={sortDir} onClick={() => toggleSort('created_at')} />
              <span className="hidden sm:block" />
            </>
          }
        >
          {sorted.length === 0 ? (
            <div className="px-5 py-16 text-center border-b border-hairline-soft">
              <Ticket size={28} className="text-ink-faint mx-auto mb-3" />
              <p className="text-[13px] text-ink-muted">
                {search ? `No tickets match "${search}"` : emptyLabel(filter)}
              </p>
            </div>
          ) : (
            pageRows.map((ticket) => {
              const st = TICKET_STATUS[ticket.status] ?? TICKET_STATUS.open
              const prio = PRIORITY[ticket.priority ?? 'med'] ?? PRIORITY.med
              const isSel = selected.has(ticket.id)
              const w = warrantyBySerial[ticket.serial_number]
              return (
                <Row key={ticket.id} cols={COLS} href={`/admin/tickets/${ticket.id}`} selected={isSel}>
                  {/* Checkbox — guard blocks the row link so selecting never navigates */}
                  <div
                    className="hidden sm:flex items-center justify-center"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(ticket.id) }}
                  >
                    <input type="checkbox" checked={isSel} readOnly aria-label={`Select ticket ${ticket.ticket_number}`}
                      className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer" />
                  </div>
                  {/* Identity — customer over ticket # · model */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ToneAvatar name={ticket.customer_name} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{ticket.customer_name}</p>
                      {/* Serial first — it identifies the actual unit, and it is what
                          the desk searches on. Model stays as the trailing detail. */}
                      <p
                        className="text-[11.5px] text-ink-muted truncate"
                        title={`${ticket.ticket_number} · S/N ${ticket.serial_number} · ${ticket.model_number}`}
                      >
                        {ticket.ticket_number} · {ticket.serial_number}
                        {ticket.model_number ? ` · ${ticket.model_number}` : ''}
                      </p>
                    </div>
                  </div>
                  {/* Assignee */}
                  <div className="hidden sm:flex items-center gap-2 min-w-0">
                    {ticket.owner ? (
                      <>
                        <Avatar name={ticket.owner.name} size={20} />
                        <span className="text-[12px] text-ink-secondary truncate">{ticket.owner.name}</span>
                      </>
                    ) : (
                      <span className="text-[12px] text-ink-faint">Unassigned</span>
                    )}
                  </div>
                  {/* Priority */}
                  <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-ink-secondary">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${prio.dot}`} />
                    {prio.label}
                  </div>
                  {/* Status + warranty signal */}
                  <div className="flex items-center gap-1.5">
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    {w === 'in'       && <StatusPill tone="emerald" icon={<ShieldCheck size={9} />}>In</StatusPill>}
                    {w === 'expiring' && <StatusPill tone="amber"   icon={<ShieldAlert size={9} />}>Exp</StatusPill>}
                    {w === 'out'      && <StatusPill tone="rose"    icon={<ShieldAlert size={9} />}>Out</StatusPill>}
                  </div>
                  {/* Created */}
                  <div className="text-[12px] text-ink-muted tabular-nums">{timeAgo(ticket.created_at)}</div>
                  {/* Kebab — guard blocks the row link for the whole menu subtree */}
                  <div className="hidden sm:flex justify-center relative" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
                    <button onClick={() => setMenuFor(menuFor === ticket.id ? null : ticket.id)} aria-label="Ticket actions"
                      className="p-1.5 rounded-md text-ink-faint hover:text-ink-secondary hover:bg-surface-strong transition-colors">
                      <MoreHorizontal size={15} />
                    </button>
                    {menuFor === ticket.id && (
                      <div ref={menuRef} className="absolute right-8 top-1/2 -translate-y-1/2 z-30 w-44 rounded-lg border border-hairline bg-surface shadow-xl dark:shadow-none dark:ring-1 dark:ring-white/10 py-1">
                        <MenuItem icon={<ExternalLink size={13} />} label="Open" onClick={() => { setMenuFor(null); router.push(`/admin/tickets/${ticket.id}`) }} />
                        {ticket.status !== 'in_progress' && <MenuItem icon={<Clock size={13} />} label="Mark In Progress" onClick={() => setStatusFor([ticket.id], 'in_progress')} />}
                        {ticket.status !== 'resolved' && <MenuItem icon={<CheckCircle2 size={13} />} label="Resolve" onClick={() => setStatusFor([ticket.id], 'resolved')} />}
                      </div>
                    )}
                  </div>
                </Row>
              )
            })
          )}
        </CardTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={sorted.length}
          totalPages={totalPages}
          onPage={setPage}
          onPerPage={setPerPage}
          unit="tickets"
        />
      </ListCard>

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
    </ListCardPage>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors text-left">
      <span className="text-ink-muted">{icon}</span>
      {label}
    </button>
  )
}
