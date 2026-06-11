'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Bell, X } from 'lucide-react'

/* Client-side pieces of the /admin dashboard top bar: working search + bell.
   Styled for the new operations-overview theme (zinc surfaces, emerald accent). */

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
export function TopBarSearch() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`/admin/submissions?search=${encodeURIComponent(query.trim())}`)
  }

  return (
    <form onSubmit={handleSubmit} className="hidden md:block relative w-64">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search submissions…"
        className="w-full h-9 pl-9 pr-3 text-[13px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all"
      />
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
        className="relative p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
      >
        <Bell size={15} />
        {/* Emerald dot — unread submissions */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-zinc-50 dark:border-[#0a0a0b]" />
        )}
        {/* Rose dot — open tickets (offset when both present) */}
        {ticketCount > 0 && (
          <span className={`absolute w-1.5 h-1.5 rounded-full bg-rose-500 border border-zinc-50 dark:border-[#0a0a0b] ${unreadCount > 0 ? 'top-0.5 right-0.5' : 'top-1.5 right-1.5'}`} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Notifications</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {unreadCount > 0 && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{unreadCount} unread</p>}
                {unreadCount > 0 && ticketCount > 0 && <span className="text-[11px] text-zinc-300 dark:text-zinc-600">·</span>}
                {ticketCount > 0 && <p className="text-[11px] text-rose-500 dark:text-rose-400">{ticketCount} open tickets</p>}
                {!unreadCount && !ticketCount && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">All clear</p>}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors p-1">
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
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Submissions</span>
                  </div>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {notifications.map((n) => {
                      const name = String(n.data?.['Employee Name'] || n.data?.['Full Name'] || n.data?.['Name'] || 'Anonymous')
                      return (
                        <li key={n.id}>
                          <Link
                            href={`/admin/submissions/${n.id}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-zinc-500 dark:text-zinc-300">
                              {initialsOf(name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[12px] truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors ${n.is_read ? 'text-zinc-500 dark:text-zinc-400' : 'font-semibold text-zinc-900 dark:text-zinc-100'}`}>
                                {name}
                              </p>
                              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{n.form_title || 'Form submission'}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">{timeAgo(n.submitted_at)}</span>
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
                  <div className={`px-4 pt-2.5 pb-1 ${notifications.length > 0 ? 'border-t border-zinc-100 dark:border-zinc-800' : ''}`}>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Open Tickets</span>
                  </div>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {tickets.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/admin/tickets/${t.id}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-rose-500 dark:text-rose-400">
                            {initialsOf(t.customer_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors">
                              {t.customer_name || 'Unknown'}
                            </p>
                            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{t.ticket_number}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">{timeAgo(t.created_at)}</span>
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
                  <Bell size={20} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-[13px] text-zinc-400 dark:text-zinc-500">All clear</p>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/30 flex items-center justify-between gap-2">
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
