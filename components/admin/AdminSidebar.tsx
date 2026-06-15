'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Inbox, LogOut, Menu, X,
  CalendarClock, TrendingUp, Ticket, BarChart2, FileText,
  Calendar, Clock, UserPlus, Search, Plus, Boxes,
  ChevronRight, FolderOpen, Users, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useMemo } from 'react'
import Logo from '@/components/Logo'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// ─── Types ───────────────────────────────────────────────────────────────────

type BadgeKind = 'submissions' | 'tickets' | 'pto' | 'sick'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  badge?: BadgeKind
  children?: NavItem[]
}

type Counts = {
  submissions: number
  tickets: number
  pto: number
  sick: number
}

type FutureItem = {
  label: string
  icon: React.ElementType
}

type NavSection = {
  label: string
  icon: React.ElementType
  href?: string
  items: NavItem[]
  future?: FutureItem[]
}

// ─── Nav structure ────────────────────────────────────────────────────────────

const DASHBOARD: NavItem = { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true }

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Forms',
    icon: FolderOpen,
    href: '/admin/forms',
    items: [
      { href: '/admin/submissions', label: 'Submissions', icon: Inbox, badge: 'submissions' },
      { href: '/admin/tickets',     label: 'Tickets',     icon: Ticket, badge: 'tickets' },
      { href: '/admin/equipment',   label: 'Equipment',   icon: Boxes },
    ],
    future: [
      { label: 'Analytics', icon: BarChart2 },
      { label: 'Reports',   icon: FileText },
    ],
  },
  {
    label: 'Employees',
    icon: Users,
    href: '/admin/employees',
    items: [
      {
        href: '/admin/requests', label: 'Time Off', icon: CalendarClock, exact: true,
        children: [
          { href: '/admin/requests/pto',  label: 'PTO',       icon: Calendar, badge: 'pto' },
          { href: '/admin/requests/sick', label: 'Sick Time', icon: Clock,    badge: 'sick' },
        ],
      },
      { href: '/admin/schedule', label: 'Scheduling', icon: Calendar },
      { href: '/admin/accrual',    label: 'Accrual',    icon: TrendingUp },
    ],
    future: [
      { label: 'Onboarding', icon: UserPlus },
    ],
  },
]

const ALL_NAV_ITEMS: NavItem[] = [
  DASHBOARD,
  ...NAV_SECTIONS.flatMap(s => s.items.flatMap(i => i.children ? [i, ...i.children] : [i])),
  { href: '/admin/forms/new', label: 'New Form', icon: Plus },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

const BADGE_CLS: Record<BadgeKind, string> = {
  submissions: 'bg-[#089447] text-white',
  tickets:     'bg-amber-500 text-white',
  pto:         'bg-amber-500 text-white',
  sick:        'bg-amber-500 text-white',
}

function NavLink({
  item, pathname, counts, onClose, nested = false, suppressChildren = false,
}: {
  item: NavItem
  pathname: string
  counts: Counts
  onClose?: () => void
  nested?: boolean
  suppressChildren?: boolean
}) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
  // The new dashboard lives at /admin — give the nav a matching emerald-accented treatment there only.
  const dashTheme = pathname === '/admin'
  const badgeCount = item.badge ? counts[item.badge] : 0
  return (
    <>
      <Link
        href={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all text-[12px]',
          active
            ? dashTheme
              ? 'bg-emerald-50 dark:bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-400'
              : 'bg-gray-100 dark:bg-zinc-800 font-medium text-gray-900 dark:text-white'
            : dashTheme
              ? 'font-normal text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200'
              : 'font-normal text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-700 dark:hover:text-gray-300',
        )}
      >
        <item.icon size={nested ? 15 : 17} className="flex-shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge && badgeCount > 0 && (
          <span className={cn(
            'text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full',
            BADGE_CLS[item.badge],
          )}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </Link>
      {item.children && !suppressChildren && (
        <div className="ml-[26px] mt-0.5 mb-1 space-y-0.5 border-l border-gray-100 dark:border-zinc-800 pl-2">
          {item.children.map(child => (
            <NavLink key={child.href} item={child} pathname={pathname} counts={counts} onClose={onClose} nested />
          ))}
        </div>
      )}
    </>
  )
}

