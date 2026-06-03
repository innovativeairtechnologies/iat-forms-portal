'use client'

import Link from 'next/link'
import { Bell, Plus } from 'lucide-react'
import DashboardSearch from './DashboardSearch'

interface Props {
  children: React.ReactNode
  panel: React.ReactNode
  unreadCount: number
}

export default function DashboardShell({ children, panel, unreadCount }: Props) {
  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* Top bar — split to mirror the body layout */}
      <div className="flex items-center border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">

        {/* Search — same width as main content */}
        <div className="flex-1 min-w-0 px-6 py-3">
          <DashboardSearch />
        </div>

        {/* Actions — aligns with the People panel on lg+ */}
        <div className="hidden lg:flex w-[272px] flex-shrink-0 items-center gap-1.5 px-4 py-3 border-l border-gray-100 dark:border-gray-800 justify-end">
          {/* Notification bell */}
          <Link
            href="/admin/submissions?is_read=false"
            title={unreadCount > 0 ? `${unreadCount} unread submission${unreadCount !== 1 ? 's' : ''}` : 'No unread submissions'}
            className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#089447] border border-white dark:border-gray-900" />
            )}
          </Link>

          {/* New form */}
          <Link
            href="/admin/forms/new"
            title="New form"
            className="p-2 rounded-lg bg-[#089447] hover:bg-[#077a3c] text-white transition-colors shadow-sm"
          >
            <Plus size={15} />
          </Link>

          {/* Profile avatar */}
          <Link
            href="/admin/profile"
            title="Your profile"
            className="ml-1 w-8 h-8 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center text-white text-[12px] font-bold hover:opacity-75 transition-opacity ring-2 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600"
          >
            A
          </Link>
        </div>

        {/* Small screens — just avatar */}
        <div className="lg:hidden flex items-center gap-2 px-4 py-3">
          <Link
            href="/admin/submissions?is_read=false"
            className="relative p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-all"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#089447] border border-white dark:border-gray-900" />
            )}
          </Link>
          <Link
            href="/admin/profile"
            className="w-8 h-8 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center text-white text-[12px] font-bold hover:opacity-75 transition-opacity"
          >
            A
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
