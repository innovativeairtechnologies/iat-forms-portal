'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Inbox, Plus, LogOut, Menu, X, ChevronLeft, ChevronRight,
  CalendarClock, TrendingUp, UserCircle, Ticket, BarChart2, FileText,
  DollarSign, Calendar, UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import Image from 'next/image'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  showBadge?: boolean
}

type FutureItem = {
  label: string
  icon: React.ElementType
}

type NavSection = {
  label: string
  items: NavItem[]
  future?: FutureItem[]
}

const DASHBOARD: NavItem = { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true }

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Forms',
    items: [
      { href: '/admin/submissions', label: 'Submissions', icon: Inbox, showBadge: true },
      { href: '/admin/tickets',     label: 'Tickets',     icon: Ticket },
    ],
    future: [
      { label: 'Analytics', icon: BarChart2 },
      { label: 'Reports',   icon: FileText },
    ],
  },
  {
    label: 'Employees',
    items: [
      { href: '/admin/requests', label: 'Time Off', icon: CalendarClock },
      { href: '/admin/accrual',  label: 'Accrual',  icon: TrendingUp },
    ],
    future: [
      { label: 'Payroll',     icon: DollarSign },
      { label: 'Scheduling',  icon: Calendar },
      { label: 'Onboarding',  icon: UserPlus },
    ],
  },
]

interface Props {
  unreadCount: number
  adminName: string
}

function NavItemLink({
  item, collapsed, pathname, unreadCount, onClose,
}: {
  item: NavItem
  collapsed: boolean
  pathname: string
  unreadCount: number
  onClose?: () => void
}) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
  return (
    <Link
      key={item.href}
      href={item.href}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      className={cn(
        'relative flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-[13px] font-medium transition-all',
        collapsed && 'justify-center',
        active
          ? 'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white',
      )}
    >
      <item.icon
        size={15}
        className={cn('flex-shrink-0', active ? 'text-[#089447]' : 'text-gray-400 dark:text-gray-500')}
      />
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {item.showBadge && unreadCount > 0 && !collapsed && (
        <span className="text-[10px] font-bold text-white bg-[#089447] min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      {item.showBadge && unreadCount > 0 && collapsed && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#089447] border-2 border-white dark:border-gray-900" />
      )}
    </Link>
  )
}

function FutureItemRow({ item }: { item: FutureItem }) {
  return (
    <div
      title="Coming soon"
      className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] font-medium text-gray-300 dark:text-gray-700 cursor-not-allowed select-none"
    >
      <item.icon size={15} className="flex-shrink-0 text-gray-200 dark:text-gray-700" />
      <span className="flex-1">{item.label}</span>
      <span className="text-[10px] text-gray-200 dark:text-gray-700 font-medium tracking-wide">Soon</span>
    </div>
  )
}

