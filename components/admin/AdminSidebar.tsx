'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Inbox, LogOut, Menu, X,
  CalendarClock, TrendingUp, Ticket, BarChart2, FileText,
  DollarSign, Calendar, UserPlus, Search, Plus,
  ChevronRight, UserCircle, FolderOpen, Users, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useMemo } from 'react'
import Image from 'next/image'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  icon: React.ElementType
  items: NavItem[]
  future?: FutureItem[]
}

// ─── Nav structure ────────────────────────────────────────────────────────────

const DASHBOARD: NavItem = { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true }

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Forms',
    icon: FolderOpen,
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
    icon: Users,
    items: [
      { href: '/admin/requests', label: 'Time Off', icon: CalendarClock },
      { href: '/admin/accrual',  label: 'Accrual',  icon: TrendingUp },
    ],
    future: [
      { label: 'Payroll',    icon: DollarSign },
      { label: 'Scheduling', icon: Calendar },
      { label: 'Onboarding', icon: UserPlus },
    ],
  },
]

const ALL_NAV_ITEMS: NavItem[] = [
  DASHBOARD,
  ...NAV_SECTIONS.flatMap(s => s.items),
  { href: '/admin/forms/new', label: 'New Form', icon: Plus },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavLink({
  item, pathname, unreadCount, onClose,
}: {
  item: NavItem
  pathname: string
  unreadCount: number
  onClose?: () => void
}) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[14px]',
        active
          ? 'bg-gray-100 dark:bg-gray-800 font-medium text-gray-900 dark:text-white'
          : 'font-normal text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300',
      )}
    >
      <item.icon size={17} className="flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.showBadge && unreadCount > 0 && (
        <span className="text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full bg-[#089447] text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}

function FutureLink({ item }: { item: FutureItem }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-normal text-gray-300 dark:text-gray-700 cursor-not-allowed select-none">
      <item.icon size={17} className="flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      <span className="text-[10px] tracking-widest uppercase">Soon</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  unreadCount: number
  adminName: string
}

export default function AdminSidebar({ unreadCount, adminName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const displayName = adminName || 'Admin'
  const initial = displayName.charAt(0).toUpperCase()

  const logout = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return ALL_NAV_ITEMS.filter(item => item.label.toLowerCase().includes(q))
  }, [search])

  const renderNav = (onClose?: () => void) => (
    <nav className="flex-1 px-3 py-2 overflow-y-auto">
      {/* Search */}
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full text-[13px] bg-gray-100 dark:bg-gray-800 border-0 rounded-lg pl-8 pr-3 py-2 text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all"
        />
      </div>

      {/* Search results */}
      {filtered ? (
        filtered.length > 0
          ? filtered.map(item => (
              <NavLink key={item.href} item={item} pathname={pathname} unreadCount={unreadCount} onClose={onClose} />
            ))
          : <p className="text-[12px] text-gray-300 dark:text-gray-600 px-3 py-2">No results</p>
      ) : (
        <>
          {/* Dashboard */}
          <NavLink item={DASHBOARD} pathname={pathname} unreadCount={unreadCount} onClose={onClose} />

          {/* Sections */}
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mt-6">
              <div className="px-3 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                  {section.label}
                </span>
              </div>
              {section.items.map(item => (
                <NavLink key={item.href} item={item} pathname={pathname} unreadCount={unreadCount} onClose={onClose} />
              ))}
              {section.future?.map(fi => <FutureLink key={fi.label} item={fi} />)}
            </div>
          ))}

          {/* Actions */}
          <div className="mt-6">
            <div className="px-3 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                Actions
              </span>
            </div>
            <NavLink
              item={{ href: '/admin/forms/new', label: 'New Form', icon: Plus }}
              pathname={pathname}
              unreadCount={0}
              onClose={onClose}
            />
            <FutureLink item={{ label: 'Import Data', icon: FileText }} />
          </div>
        </>
      )}
    </nav>
  )

  const renderFooter = (onClose?: () => void) => (
    <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800">
      <p className="text-[12px] font-medium text-[rgb(167,167,167)] dark:text-[rgb(140,140,140)] px-3 pb-1.5">
        Settings
      </p>
      <Link
        href="/admin/profile"
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all"
      >
        <UserCircle size={15} className="flex-shrink-0" />
        Profile
      </Link>
      <button
        onClick={logout}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all"
      >
        <LogOut size={15} className="flex-shrink-0" />
        Sign Out
      </button>

      {/* User card */}
      <Link
        href="/admin/profile"
        onClick={onClose}
        className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700 transition-all group"
      >
        <div className="w-7 h-7 rounded-full bg-gray-900 dark:bg-gray-100 flex items-center justify-center flex-shrink-0">
          <span className="text-[12px] font-bold text-white dark:text-gray-900">{initial}</span>
        </div>
        <span className="flex-1 text-[13px] font-semibold text-gray-700 dark:text-gray-200 truncate">{displayName}</span>
        <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors flex-shrink-0" />
      </Link>
    </div>
  )

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-[240px] flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col h-screen sticky top-0 overflow-hidden">

        {/* Logo */}
        <div className="px-4 pt-5 pb-4">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-sm border border-black/[0.06]">
              <Image src="/iat-logo.png" alt="IAT" width={22} height={22} style={{ mixBlendMode: 'multiply' }} />
            </div>
            <span className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-[#089447] transition-colors">
              IAT Portal
            </span>
          </Link>
        </div>

        {renderNav()}
        {renderFooter()}
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm border border-black/[0.06]">
            <Image src="/iat-logo.png" alt="IAT" width={18} height={18} style={{ mixBlendMode: 'multiply' }} />
          </div>
          <span className="text-[13px] font-bold text-gray-900 dark:text-white">IAT Portal</span>
        </Link>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold text-white bg-[#089447] min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <button onClick={() => setMobileOpen(true)} className="p-1 text-gray-600 dark:text-gray-400">
            <Menu size={20} />
          </button>
        </div>
      </div>

      <div className="md:hidden h-14 flex-shrink-0" />

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-[260px] bg-white dark:bg-gray-900 flex flex-col h-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
              <Link href="/admin" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm border border-black/[0.06]">
                  <Image src="/iat-logo.png" alt="IAT" width={18} height={18} style={{ mixBlendMode: 'multiply' }} />
                </div>
                <span className="text-[13px] font-bold text-gray-900 dark:text-white">IAT Portal</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={18} />
              </button>
            </div>
            {renderNav(() => setMobileOpen(false))}
            {renderFooter(() => setMobileOpen(false))}
          </div>
        </div>
      )}
    </>
  )
}
