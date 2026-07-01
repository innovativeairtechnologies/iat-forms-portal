'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Inbox, LogOut, Menu, X,
  CalendarClock, TrendingUp, Ticket, ClipboardCheck,
  Calendar, Clock, Boxes, Building2,
  ChevronRight, ShieldCheck, Package, Network, FileText, FilePen, Presentation,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import Logo from '@/components/Logo'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// ─── Types ───────────────────────────────────────────────────────────────────

type BadgeKind = 'submissions' | 'tickets' | 'troubleshooting' | 'pto' | 'sick' | 'usrotors' | 'drafts'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  badge?: BadgeKind
  hidden?: boolean
}

type Counts = {
  submissions: number
  tickets: number
  troubleshooting: number
  pto: number
  sick: number
  usrotors: number
  drafts: number
}

type NavSection = {
  label: string
  items: NavItem[]
  hidden?: boolean
}

// ─── Nav structure ────────────────────────────────────────────────────────────

const DASHBOARD: NavItem = { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true }

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'IAT',
    items: [
      { href: '/admin/submissions',  label: 'Submissions', icon: Inbox,       badge: 'submissions' },
      { href: '/admin/tickets',      label: 'Tickets',     icon: Ticket,      badge: 'tickets' },
      // Troubleshooting merged into Tickets: the two customer forms (Equipment Support +
      // Troubleshooting Checklist) are now one form feeding the tickets pipeline, so the
      // separate tab is hidden. Legacy intakes remain at /admin/troubleshooting by URL.
      // Re-enable by removing `hidden: true`.
      { href: '/admin/troubleshooting', label: 'Troubleshooting', icon: ClipboardCheck, badge: 'troubleshooting', hidden: true },
      { href: '/admin/equipment',    label: 'Equipment',   icon: Boxes },
      { href: '/admin/customers',    label: 'Customers',   icon: Building2 },
    ],
  },
  {
    label: 'Employees',
    items: [
      { href: '/admin/org-chart',      label: 'Org Chart',      icon: Network },
      { href: '/admin/forms',          label: 'Forms',          icon: FileText },
      { href: '/admin/employee-forms', label: 'Employee Forms', icon: FilePen, badge: 'drafts' },
      { href: '/admin/requests/pto',  label: 'PTO',        icon: Calendar,     badge: 'pto' },
      { href: '/admin/requests/sick', label: 'Sick Time',  icon: Clock,        badge: 'sick' },
      { href: '/admin/schedule',      label: 'Scheduling', icon: CalendarClock },
      { href: '/admin/accrual',       label: 'Accrual',    icon: TrendingUp },
    ],
  },
  // US Rotors — hidden for now (not needed currently). Code, routes, API, and badge
  // plumbing are kept for future use; re-enable by removing `hidden: true`.
  {
    label: 'US Rotors',
    hidden: true,
    items: [
      { href: '/admin/us-rotors/orders', label: 'Orders', icon: Package, badge: 'usrotors' },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/presentations', label: 'Presentations', icon: Presentation },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/audit', label: 'Audit Log', icon: ShieldCheck },
    ],
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

const BADGE_CLS: Record<BadgeKind, string> = {
  submissions: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  tickets:     'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  troubleshooting: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  pto:         'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sick:        'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  usrotors:    'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  drafts:      'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

function NavLink({ item, pathname, counts, onClose }: {
  item: NavItem
  pathname: string
  counts: Counts
  onClose?: () => void
}) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
  const dashTheme = pathname === '/admin'
  const badgeCount = item.badge ? counts[item.badge] : 0
  return (
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
      <item.icon size={16} className="flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && badgeCount > 0 && (
        <span className={cn(
          'text-[10px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full',
          BADGE_CLS[item.badge],
        )}>
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  unreadCount: number
  ticketCount: number
  troubleshootingCount: number
  ptoPending: number
  sickPending: number
  usRotorsOrders: number
  draftCount: number
  adminName: string
}

export default function AdminSidebar({ unreadCount, ticketCount, troubleshootingCount, ptoPending, sickPending, usRotorsOrders, draftCount, adminName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const counts: Counts = { submissions: unreadCount, tickets: ticketCount, troubleshooting: troubleshootingCount, pto: ptoPending, sick: sickPending, usrotors: usRotorsOrders, drafts: draftCount }
  const dashTheme = pathname === '/admin'
  const [mobileOpen, setMobileOpen] = useState(false)
  const displayName = adminName || 'Admin'
  const initial = displayName.charAt(0).toUpperCase()

  const logout = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const renderNav = (onClose?: () => void) => (
    <nav className="flex-1 px-3 py-2 overflow-y-auto">
      <NavLink item={DASHBOARD} pathname={pathname} counts={counts} onClose={onClose} />

      {NAV_SECTIONS.filter(s => !s.hidden).map(section => {
        const items = section.items.filter(i => !i.hidden)
        if (items.length === 0) return null
        return (
          <div key={section.label} className="mt-5">
            <div className="px-3 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                {section.label}
              </span>
            </div>
            {items.map(item => (
              <NavLink key={item.href} item={item} pathname={pathname} counts={counts} onClose={onClose} />
            ))}
          </div>
        )
      })}

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
