'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Stethoscope, Search, X, ChevronUp, ChevronDown, ChevronsUpDown,
  MoreHorizontal, Eye, CheckCircle2, ExternalLink, RotateCcw,
} from 'lucide-react'
import type { TroubleshootingIntake } from '@/lib/supabase'
import { updateTroubleshootingStatus } from './actions'
import {
  HEADER_BOX, BODY_BOX, rowCx, StatusPill, Avatar, timeAgo, Th, TROUBLESHOOTING_STATUS, TableScroll,
} from '@/components/admin/list'

type Filter  = 'all' | 'new' | 'reviewed' | 'closed'
type SortKey = 'created_at' | 'customer_name' | 'status'
type SortDir = 'asc' | 'desc'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',      label: 'All'      },
  { value: 'new',      label: 'New'      },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'closed',   label: 'Closed'   },
]

const COLS = 'grid-cols-[34px_120px_1.3fr_1.7fr_104px_72px_40px]'

function matchesSearch(t: TroubleshootingIntake, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  return (
    t.reference_number.toLowerCase().includes(lower) ||
    t.customer_name.toLowerCase().includes(lower) ||
    (t.customer_company ?? '').toLowerCase().includes(lower) ||
    (t.customer_email ?? '').toLowerCase().includes(lower) ||
    t.serial_number.toLowerCase().includes(lower) ||
    t.problem_description.toLowerCase().includes(lower)
  )
}

export default function TroubleshootingQueueClient({ intakes }: { intakes: TroubleshootingIntake[] }) {
  const router = useRouter()
  const [filter, setFilter]   = useState<Filter>('new')
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

  const byStatus = filter === 'all' ? intakes : intakes.filter(t => t.status === filter)
  const bySearch = byStatus.filter(t => matchesSearch(t, search))
  const sorted = [...bySearch].sort((a, b) => {
    let cmp = 0
    if      (sortKey === 'created_at')    cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    else if (sortKey === 'customer_name') cmp = a.customer_name.localeCompare(b.customer_name)
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

  const setStatusFor = (ids: string[], status: TroubleshootingIntake['status']) => {
    startTransition(async () => {
      await Promise.all(ids.map(id => updateTroubleshootingStatus(id, status)))
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
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Support</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Troubleshooting</h1>
      </div>

      <div className="p-4 sm:p-8">

        {/* Status tabs */}
        <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800 mb-4">
          {FILTERS.map(({ value, label }) => {
            const count = value === 'all' ? intakes.length : intakes.filter(t => t.status === value).length
            const active = filter === value
            return (
              <button key={value} onClick={() => setFilter(value)}
                className={`relative pb-2.5 text-[13px] whitespace-nowrap transition-colors ${
                  active ? 'font-semibold text-zinc-900 dark:text-white' : 'font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}>
                {label}
                <span className={`ml-1.5 text-[11px] tabular-nums ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{count}</span>
                {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-emerald-500" />}
              </button>
            )
          })}
        </div>

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
          <span className="ml-auto text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">
            {sorted.length} {sorted.length === 1 ? 'case' : 'cases'}
          </span>
        </div>

        {/* Floating header */}
        <TableScroll minWidth={760}>
        <div className={`grid ${COLS} ${HEADER_BOX}`}>
          <div className="flex items-center justify-center">
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer" />
          </div>
          <Th>Reference</Th>
          <Th><button onClick={() => toggleSort('customer_name')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Customer <SortIcon col="customer_name" /></button></Th>
          <Th>Problem</Th>
          <Th><button onClick={() => toggleSort('status')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Status <SortIcon col="status" /></button></Th>
          <Th><button onClick={() => toggleSort('created_at')} className={`flex items-center gap-1 uppercase tracking-wider ${sortable}`}>Created <SortIcon col="created_at" /></button></Th>
          <Th />
        </div>

        {/* Body */}
        <div className={BODY_BOX}>
          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <Stethoscope size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">
                {search ? `No cases match "${search}"` : `No ${filter !== 'all' ? FILTERS.find(f => f.value === filter)?.label.toLowerCase() : ''} cases.`}
              </p>
            </div>
          ) : (
            sorted.map((intake, i) => {
              const st = TROUBLESHOOTING_STATUS[intake.status] ?? TROUBLESHOOTING_STATUS.new
              const isSel = selected.has(intake.id)
              return (
                <div key={intake.id} onClick={() => router.push(`/admin/troubleshooting/${intake.id}`)}
                  className={`${rowCx(COLS, { i, selected: isSel })} cursor-pointer group`}>
                  {/* Checkbox */}
                  <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSel} onChange={() => toggle(intake.id)}
                      className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer" />
                  </div>
                  {/* Reference */}
                  <div className="font-mono text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate">{intake.reference_number}</div>
                  {/* Customer */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={intake.customer_name} />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {intake.customer_name}
                    </span>
                  </div>
                  {/* Problem */}
                  <div className="min-w-0">
                    <span className="text-zinc-600 dark:text-zinc-300 truncate block">{intake.problem_description}</span>
                  </div>
                  {/* Status */}
                  <div><StatusPill tone={st.tone}>{st.label}</StatusPill></div>
                  {/* Created */}
                  <div className="text-zinc-400 dark:text-zinc-500 tabular-nums">{timeAgo(intake.created_at)}</div>
                  {/* Kebab */}
                  <div className="flex justify-center relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setMenuFor(menuFor === intake.id ? null : intake.id)}
                      className="p-1.5 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <MoreHorizontal size={15} />
                    </button>
                    {menuFor === intake.id && (
                      <div ref={menuRef} className="absolute right-8 top-1/2 -translate-y-1/2 z-30 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1">
                        <MenuItem icon={<ExternalLink size={13} />} label="Open" onClick={() => { setMenuFor(null); router.push(`/admin/troubleshooting/${intake.id}`) }} />
                        {intake.status !== 'reviewed' && <MenuItem icon={<Eye size={13} />} label="Mark Reviewed" onClick={() => setStatusFor([intake.id], 'reviewed')} />}
                        {intake.status !== 'closed' && <MenuItem icon={<CheckCircle2 size={13} />} label="Close" onClick={() => setStatusFor([intake.id], 'closed')} />}
                        {intake.status !== 'new' && <MenuItem icon={<RotateCcw size={13} />} label="Reopen (New)" onClick={() => setStatusFor([intake.id], 'new')} />}
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
          <button onClick={() => setStatusFor(Array.from(selected), 'reviewed')} disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap disabled:opacity-50">
            <Eye size={13} /> Reviewed
          </button>
          <button onClick={() => setStatusFor(Array.from(selected), 'closed')} disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap disabled:opacity-50">
            <CheckCircle2 size={13} /> Close
          </button>
          <button onClick={() => setSelected(new Set())} disabled={pending}
            className="ml-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-white/5 transition-colors disabled:opacity-50">
            Discard
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