function FutureLink({ item }: { item: FutureItem }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl text-[12px] font-normal text-gray-300 dark:text-gray-700 cursor-not-allowed select-none">
      <item.icon size={17} className="flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      <span className="text-[10px] tracking-widest uppercase">Soon</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  unreadCount: number
  ticketCount: number
  ptoPending: number
  sickPending: number
  adminName: string
}

export default function AdminSidebar({ unreadCount, ticketCount, ptoPending, sickPending, adminName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const counts: Counts = { submissions: unreadCount, tickets: ticketCount, pto: ptoPending, sick: sickPending }
  // The new dashboard is now at /admin (the old one is parked at /admin/test); theme the nav to match it.
  const dashTheme = pathname === '/admin'
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
          className={cn(
            'w-full text-[13px] border-0 rounded-lg pl-8 pr-3 py-2 text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:ring-2 transition-all',
            dashTheme
              ? 'bg-gray-100 dark:bg-zinc-900 focus:ring-emerald-500/30 dark:focus:ring-zinc-700'
              : 'bg-gray-100 dark:bg-zinc-800 focus:ring-gray-200 dark:focus:ring-gray-700',
          )}
        />
      </div>

      {/* Search results */}
      {filtered ? (
        filtered.length > 0
          ? filtered.map(item => (
              <NavLink key={item.href} item={item} pathname={pathname} counts={counts} onClose={onClose} suppressChildren />
            ))
          : <p className="text-[12px] text-gray-300 dark:text-gray-600 px-3 py-2">No results</p>
      ) : (
        <>
          {/* Dashboard */}
          <NavLink item={DASHBOARD} pathname={pathname} counts={counts} onClose={onClose} />

          {/* Sections */}
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mt-6">
              <div className="px-3 mb-2">
                {section.href ? (
                  <Link
                    href={section.href}
                    onClick={onClose}
                    className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                  >
                    {section.label}
                  </Link>
                ) : (
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                    {section.label}
                  </span>
                )}
              </div>
              {section.items.map(item => (
                <NavLink key={item.href} item={item} pathname={pathname} counts={counts} onClose={onClose} />
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
              counts={counts}
              onClose={onClose}
            />
            <FutureLink item={{ label: 'Import Data', icon: FileText }} />
          </div>
        </>
      )}
    </nav>
  )

  const renderFooter = (onClose?: () => void) => (
    <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
      <button
        onClick={logout}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-all"
      >
        <LogOut size={15} className="flex-shrink-0" />
        Sign Out
      </button>

      {/* User card */}
      <Link
        href="/admin/profile"
        onClick={onClose}
        className={cn(
          'mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group',
          dashTheme
            ? 'bg-gray-50 dark:bg-zinc-900/40 hover:bg-gray-100 dark:hover:bg-zinc-900 border-gray-100 dark:border-zinc-800'
            : 'bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 border-gray-100 dark:border-zinc-700',
        )}
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
      <aside className={cn(
        'hidden md:flex w-[240px] flex-shrink-0 flex-col h-screen sticky top-0 overflow-hidden border-r',
        dashTheme
          ? 'bg-white dark:bg-[#0a0a0b] border-zinc-200 dark:border-zinc-800'
          : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800',
      )}>

        {/* Logo */}
        <div className="px-4 pt-5 pb-4">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <Logo size={26} className="flex-shrink-0" />
            <span className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-[#089447] transition-colors">
              IAT Portal
            </span>
          </Link>
        </div>

        {renderNav()}
        {renderFooter()}
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
        <Link href="/admin" className="flex items-center gap-2.5">
          <Logo size={22} className="flex-shrink-0" />
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
            className={cn(
              'relative w-[260px] flex flex-col h-full shadow-xl',
              dashTheme ? 'bg-white dark:bg-[#0a0a0b]' : 'bg-white dark:bg-zinc-900',
            )}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-zinc-800">
              <Link href="/admin" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <Logo size={22} className="flex-shrink-0" />
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
