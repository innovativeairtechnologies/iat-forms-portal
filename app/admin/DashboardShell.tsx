'use client'

import Link from 'next/link'
import { Bell, Plus, X } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import DashboardSearch from './DashboardSearch'
import ThemeToggle from '@/components/ThemeToggle'

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

interface Props {
  children: React.ReactNode
  panel: React.ReactNode
  unreadCount: number
  ticketCount: number
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function DashboardShell({ children, panel, unreadCount, ticketCount }: Props) {
  const [bellOpen, setBellOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [tickets, setTickets] = useState<TicketNotif[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true)
    try {
      const res = await fetch('/api/admin/notifications')
      if (res.ok) {
        const { notifications: data, tickets: tdata } = await res.json()
        setNotifications(data || [])
        setTickets(tdata || [])
      }
    } finally {
      setNotifLoading(false)
    }
  }, [])

  const toggleBell = () => {
    if (!bellOpen) fetchNotifications()
    setBellOpen((v) => !v)
  }

  useEffect(() => {
    if (!bellOpen) return
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bellOpen])

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">

        {/* Search */}
        <div className="flex-1 min-w-0 px-6 py-3">
          <DashboardSearch />
        </div>

        {/* Actions — desktop */}
        <div className="hidden lg:flex w-[272px] flex-shrink-0 items-center gap-1.5 px-4 py-3 border-l border-gray-100 dark:border-zinc-800 justify-end">

          <ThemeToggle />

          {/* Notification bell */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={toggleBell}
              title={
                unreadCount > 0 && ticketCount > 0
                  ? `${unreadCount} unread · ${ticketCount} open tickets`
                  : unreadCount > 0
                  ? `${unreadCount} unread submission${unreadCount !== 1 ? 's' : ''}`
                  : ticketCount > 0
                  ? `${ticketCount} open ticket${ticketCount !== 1 ? 's' : ''}`
                  : 'Notifications'
              }
              className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
            >
              <Bell size={15} />
              {/* Green dot — unread submissions */}
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#089447] border border-white dark:border-zinc-900" />
              )}
              {/* Amber dot — open tickets (offset when both present) */}
              {ticketCount > 0 && (
                <span className={`absolute w-1.5 h-1.5 rounded-full bg-amber-500 border border-white dark:border-zinc-900 ${unreadCount > 0 ? 'top-0.5 right-0.5' : 'top-1.5 right-1.5'}`} />
              )}
            </button>

            {/* Dropdown */}
            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xl z-50 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-zinc-800">
                  <div>
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white">Notifications</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {unreadCount > 0 && <p className="text-[11px] text-[#089447]">{unreadCount} unread</p>}
                      {unreadCount > 0 && ticketCount > 0 && <span className="text-[11px] text-gray-300 dark:text-zinc-600">·</span>}
                      {ticketCount > 0 && <p className="text-[11px] text-amber-500">{ticketCount} open tickets</p>}
                      {!unreadCount && !ticketCount && <p className="text-[11px] text-gray-400">All clear</p>}
                    </div>
                  </div>
                  <button onClick={() => setBellOpen(false)} className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 transition-colors p-1">
                    <X size={14} />
                  </button>
                </div>

                {notifLoading ? (
                  <div className="py-8 text-center">
                    <div className="w-4 h-4 border-2 border-[#089447] border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : (
                  <>
                    {/* Submissions section */}
                    {notifications.length > 0 && (
                      <>
                        <div className="px-4 pt-2.5 pb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Submissions</span>
                        </div>
                        <ul className="divide-y divide-gray-50 dark:divide-zinc-800">
                          {notifications.map((n) => {
                            const name = String(
                              n.data?.['Employee Name'] || n.data?.['Full Name'] || n.data?.['Name'] || 'Anonymous'
                            )
                            const initials = name === 'Anonymous' ? '?' : name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
                            return (
                              <li key={n.id}>
                                <Link
                                  href={`/admin/submissions/${n.id}`}
                                  onClick={() => setBellOpen(false)}
                                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors group"
                                >
                                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                                    {initials}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-[12px] truncate group-hover:text-[#089447] transition-colors ${n.is_read ? 'text-gray-600 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-white'}`}>
                                      {name}
                                    </p>
                                    <p className="text-[11px] text-gray-400 truncate">{n.form_title || 'Form submission'}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className="text-[10px] text-gray-400 tabular-nums">{timeAgo(n.submitted_at)}</span>
                                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#089447]" />}
                                  </div>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      </>
                    )}

                    {/* Tickets section */}
                    {tickets.length > 0 && (
                      <>
                        <div className={`px-4 pt-2.5 pb-1 ${notifications.length > 0 ? 'border-t border-gray-50 dark:border-zinc-800' : ''}`}>
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Open Tickets</span>
                        </div>
                        <ul className="divide-y divide-gray-50 dark:divide-zinc-800">
                          {tickets.map((t) => {
                            const initials = t.customer_name
                              ? t.customer_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
                              : '?'
                            return (
                              <li key={t.id}>
                                <Link
                                  href={`/admin/tickets/${t.id}`}
                                  onClick={() => setBellOpen(false)}
                                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors group"
                                >
                                  <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                    {initials}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                      {t.customer_name || 'Unknown'}
                                    </p>
                                    <p className="text-[11px] text-gray-400 truncate">{t.ticket_number}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className="text-[10px] text-gray-400 tabular-nums">{timeAgo(t.created_at)}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  </div>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      </>
                    )}

                    {/* Empty state */}
                    {notifications.length === 0 && tickets.length === 0 && (
                      <div className="py-8 text-center">
                        <Bell size={20} className="text-gray-200 dark:text-zinc-700 mx-auto mb-2" />
                        <p className="text-[13px] text-gray-400">All clear</p>
                      </div>
                    )}
                  </>
                )}

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-gray-50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 flex items-center justify-between gap-2">
                  <Link
                    href="/admin/submissions?is_read=false"
                    onClick={() => setBellOpen(false)}
                    className="text-[12px] font-semibold text-[#089447] hover:text-[#077a3c] transition-colors"
                  >
                    Unread →
                  </Link>
                  <Link
                    href="/admin/tickets"
                    onClick={() => setBellOpen(false)}
                    className="text-[12px] font-semibold text-amber-500 hover:text-amber-600 transition-colors"
                  >
                    Open tickets →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* New form */}
          <Link
            href="/admin/forms/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#089447] hover:bg-[#077a3c] text-white text-[12px] font-semibold transition-colors shadow-sm"
          >
            <Plus size={13} />
            New Form
          </Link>
        </div>

        {/* Small screens */}
        <div className="lg:hidden flex items-center gap-2 px-4 py-3">
          <ThemeToggle />
          <Link
            href="/admin/submissions?is_read=false"
            className="relative p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-all"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#089447] border border-white dark:border-zinc-900" />
            )}
            {ticketCount > 0 && (
              <span className={`absolute w-1.5 h-1.5 rounded-full bg-amber-500 border border-white dark:border-zinc-900 ${unreadCount > 0 ? 'top-0 right-0' : 'top-1 right-1'}`} />
            )}
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </div>
        <aside className="w-[272px] flex-shrink-0 border-l border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto hidden lg:flex flex-col">
          {panel}
        </aside>
      </div>

    </div>
  )
}
