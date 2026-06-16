'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calendar, Users, LayoutGrid, FileText, Wrench,
  LogOut, Menu, X, Search, ChevronRight,
  Wind, Package,
} from 'lucide-react'
import Logo from '@/components/Logo'
import { useState, useMemo } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { Employee } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'

// ─── Types ───────────────────────────────────────────────────────────────────

type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean }
type NavSection = { label: string; href?: string; items: NavItem[] }

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Menu',
    items: [
      { href: '/employee/profile',   label: 'Home',     icon: LayoutGrid, exact: true },
      { href: '/employee/requests',  label: 'Time Off',   icon: Calendar },
      { href: '/employee/directory', label: 'Directory',  icon: Users    },
    ],
  },
  {
    label: 'Resources',
    items: [
      { href: '/employee/resources',       label: 'Employee Forms', icon: FileText, exact: true },
      { href: '/employee/resources/tools', label: 'Tools & Apps',   icon: Wrench   },
    ],
  },
  {
    label: 'US Rotors',
    items: [
      { href: '/employee/us-rotors',       label: 'Overview',        icon: Wind,    exact: true },
      { href: '/employee/us-rotors/order', label: 'C-Series Order',  icon: Package              },
    ],
  },
]

const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(s => s.items)

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavLink({ item, pathname, onClose }: { item: NavItem; pathname: string; onClose?: () => void }) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
  // The employee home (/employee/profile) uses the dashboard theme — same as the admin nav on /admin.
  const homeTheme = pathname === '/employee/profile'
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all text-[12px]',
        active
          ? homeTheme
            ? 'bg-emerald-50 dark:bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-400'
            : 'bg-gray-100 dark:bg-zinc-800 font-medium text-gray-900 dark:text-white'
          : homeTheme
            ? 'font-normal text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200'
            : 'font-normal text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-700 dark:hover:text-gray-300',
      )}
    >
      <item.icon size={17} className="flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmployeeShell({ employee, children }: { employee: Employee; children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  // Dashboard theme on the employee home only — mirrors AdminSidebar on /admin.
  const homeTheme = pathname === '/employee/profile'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  const displayName = employee.name || employee.email
  const initials = displayName.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

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
            homeTheme
              ? 'bg-gray-100 dark:bg-zinc-900 focus:ring-emerald-500/30 dark:focus:ring-zinc-700'
              : 'bg-gray-100 dark:bg-zinc-800 focus:ring-gray-200 dark:focus:ring-gray-700',
          )}
        />
      </div>

      {filtered ? (
        filtered.length > 0
          ? filtered.map(item => <NavLink key={item.href} item={item} pathname={pathname} onClose={onClose} />)
          : <p className="text-[12px] text-gray-300 dark:text-gray-600 px-3 py-2">No results</p>
      ) : (
        NAV_SECTIONS.map(section => (
          <div key={section.label} className="mt-5 first:mt-0">
            <div className="px-3 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                {section.label}
              </span>
            </div>
            {section.items.map(item => (
              <NavLink key={item.href} item={item} pathname={pathname} onClose={onClose} />
            ))}
          </div>
        ))
      )}
    </nav>
  )

  const renderFooter = (onClose?: () => void) => (
    <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
      <button
        onClick={logout}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-all"
      >
        <LogOut size={15} className="flex-shrink-0" />
        Sign Out
      </button>

      {/* User card */}
      <Link
        href="/employee/profile/edit"
        onClick={onClose}
        className={cn(
          'mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group',
          homeTheme
            ? 'bg-gray-50 dark:bg-zinc-900/40 hover:bg-gray-100 dark:hover:bg-zinc-900 border-gray-100 dark:border-zinc-800'
            : 'bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 border-gray-100 dark:border-zinc-700',
        )}
      >
        <div className="w-7 h-7 rounded-full bg-gray-900 dark:bg-gray-100 flex items-center justify-center flex-shrink-0">
          <span className="text-[12px] font-bold text-white dark:text-gray-900">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200 truncate leading-none">{displayName}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{employee.job_title || 'Employee'}</p>
        </div>
        <ThemeToggle />
        <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors flex-shrink-0" />
      </Link>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-[#F7F6F3] dark:bg-zinc-950">

      {/* ── Desktop sidebar ── */}
      <aside className={cn(
        'hidden md:flex w-[240px] flex-shrink-0 flex-col h-screen sticky top-0 overflow-hidden border-r',
        homeTheme
          ? 'bg-white dark:bg-[#0a0a0b] border-zinc-200 dark:border-zinc-800'
          : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800',
      )}>
        <div className="px-4 pt-5 pb-4">
          <Link href="/employee/profile" className="flex items-center gap-2.5 group">
            <Logo size={26} className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight leading-none group-hover:text-[#089447] transition-colors">IAT Portal</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Employee</p>
            </div>
          </Link>
        </div>
        {renderNav()}
        {renderFooter()}
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
        <Link href="/employee/profile" className="flex items-center gap-2.5">
          <Logo size={22} className="flex-shrink-0" />
          <span className="text-[13px] font-bold text-gray-900 dark:text-white">IAT Portal</span>
        </Link>
        <button onClick={() => setMobileOpen(true)} className="p-1 text-gray-600 dark:text-gray-400"><Menu size={20} /></button>
      </div>
      <div className="md:hidden h-14 flex-shrink-0" />

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className={cn(
              'relative w-[260px] flex flex-col h-full shadow-xl',
              homeTheme ? 'bg-white dark:bg-[#0a0a0b]' : 'bg-white dark:bg-zinc-900',
            )}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-zinc-800">
              <Link href="/employee/profile" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <Logo size={22} className="flex-shrink-0" />
                <span className="text-[13px] font-bold text-gray-900 dark:text-white">IAT Portal</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            {renderNav(() => setMobileOpen(false))}
            {renderFooter(() => setMobileOpen(false))}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
