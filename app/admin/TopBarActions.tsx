'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Bell, X } from 'lucide-react'

/* Client-side pieces of the /admin dashboard top bar: working search + bell.
   Styled on the Quiet Precision semantic tokens (DESIGN.md). */

interface Notification {
  id: string
  form_title: string | null
  submitted_at: string
  data: Record<string, unknown>
  is_read: boolean
}

interface TicketNotif {
  id: string
  ticket_number: string
  customer_name: string
  customer_email: string | null
  created_at: string
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function initialsOf(name: string) {
  if (!name || name === 'Anonymous') return '?'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Search ───────────────────────────────────────────────────────────────────
// The top-bar box launches the ⌘K command palette (the real cross-entity search).
// Its placeholder cycles through what you can reach, so the box advertises its
// full reach instead of looking submissions-only.
const SEARCH_HINTS = ['submissions', 'tickets', 'employees', 'forms', 'PTO requests', 'orders', 'equipment']

export function TopBarSearch() {
  const [query, setQuery] = useState('')
  const [hintIdx, setHintIdx] = useState(0)
  const [hintVisible, setHintVisible] = useState(true)
  const [focused, setFocused] = useState(false)

  // Rotate the placeholder while the box is idle (empty + unfocused): fade the
  // current hint out, swap it, fade the next one in.
  useEffect(() => {
    if (focused || query) { setHintVisible(true); return }
    let swap: ReturnType<typeof setTimeout>
    const cycle = setInterval(() => {
      setHintVisible(false)
      swap = setTimeout(() => {
        setHintIdx((i) => (i + 1) % SEARCH_HINTS.length)
        setHintVisible(true)
      }, 220)
    }, 2600)
    return () => { clearInterval(cycle); clearTimeout(swap) }
  }, [focused, query])

  const openPalette = (seed?: string) =>
    window.dispatchEvent(new CustomEvent('commandk:open', seed ? { detail: { query: seed } } : {}))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    openPalette(query.trim() || undefined)
    setQuery('')
  }

  return (
    <form onSubmit={handleSubmit} className="hidden md:block relative w-64">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="Search"
        placeholder=""
        className="w-full h-9 pl-9 pr-12 text-[13px] rounded-lg bg-surface border border-hairline text-ink-secondary outline-none hover:border-hairline-strong focus:border-brand transition-colors"
      />
      {!query && (
        <span
          aria-hidden
          className={`absolute left-9 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint pointer-events-none transition-opacity duration-200 ${hintVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          Search {SEARCH_HINTS[hintIdx]}…
        </span>
      )}
      <button
        type="button"
        onClick={() => openPalette(query.trim() || undefined)}
        title="Open command palette (⌘K)"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 h-5 rounded border border-hairline bg-surface-soft text-[10px] font-semibold text-ink-faint hover:text-ink-secondary hover:border-hairline-strong transition-colors"
      >
        ⌘K
      </button>
    </form>
  )
}

// ─── Bell + dropdown ──────────────────────────────────────────────────────────
export function TopBarBell({ unreadCount, ticketCount }: { unreadCount: number; ticketCount: number }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [tickets, setTickets] = useState<TicketNotif[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/notifications')
      if (res.ok) {
        const { notifications: data, tickets: tdata } = await res.json()
        setNotifications(data || [])
        setTickets(tdata || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const toggle = () => {
    if (!open) fetchNotifications()
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        title={
          unreadCount > 0 && ticketCount > 0
            ? `${unreadCount} unread · ${ticketCount} open tickets`
            : unreadCount > 0
            ? `${unreadCount} unread submission${unreadCount !== 1 ? 's' : ''}`
            : ticketCount > 0
            ? `${ticketCount} open ticket${ticketCount !== 1 ? 's' : ''}`
            : 'Notifications'
        }
        className="relative p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-strong transition-colors"
      >
        <Bell size={15} />
        {/* Emerald dot — unread submissions */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-canvas" />
        )}
        {/* Rose dot — open tickets (offset when both present) */}
        {ticketCount > 0 && (
          <span className={`absolute w-1.5 h-1.5 rounded-full bg-rose-500 border border-canvas ${unreadCount > 0 ? 'top-0.5 right-0.5' : 'top-1.5 right-1.5'}`} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-hairline bg-surface shadow-xl dark:shadow-none dark:ring-1 dark:ring-white/10 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-hairline-soft">
            <div>
              <p className="text-[13px] font-semibold text-ink">Notifications</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {unreadCount > 0 && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{unreadCount} unread</p>}
                {unreadCount > 0 && ticketCount > 0 && <span className="text-[11px] text-ink-faint">·</span>}
                {ticketCount > 0 && <p className="text-[11px] text-rose-500 dark:text-rose-400">{ticketCount} open tickets</p>}
                {!unreadCount && !ticketCount && <p className="text-[11px] text-ink-muted">All clear</p>}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink-muted transition-colors p-1">
              <X size={14} />
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {/* Submissions */}
              {notifications.length > 0 && (
                <>
                  <div className="px-4 pt-2.5 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Submissions</span>
                  </div>
                  <ul className="divide-y divide-hairline-soft">
                    {notifications.map((n) => {
                      const name = String(n.data?.['Employee Name'] || n.data?.['Full Name'] || n.data?.['Name'] || 'Anonymous')
                      return (
                        <li key={n.id}>
                          <Link
                            href={`/admin/submissions/${n.id}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-soft transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-full bg-surface-strong flex items-center justify-center flex-shrink-0 text-[11px] font-semibold text-ink-muted">
                              {initialsOf(name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[12px] truncate group-hover:text-brand-ink transition-colors ${n.is_read ? 'text-ink-muted' : 'font-semibold text-ink'}`}>
                                {name}
                              </p>
                              <p className="text-[11px] text-ink-muted truncate">{n.form_title || 'Form submission'}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className="text-[10px] text-ink-muted tabular-nums">{timeAgo(n.submitted_at)}</span>
                              {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}

              {/* Open tickets */}
              {tickets.length > 0 && (
                <>
                  <div className={`px-4 pt-2.5 pb-1 ${notifications.length > 0 ? 'border-t border-hairline-soft' : ''}`}>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Open Tickets</span>
                  </div>
                  <ul className="divide-y divide-hairline-soft">
                    {tickets.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/admin/tickets/${t.id}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-soft transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0 text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                            {initialsOf(t.customer_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-ink truncate group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors">
                              {t.customer_name || 'Unknown'}
                            </p>
                            <p className="text-[11px] text-ink-muted truncate">{t.ticket_number}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-[10px] text-ink-muted tabular-nums">{timeAgo(t.created_at)}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Empty state */}
              {notifications.length === 0 && tickets.length === 0 && (
                <div className="py-8 text-center">
                  <Bell size={20} className="text-ink-faint mx-auto mb-2" />
                  <p className="text-[13px] text-ink-muted">All clear</p>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-hairline-soft bg-surface-soft flex items-center justify-between gap-2">
            <Link
              href="/admin/submissions?is_read=false"
              onClick={() => setOpen(false)}
              className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 transition-colors"
            >
              Unread →
            </Link>
            <Link
              href="/admin/tickets"
              onClick={() => setOpen(false)}
              className="text-[12px] font-semibold text-rose-500 hover:text-rose-400 dark:text-rose-400 transition-colors"
            >
              Open tickets →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
