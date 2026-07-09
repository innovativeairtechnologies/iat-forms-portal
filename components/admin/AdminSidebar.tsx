'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Inbox, LogOut, Menu, X,
  ChevronRight, ChevronDown, ShieldCheck, Package,
  Users, Bot, DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { type Perm } from '@/lib/roles'
import { useViewAs, ViewAsControl } from '@/components/admin/ViewAs'

// ─── Types ───────────────────────────────────────────────────────────────────

type BadgeKind = 'submissions' | 'tickets' | 'troubleshooting' | 'pto' | 'sick' | 'usrotors' | 'drafts'

type NavChild = {
  href: string
  label: string
  badge?: BadgeKind
  hidden?: boolean
  perm: Perm
}

type NavParent = {
  label: string
  icon: LucideIcon
  hidden?: boolean
  children: NavChild[]
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

// ─── Nav structure — parents with expandable children ─────────────────────────

const DASHBOARD = { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard' as Perm }

const NAV_PARENTS: NavParent[] = [
  {
    label: 'Operations',
    icon: Inbox,
    children: [
      { href: '/admin/submissions', label: 'Submissions', badge: 'submissions', perm: 'submissions' },
      { href: '/admin/tickets', label: 'Tickets', badge: 'tickets', perm: 'tickets' },
      // Troubleshooting merged into Tickets (route stays live by URL). Re-enable by
      // removing `hidden: true`.
      { href: '/admin/troubleshooting', label: 'Troubleshooting', badge: 'troubleshooting', hidden: true, perm: 'tickets' },
      { href: '/admin/forms', label: 'Forms', perm: 'forms' },
      { href: '/admin/equipment', label: 'Equipment', perm: 'equipment' },
      { href: '/admin/srv', label: 'SRV Form', perm: 'srv' },
      // Gantt kept visible to demo despite leadership concerns; pause with `hidden: true`.
      { href: '/admin/gantt', label: 'Gantt', perm: 'gantt' },
    ],
  },
  {
    label: 'Sales',
    icon: DollarSign,
    children: [
      { href: '/admin/deals', label: 'Deals', perm: 'deals' },
      { href: '/admin/customers', label: 'Customers', perm: 'customers' },
      { href: '/admin/presentations', label: 'Presentations', perm: 'presentations' },
    ],
  },
  {
    label: 'People',
    icon: Users,
    children: [
      { href: '/admin/employees', label: 'Accounts', perm: 'employees' },
      { href: '/admin/org-chart', label: 'Org Chart', perm: 'org_chart' },
      // Employee Forms merged into Forms (route + employee portal stay live). Re-enable
      // by removing `hidden: true`.
      { href: '/admin/employee-forms', label: 'Employee Forms', badge: 'drafts', hidden: true, perm: 'employee_forms' },
      { href: '/admin/requests/pto', label: 'PTO', badge: 'pto', perm: 'pto' },
      { href: '/admin/requests/sick', label: 'Sick Time', badge: 'sick', perm: 'sick' },
      { href: '/admin/schedule', label: 'Scheduling', perm: 'scheduling' },
      { href: '/admin/accrual', label: 'Accrual', perm: 'accrual' },
    ],
  },
  {
    label: 'Jerry',
    icon: Bot,
    children: [
      { href: '/admin/jerry', label: 'Ask Jerry', perm: 'jerry' },
      { href: '/admin/customer-jerry', label: 'Customer Jerry', perm: 'customer_jerry' },
      { href: '/admin/knowledge', label: "Jerry's Brain", perm: 'knowledge' },
    ],
  },
  // US Rotors — hidden for now; plumbing kept. Re-enable by removing `hidden: true`.
  {
    label: 'US Rotors',
    icon: Package,
    hidden: true,
    children: [
      { href: '/admin/us-rotors/orders', label: 'Orders', badge: 'usrotors', perm: 'us_rotors' },
    ],
  },
  {
    label: 'System',
    icon: ShieldCheck,
    children: [
      { href: '/admin/audit', label: 'Audit Log', perm: 'audit' },
      { href: '/admin/permissions', label: 'Permissions', perm: 'permissions' },
    ],
  },
]

const OPEN_KEY = 'admin-nav-open'

// ─── Badges (Tone system: soft wash + colored text) ───────────────────────────

const BADGE_CLS: Record<BadgeKind, string> = {
  submissions: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  tickets:     'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  troubleshooting: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  pto:         'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sick:        'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  usrotors:    'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  drafts:      'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

function Badge({ kind, count }: { kind: BadgeKind; count: number }) {
  if (count <= 0) return null
  return (
    <span className={cn(
      'text-[10px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full',
      BADGE_CLS[kind],
    )}>
      {count > 99 ? '99+' : count}
    </span>
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
  const { hasPerm, home } = useViewAs()
  const counts: Counts = { submissions: unreadCount, tickets: ticketCount, troubleshooting: troubleshootingCount, pto: ptoPending, sick: sickPending, usrotors: usRotorsOrders, drafts: draftCount }
  const [mobileOpen, setMobileOpen] = useState(false)
  const displayName = adminName || 'Admin'
  const initial = displayName.charAt(0).toUpperCase()

  const isChildActive = (c: NavChild) => pathname.startsWith(c.href)
  const activeParent = NAV_PARENTS.find(p => p.children.some(isChildActive))?.label ?? null

  // Expanded parents: user toggles persist across reloads; the parent that owns
  // the current page is always forced open. localStorage is read in an effect
  // (not the initializer) so server and client render the same initial HTML.
  const [open, setOpen] = useState<string[]>([])
  useEffect(() => {
    let stored: string[] = []
    try { stored = JSON.parse(localStorage.getItem(OPEN_KEY) || '[]') } catch { /* private mode */ }
    setOpen(prev => Array.from(new Set([...prev, ...stored])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (activeParent) setOpen(prev => (prev.includes(activeParent) ? prev : [...prev, activeParent]))
  }, [activeParent])
  const toggle = (label: string) =>
    setOpen(prev => {
      const next = prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })

  const logout = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const renderNav = (onClose?: () => void) => (
    <nav className="flex-1 px-3 py-2 overflow-y-auto">
      {hasPerm(DASHBOARD.perm) && (
        <Link
          href={DASHBOARD.href}
          onClick={onClose}
          className={cn(
            'relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors',
            pathname === DASHBOARD.href
              ? 'bg-surface-strong text-ink'
              : 'text-ink-secondary hover:bg-surface-strong hover:text-ink',
          )}
        >
          {pathname === DASHBOARD.href && <span className="absolute -left-1 top-2 bottom-2 w-0.5 rounded-full bg-brand" />}
          <DASHBOARD.icon size={15} className="flex-shrink-0 text-ink-muted" />
          Dashboard
        </Link>
      )}

      {NAV_PARENTS.filter(p => !p.hidden).map(parent => {
        const children = parent.children.filter(c => !c.hidden && hasPerm(c.perm))
        if (children.length === 0) return null
        const isOpen = open.includes(parent.label)
        const hasActive = parent.label === activeParent
        const collapsedCount = children.reduce((n, c) => n + (c.badge ? counts[c.badge] : 0), 0)
        return (
          <div key={parent.label} className="mt-0.5">
            <button
              onClick={() => toggle(parent.label)}
              aria-expanded={isOpen}
              className={cn(
                'relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors text-left',
                hasActive ? 'bg-surface-strong text-ink' : 'text-ink-secondary hover:bg-surface-strong hover:text-ink',
              )}
            >
              {hasActive && <span className="absolute -left-1 top-2 bottom-2 w-0.5 rounded-full bg-brand" />}
              <parent.icon size={15} className={cn('flex-shrink-0', hasActive ? 'text-ink' : 'text-ink-muted')} />
              <span className="flex-1">{parent.label}</span>
              {!isOpen && collapsedCount > 0 && (
                <span className="text-[10px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {collapsedCount > 99 ? '99+' : collapsedCount}
                </span>
              )}
              <ChevronDown
                size={12}
                className={cn('flex-shrink-0 text-ink-faint transition-transform duration-150', isOpen && 'rotate-180')}
              />
            </button>
            {isOpen && (
              <div className="pb-1">
                {children.map(child => {
                  const active = isChildActive(child)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-2 py-1.5 pl-[34px] pr-2.5 rounded-md text-[12px] transition-colors',
                        active
                          ? 'bg-surface-strong font-medium text-ink'
                          : 'text-ink-muted hover:bg-surface-strong hover:text-ink',
                      )}
                    >
                      <span className="flex-1">{child.label}</span>
                      {child.badge && <Badge kind={child.badge} count={counts[child.badge]} />}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  const renderFooter = (onClose?: () => void) => (
    <div className="px-3 pb-3 pt-2 border-t border-hairline-soft">
      {/* Admin-only "View as [role]" nav preview (no effect on real access). */}
      <ViewAsControl />

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          onClick={logout}
          className="flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium text-ink-muted hover:bg-surface-strong hover:text-ink transition-colors"
        >
          <LogOut size={14} className="flex-shrink-0" />
          Sign Out
        </button>
      </div>

      <Link
        href="/admin/profile"
        onClick={onClose}
        className="mt-2 flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-hairline bg-surface hover:bg-surface-soft transition-colors group"
      >
        <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
          <span className="text-[12px] font-semibold text-canvas">{initial}</span>
        </div>
        <span className="flex-1 text-[12.5px] font-semibold text-ink truncate">{displayName}</span>
        <ChevronRight size={14} className="text-ink-faint group-hover:text-ink-muted transition-colors flex-shrink-0" />
      </Link>
    </div>
  )

  return (
    <>
      {/* ── Desktop sidebar — sits on the warm canvas; content cards carry the white ── */}
      <aside className="hidden md:flex w-[240px] flex-shrink-0 flex-col h-screen sticky top-0 overflow-hidden bg-canvas border-r border-hairline">
        <div className="px-4 pt-5 pb-3">
          <Link href={home} className="flex items-center gap-2.5 group">
            <Logo size={26} className="flex-shrink-0" />
            <span className="text-[14px] font-semibold text-ink tracking-tight group-hover:text-brand-ink transition-colors">
              IAT Portal
            </span>
          </Link>
        </div>
        {renderNav()}
        {renderFooter()}
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-canvas border-b border-hairline">
        <Link href={home} className="flex items-center gap-2.5">
          <Logo size={22} className="flex-shrink-0" />
          <span className="text-[13px] font-semibold text-ink">IAT Portal</span>
        </Link>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-[10px] font-semibold text-canvas bg-brand min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <button onClick={() => setMobileOpen(true)} className="p-1 text-ink-secondary">
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
            className="relative w-[260px] flex flex-col h-full bg-canvas"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-hairline">
              <Link href={home} className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <Logo size={22} className="flex-shrink-0" />
                <span className="text-[13px] font-semibold text-ink">IAT Portal</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-ink-faint hover:text-ink-secondary">
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
