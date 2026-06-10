'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  User, Calendar, Users, LayoutGrid, FileText, Wrench,
  LogOut, Menu, X, Search, ChevronRight,
} from 'lucide-react'
import Image from 'next/image'
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
      { href: '/employee/profile',   label: 'My Profile', icon: User,     exact: true },
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
]

const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(s => s.items)

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavLink({ item, pathname, onClose }: { item: NavItem; pathname: string; onClose?: () => void }) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all text-[12px]',
        active
          ? 'bg-gray-100 dark:bg-zinc-800 font-medium text-gray-900 dark:text-white'
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
          className="w-full text-[13px] bg-gray-100 dark:bg-zinc-800 border-0 rounded-lg pl-8 pr-3 py-2 text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all"
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
        href="/employee/profile"
        onClick={onClose}
        className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 border border-gray-100 dark:border-zinc-700 transition-all group"
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
      <aside className="hidden md:flex w-[240px] flex-shrink-0 bg-white dark:bg-zinc-900 border-r border-gray-100 dark:border-zinc-800 flex-col h-screen sticky top-0 overflow-hidden">
        <div className="px-4 pt-5 pb-4">
          <Link href="/employee/profile" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-sm border border-black/[0.06]">
              <Image src="/iat-logo.png" alt="IAT" width={22} height={22} style={{ mixBlendMode: 'multiply' }} />
            </div>
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
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm border border-black/[0.06]">
            <Image src="/iat-logo.png" alt="IAT" width={18} height={18} style={{ mixBlendMode: 'multiply' }} />
          </div>
          <span className="text-[13px] font-bold text-gray-900 dark:text-white">IAT Portal</span>
        </Link>
        <button onClick={() => setMobileOpen(true)} className="p-1 text-gray-600 dark:text-gray-400"><Menu size={20} /></button>
      </div>
      <div className="md:hidden h-14 flex-shrink-0" />

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-[260px] bg-white dark:bg-zinc-900 flex flex-col h-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-zinc-800">
              <Link href="/employee/profile" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm border border-black/[0.06]">
                  <Image src="/iat-logo.png" alt="IAT" width={18} height={18} style={{ mixBlendMode: 'multiply' }} />
                </div>
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
