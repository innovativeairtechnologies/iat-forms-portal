'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Inbox, FileText, Plus, LogOut, Menu, X, ChevronLeft, ChevronRight, Users, CalendarClock, TrendingUp, UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import Image from 'next/image'

const NAV = [
  { href: '/admin',              label: 'Dashboard',   icon: LayoutDashboard, exact: true },
  { href: '/admin/submissions',  label: 'Submissions', icon: Inbox },
  { href: '/admin/forms',        label: 'Forms',       icon: FileText },
  { href: '/admin/employees',    label: 'Employees',   icon: Users },
  { href: '/admin/requests',     label: 'Time Off',    icon: CalendarClock },
  { href: '/admin/accrual',      label: 'Accrual',     icon: TrendingUp },
]

interface Props {
  unreadCount: number
}

export default function AdminSidebar({ unreadCount }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [adminName, setAdminName] = useState('')

  useEffect(() => {
    const update = () => {
      const name = localStorage.getItem('admin_display_name')
      setAdminName(name?.trim() || '')
    }
    update()
    window.addEventListener('admin-profile-updated', update)
    return () => window.removeEventListener('admin-profile-updated', update)
  }, [])

  const logout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  const displayName = adminName || 'Admin'

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
              <Image
                src="/iat-logo.png"
                alt="IAT Logo"
                width={22}
                height={22}
                style={{ mixBlendMode: 'multiply' }}
              />
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

        {/* Nav */}
        <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2 pb-2">
              Menu
            </p>
          )}

          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
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

                {!collapsed && item.href === '/admin/submissions' && unreadCount > 0 && (
                  <span className="text-[10px] font-bold text-white bg-[#089447] min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {collapsed && item.href === '/admin/submissions' && unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#089447] border-2 border-white dark:border-gray-900" />
                )}
              </Link>
            )
          })}

          <div className={cn('pt-3', !collapsed && 'pb-2')}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2 pb-2">
                Actions
              </p>
            )}
            <Link
              href="/admin/forms/new"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? '+ New Form' : undefined}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all',
                collapsed && 'justify-center',
              )}
            >
              <Plus size={15} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
              {!collapsed && <span className="flex-1">+ New Form</span>}
            </Link>
          </div>
        </nav>

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
              {/* Profile link */}
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

            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2 pb-2">Menu</p>
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all',
                      active
                        ? 'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white',
                    )}
                  >
                    <item.icon size={15} className={active ? 'text-[#089447]' : 'text-gray-400 dark:text-gray-500'} />
                    <span className="flex-1">{item.label}</span>
                    {item.href === '/admin/submissions' && unreadCount > 0 && (
                      <span className="text-[10px] font-bold text-white bg-[#089447] min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
              <div className="pt-3 pb-2">
                <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2 pb-2">Actions</p>
                <Link
                  href="/admin/forms/new"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all"
                >
                  <Plus size={15} className="text-gray-400 dark:text-gray-500" />
                  + New Form
                </Link>
              </div>
            </nav>

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
