'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, CornerDownLeft, ArrowUp, ArrowDown,
  LayoutDashboard, Inbox, Ticket, Boxes, Users, CalendarClock,
  Calendar, TrendingUp, FileText, Plus, Sparkles, ShieldCheck,
  FileCheck2, UserRound, LifeBuoy, Command as CommandIcon, Clock,
} from 'lucide-react'

/* ────────────────────────────────────────────────────────────────────────────
   Command palette — press ⌘K / Ctrl+K anywhere in the admin to jump.
   Static destinations + actions are baked in; forms / employees / tickets are
   searched live via /api/admin/search (debounced). Full keyboard nav.
   ──────────────────────────────────────────────────────────────────────────── */

type Item = {
  id: string
  label: string
  sublabel?: string
  group: string
  icon: React.ElementType
  href: string
  keywords?: string
}

// Static destinations + quick actions — mirror the sidebar.
const STATIC: Item[] = [
  { id: 'nav-dash',    label: 'Dashboard',        group: 'Go to', icon: LayoutDashboard, href: '/admin', keywords: 'home overview' },
  { id: 'nav-forms',   label: 'Forms',            group: 'Go to', icon: FileText,        href: '/admin/forms' },
  { id: 'nav-subs',    label: 'Submissions',      group: 'Go to', icon: Inbox,           href: '/admin/submissions' },
  { id: 'nav-tickets', label: 'Tickets',          group: 'Go to', icon: Ticket,          href: '/admin/tickets' },
  { id: 'nav-equip',   label: 'Equipment',        group: 'Go to', icon: Boxes,           href: '/admin/equipment', keywords: 'assets warranty' },
  { id: 'nav-emp',     label: 'Employees',        group: 'Go to', icon: Users,           href: '/admin/employees', keywords: 'people staff team roster' },
  { id: 'nav-pto',     label: 'PTO Requests',     group: 'Go to', icon: Calendar,        href: '/admin/requests/pto', keywords: 'time off vacation' },
  { id: 'nav-sick',    label: 'Sick Time',        group: 'Go to', icon: CalendarClock,   href: '/admin/requests/sick', keywords: 'time off' },
  { id: 'nav-sched',   label: 'Scheduling',       group: 'Go to', icon: Calendar,        href: '/admin/schedule', keywords: 'calendar' },
  { id: 'nav-accrual', label: 'Accrual',          group: 'Go to', icon: TrendingUp,      href: '/admin/accrual', keywords: 'balances hours' },
  { id: 'nav-audit',   label: 'Audit Log',        group: 'Go to', icon: ShieldCheck,     href: '/admin/audit', keywords: 'history activity accountability' },
  { id: 'act-newform', label: 'Create a new form',           group: 'Actions', icon: Plus,       href: '/admin/forms/new', keywords: 'add build' },
  { id: 'act-aiform',  label: 'Build a form with AI',        group: 'Actions', icon: Sparkles,   href: '/admin/forms/ai', keywords: 'generate claude pdf import' },
  { id: 'act-unread',  label: 'Review unread submissions',   group: 'Actions', icon: Inbox,      href: '/admin/submissions?is_read=false' },
]

type SearchResults = {
  forms: { id: string; title: string; is_active: boolean }[]
  employees: { id: string; name: string; email: string; job_title: string | null }[]
  tickets: { id: string; ticket_number: string; customer_name: string; status: string }[]
}

const EMPTY: SearchResults = { forms: [], employees: [], tickets: [] }

// Recent admin activity (audit feed) surfaced in the palette's empty state.
type RecentRow = {
  id: string
  actor_name: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  summary: string
  created_at: string
}

// Map an audit entry to the detail page for the record it touched, so the
// palette can jump straight there. Entities without a detail page fall back to
// the full audit log.
function hrefForRecent(r: RecentRow): string {
  switch (r.entity_type) {
    case 'submission': return r.entity_id ? `/admin/submissions/${r.entity_id}` : '/admin/submissions'
    case 'ticket':     return r.entity_id ? `/admin/tickets/${r.entity_id}` : '/admin/tickets'
    case 'employee':   return r.entity_id ? `/admin/employees/${r.entity_id}` : '/admin/employees'
    case 'form':       return r.entity_id ? `/admin/forms/${r.entity_id}/edit` : '/admin/forms'
    default:           return '/admin/audit'
  }
}

