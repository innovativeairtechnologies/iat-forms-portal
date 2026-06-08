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

interface Props {
  children: React.ReactNode
  panel: React.ReactNode
  unreadCount: number
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function DashboardShell({ children, panel, unreadCount }: Props) {
  const [adminName, setAdminName] = useState('')
  const [bellOpen, setBellOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const name = localStorage.getItem('admin_display_name')
      if (name?.trim()) setAdminName(name.trim())
    }
    update()
    window.addEventListener('admin-profile-updated', update)
    return () => window.removeEventListener('admin-profile-updated', update)
  }, [])

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true)
    try {
      const res = await fetch('/api/admin/notifications')
      if (res.ok) {
        const { notifications: data } = await res.json()
        setNotifications(data || [])
      }
    } finally {
      setNotifLoading(false)
    }
  }, [])

  const toggleBell = () => {
    if (!bellOpen) fetchNotifications()
    setBellOpen((v) => !v)
  }

  // Close dropdown on outside click
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
      <div className="flex items-center border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">

        {/* Search */}
        <div className="flex-1 min-w-0 px-6 py-3">
          <DashboardSearch />
        </div>

        {/* Actions — desktop */}
        <div className="hidden lg:flex w-[272px] flex-shrink-0 items-center gap-1.5 px-4 py-3 border-l border-gray-100 dark:border-gray-800 justify-end">

          {/* Appearance */}
          <ThemeToggle />

          {/* Notification bell */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={toggleBell}
              title={unreadCount > 0 ? `${unreadCount} unread submission${unreadCount !== 1 ? 's' : ''}` : 'Notifications'}
              className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#089447] border border-white dark:border-gray-900" />
              )}
            </button>

            {/* Dropdown */}
            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                  <div>
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white">Notifications</p>
                    {unreadCount > 0 && (
                      <p className="text-[11px] text-[#089447]">{unreadCount} unread</p>
                    )}
                  </div>
                  <button onClick={() => setBellOpen(false)} className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 transition-colors p-1">
                    <X size={14} />
                  </button>
                </div>

                {notifLoading ? (
                  <div className="py-8 text-center">
                    <div className="w-4 h-4 border-2 border-[#089447] border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell size={20} className="text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                    <p className="text-[13px] text-gray-400">No recent submissions</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-50 dark:divide-gray-800">
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
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-gray-500 dark:text-gray-400">
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
                )}

                <div className="px-4 py-2.5 border-t border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <Link
                    href="/admin/submissions?is_read=false"
                    onClick={() => setBellOpen(false)}
                    className="text-[12px] font-semibold text-[#089447] hover:text-[#077a3c] transition-colors"
                  >
                    View all unread →
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
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#089447] border border-white dark:border-gray-900" />
            )}
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </div>
        <aside className="w-[272px] flex-shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto hidden lg:flex flex-col">
          {panel}
        </aside>
      </div>

    </div>
  )
}