export default function AdminSidebar({ unreadCount, adminName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const logout = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = adminName || 'Admin'

  const renderDesktopNav = () => (
    <nav className="flex-1 px-2 py-1 overflow-y-auto">
      {/* Dashboard */}
      {!collapsed && (
        <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2 pb-1.5 pt-1">
          Menu
        </p>
      )}
      <NavItemLink item={DASHBOARD} collapsed={collapsed} pathname={pathname} unreadCount={unreadCount} />

      {/* Grouped sections */}
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mt-3">
          {!collapsed && (
            <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2 pb-1.5">
              {section.label}
            </p>
          )}
          {collapsed && <div className="border-t border-gray-100 dark:border-gray-800 mx-2 my-1.5" />}
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavItemLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} unreadCount={unreadCount} />
            ))}
            {!collapsed && section.future?.map((fi) => (
              <FutureItemRow key={fi.label} item={fi} />
            ))}
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="mt-3">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2 pb-1.5">
            Actions
          </p>
        )}
        {collapsed && <div className="border-t border-gray-100 dark:border-gray-800 mx-2 my-1.5" />}
        <Link
          href="/admin/forms/new"
          title={collapsed ? '+ New Form' : undefined}
          className={cn(
            'flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all',
            collapsed && 'justify-center',
          )}
        >
          <Plus size={15} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
          {!collapsed && <span className="flex-1">New Form</span>}
        </Link>
        {!collapsed && (
          <div title="Coming soon" className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] font-medium text-gray-300 dark:text-gray-700 cursor-not-allowed select-none">
            <FileText size={15} className="flex-shrink-0 text-gray-200 dark:text-gray-700" />
            <span className="flex-1">Import Data</span>
            <span className="text-[10px] text-gray-200 dark:text-gray-700 font-medium tracking-wide">Soon</span>
          </div>
        )}
      </div>
    </nav>
  )

  const renderMobileNav = () => (
    <nav className="flex-1 px-3 py-3 overflow-y-auto">
      <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2 pb-1.5">
        Menu
      </p>
      <NavItemLink item={DASHBOARD} collapsed={false} pathname={pathname} unreadCount={unreadCount} onClose={() => setMobileOpen(false)} />

      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mt-3">
          <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2 pb-1.5">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavItemLink key={item.href} item={item} collapsed={false} pathname={pathname} unreadCount={unreadCount} onClose={() => setMobileOpen(false)} />
            ))}
            {section.future?.map((fi) => (
              <FutureItemRow key={fi.label} item={fi} />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-3">
        <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2 pb-1.5">
          Actions
        </p>
        <Link
          href="/admin/forms/new"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all"
        >
          <Plus size={15} className="text-gray-400 dark:text-gray-500" />
          + New Form
        </Link>
        <div title="Coming soon" className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] font-medium text-gray-300 dark:text-gray-700 cursor-not-allowed select-none">
          <FileText size={15} className="text-gray-200 dark:text-gray-700" />
          <span className="flex-1">Import Data</span>
          <span className="text-[10px] text-gray-200 dark:text-gray-700 font-medium tracking-wide">Soon</span>
        </div>
      </div>
    </nav>
  )

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          'hidden md:flex bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col flex-shrink-0 h-screen sticky top-0 overflow-hidden',
          'transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-[220px]',
        )}
      >
        {/* Logo + collapse toggle */}
        <div className={cn('flex items-center gap-2 px-4 pt-5 pb-5', collapsed && 'flex-col px-0 items-center')}>
          <Link
            href="/admin"
            className={cn('flex items-center gap-2.5 group flex-1 min-w-0', collapsed && 'flex-initial')}
            title={collapsed ? 'IAT Portal' : undefined}
          >
            <div className="w-8 h-8 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-sm border border-black/[0.06]">
              <Image src="/iat-logo.png" alt="IAT Logo" width={22} height={22} style={{ mixBlendMode: 'multiply' }} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 dark:text-white leading-none tracking-tight group-hover:text-[#089447] transition-colors">
                  IAT Portal
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Admin</p>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex-shrink-0 p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {renderDesktopNav()}

        {/* Footer */}
        <div className="p-2 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
          {collapsed ? (
            <>
              <Link
                href="/admin/profile"
                title={`Welcome, ${displayName}`}
                className="w-full flex items-center justify-center px-2.5 py-2.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-[#089447] dark:hover:text-[#089447] transition-all"
              >
                <UserCircle size={15} />
              </Link>
              <button
                onClick={logout}
                title="Sign Out"
                className="w-full flex items-center justify-center px-2.5 py-2.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-all"
              >
                <LogOut size={15} className="text-gray-300 dark:text-gray-600" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/admin/profile"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-[#089447] dark:hover:text-[#089447] transition-all"
              >
                <UserCircle size={15} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                <span className="flex-1 truncate">Welcome, {displayName}</span>
              </Link>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-all"
              >
                <LogOut size={15} className="text-gray-300 dark:text-gray-600" />
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 h-14">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-sm border border-black/[0.06]">
            <Image src="/iat-logo.png" alt="IAT Logo" width={18} height={18} style={{ mixBlendMode: 'multiply' }} />
          </div>
          <span className="text-[13px] font-bold text-gray-900 dark:text-white">IAT Portal</span>
        </Link>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold text-white bg-[#089447] min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <button onClick={() => setMobileOpen(true)} className="text-gray-600 dark:text-gray-400 p-1">
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Mobile content offset */}
      <div className="md:hidden h-14 flex-shrink-0" />

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-[260px] bg-white dark:bg-gray-900 flex flex-col h-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
              <Link href="/admin" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm border border-black/[0.06]">
                  <Image src="/iat-logo.png" alt="IAT Logo" width={18} height={18} style={{ mixBlendMode: 'multiply' }} />
                </div>
                <span className="text-[13px] font-bold text-gray-900 dark:text-white">IAT Portal</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                <X size={18} />
              </button>
            </div>

            {renderMobileNav()}

            <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
              <Link
                href="/admin/profile"
                onClick={() => setMobileOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-[#089447] dark:hover:text-[#089447] transition-all"
              >
                <UserCircle size={15} className="text-gray-300 dark:text-gray-600" />
                Welcome, {displayName}
              </Link>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-all"
              >
                <LogOut size={15} className="text-gray-300 dark:text-gray-600" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