const RECENT_ICON: Record<string, React.ElementType> = {
  submission: Inbox, ticket: LifeBuoy, employee: UserRound, form: FileCheck2,
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [recent, setRecent] = useState<RecentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // ── Open / close via ⌘K, Ctrl+K (and Esc to close) ──────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('commandk:open', onOpen)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('commandk:open', onOpen)
    }
  }, [])

  // Reset + focus when opening; clear when closing.
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(EMPTY)
      setActive(0)
      // focus after paint
      requestAnimationFrame(() => inputRef.current?.focus())
      // pull the latest admin activity for the empty-state feed
      fetch('/api/admin/recent')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.recent) setRecent(d.recent) })
        .catch(() => { /* network — ignore, fall back to nav */ })
    }
  }, [open])

  // ── Debounced live search ───────────────────────────────────────────────────
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(EMPTY)
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        if (res.ok) setResults(await res.json())
      } catch {
        /* aborted or network — ignore */
      } finally {
        setLoading(false)
      }
    }, 180)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query])

  // ── Build the flat, ordered list of visible items ───────────────────────────
  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase()

    // Empty state: lead with recent activity, then the static nav/actions.
    if (!q) {
      const recentItems: Item[] = recent.map((r) => ({
        id: `recent-${r.id}`,
        label: r.summary,
        sublabel: `${r.actor_name || 'System'} · ${timeAgo(r.created_at)}`,
        group: 'Recent activity',
        icon: (r.entity_type && RECENT_ICON[r.entity_type]) || Clock,
        href: hrefForRecent(r),
      }))
      return [...recentItems, ...STATIC]
    }

    const statics = STATIC.filter((i) => (i.label + ' ' + (i.keywords || '')).toLowerCase().includes(q))
    const live: Item[] = [
      ...results.forms.map((f) => ({
        id: `form-${f.id}`, label: f.title, sublabel: f.is_active ? 'Live form' : 'Draft form',
        group: 'Forms', icon: FileCheck2, href: `/admin/forms/${f.id}/edit`,
      })),
      ...results.employees.map((e) => ({
        id: `emp-${e.id}`, label: e.name, sublabel: e.job_title || e.email,
        group: 'Employees', icon: UserRound, href: `/admin/employees/${e.id}`,
      })),
      ...results.tickets.map((t) => ({
        id: `tkt-${t.id}`, label: t.customer_name || t.ticket_number,
        sublabel: `${t.ticket_number} · ${t.status.replace('_', ' ')}`,
        group: 'Tickets', icon: LifeBuoy, href: `/admin/tickets/${t.id}`,
      })),
    ]
    return [...statics, ...live]
  }, [query, results, recent])

  // Keep the active index in range as the list changes.
  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, items.length - 1))) }, [items.length])

  const go = useCallback((item?: Item) => {
    const target = item || items[active]
    if (!target) return
    setOpen(false)
    router.push(target.href)
  }, [items, active, router])

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go() }
  }

  // Scroll the active row into view on change.
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  if (!open) return null

  // Group items in render order while preserving the flat index for nav.
  let idx = -1
  const groups: { group: string; items: { item: Item; i: number }[] }[] = []
  for (const item of items) {
    idx++
    const last = groups[groups.length - 1]
    if (last && last.group === item.group) last.items.push({ item, i: idx })
    else groups.push({ group: item.group, items: [{ item, i: idx }] })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-zinc-100 dark:border-zinc-800">
          <Search size={17} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={onInputKey}
            placeholder="Search forms, people, tickets, or jump to a page…"
            className="flex-1 bg-transparent text-[14px] text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none"
          />
          {loading && <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">No matches for “{query}”</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">Try a form title, a name, or a ticket number.</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.group} className="px-2 pb-1">
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  {g.group}
                </div>
                {g.items.map(({ item, i }) => {
                  const Icon = item.icon
                  const isActive = i === active
                  return (
                    <button
                      key={item.id}
                      data-idx={i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item)}
                      className={
                        'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ' +
                        (isActive ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50')
                      }
                    >
                      <span className={'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ' + (isActive ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400')}>
                        <Icon size={15} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={'block text-[13px] truncate ' + (isActive ? 'font-medium text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-200')}>
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{item.sublabel}</span>
                        )}
                      </span>
                      {isActive && <CornerDownLeft size={13} className="text-emerald-500 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 h-10 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/30 text-[11px] text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-1"><ArrowUp size={11} /><ArrowDown size={11} /> navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={11} /> open</span>
          <span className="flex items-center gap-1"><CommandIcon size={11} /> K to toggle</span>
          <span className="ml-auto">esc to close</span>
        </div>
      </div>
    </div>
  )
}
