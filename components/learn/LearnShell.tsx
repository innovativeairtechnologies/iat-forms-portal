'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutGrid, Sparkles, Trophy, Shield, ArrowLeft,
  LogOut, Menu, X, ChevronRight, Flame,
} from 'lucide-react'
import Logo from '@/components/Logo'
import { cn } from '@/lib/utils'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import ThemeToggle from '@/components/ThemeToggle'
import { PortalTopBar, type Crumb } from '@/components/PortalTopBar'
import { PortalSearch, type SearchItem } from '@/components/PortalSearch'
import type { LearnHeaderStats } from '@/lib/learn'

/* IAT Learn shell — sidebar + admin-style top bar, theme-aware (light + dark),
   mirroring the /admin and employee layouts. Client component so it can own the
   mobile drawer, sign-out, and theme toggle; server data arrives as props. */

type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean }

export default function LearnShell({
  displayName,
  isAdmin,
  portalHref,
  stats,
  children,
}: {
  displayName: string
  isAdmin: boolean
  portalHref: string
  stats: LearnHeaderStats
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U'

  const navItems: NavItem[] = [
    { href: '/learn',             label: 'Browse',      icon: LayoutGrid, exact: true },
    { href: '/learn/me',          label: 'My Learning', icon: Sparkles },
    { href: '/learn/leaderboard', label: 'Leaderboard', icon: Trophy },
    ...(isAdmin ? [{ href: '/learn/admin', label: 'Admin', icon: Shield }] : []),
  ]

  const searchItems: SearchItem[] = [
    { label: 'Browse',       href: '/learn' },
    { label: 'My Learning',  href: '/learn/me' },
    { label: 'Leaderboard',  href: '/learn/leaderboard' },
    ...(isAdmin ? [{ label: 'Learn Admin', href: '/learn/admin', hint: 'Admin' }] : []),
  ]

  const crumbsFor = (p: string): Crumb[] => {
    const root: Crumb = { label: 'Learn' }
    if (p === '/learn') return [root, { label: 'Browse' }]
    if (p.startsWith('/learn/me')) return [root, { label: 'My Learning' }]
    if (p.startsWith('/learn/leaderboard')) return [root, { label: 'Leaderboard' }]
    if (p.startsWith('/learn/admin')) return [root, { label: 'Admin' }]
    return [root, { label: 'Browse', href: '/learn' }, { label: 'Lesson' }]
  }

  const logout = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const NavLink = ({ item, onClose }: { item: NavItem; onClose?: () => void }) => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
    return (
      <Link
        href={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all text-[12px]',
          active
            ? 'bg-emerald-50 dark:bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-400'
            : 'font-normal text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200',
        )}
      >
        <item.icon size={17} className="flex-shrink-0" />
        <span className="flex-1">{item.label}</span>
      </Link>
    )
  }

  const renderNav = (onClose?: () => void) => (
    <nav className="flex-1 overflow-y-auto px-3 py-3">
      <div className="mb-2 px-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">Training</span>
      </div>
      {navItems.map(i => <NavLink key={i.href} item={i} onClose={onClose} />)}
    </nav>
  )

  const renderFooter = (onClose?: () => void) => (
    <div className="space-y-2 border-t border-gray-100 px-3 pb-3 pt-2 dark:border-zinc-800">
      <Link
        href={portalHref}
        onClick={onClose}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-white"
      >
        <ArrowLeft size={15} className="flex-shrink-0" /> Exit to portal
      </Link>
      <button
        onClick={logout}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-white"
      >
        <LogOut size={15} className="flex-shrink-0" /> Sign Out
      </button>
      <Link
        href="/learn/me"
        onClick={onClose}
        className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 transition-all hover:bg-gray-100 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:bg-zinc-900"
      >
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#089447]">
          <span className="text-[12px] font-bold text-white">{initial}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-none text-gray-700 dark:text-gray-200">{displayName}</p>
          <p className="mt-0.5 truncate text-[11px] text-gray-400 dark:text-zinc-500">Level {stats.level} · {stats.levelTitle}</p>
        </div>
        <ChevronRight size={14} className="flex-shrink-0 text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400" />
      </Link>
    </div>
  )

  const chips = (
    <div className="hidden items-center gap-2 sm:flex">
      {stats.currentStreak > 0 && (
        <span
          title={`${stats.currentStreak}-day streak`}
          className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[12px] font-bold text-orange-600 ring-1 ring-orange-200/70 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20"
        >
          <Flame size={13} /> {stats.currentStreak}
        </span>
      )}
      <Link
        href="/learn/me"
        title={`Level ${stats.level} · ${stats.levelTitle}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-bold text-emerald-700 ring-1 ring-emerald-200/70 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20 dark:hover:bg-emerald-500/20"
      >
        <span className="grid h-4 w-4 place-items-center rounded-full bg-[#089447] text-[10px] text-white">{stats.level}</span>
        {stats.totalXp.toLocaleString()} XP
      </Link>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#F7F6F3] dark:bg-zinc-950">

      {/* ── Desktop sidebar ── */}
      <aside className="sticky top-0 hidden h-screen w-[240px] flex-shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0a0a0b] md:flex">
        <div className="px-4 pb-4 pt-5">
          <Link href="/learn" className="group flex items-center gap-2.5">
            <Logo size={26} className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-none tracking-tight text-gray-900 transition-colors group-hover:text-[#089447] dark:text-white">IAT Learn</p>
              <p className="mt-0.5 text-[11px] text-gray-400">Training</p>
            </div>
          </Link>
        </div>
        {renderNav()}
        {renderFooter()}
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-gray-100 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
        <Link href="/learn" className="flex items-center gap-2.5">
          <Logo size={22} className="flex-shrink-0" />
          <span className="text-[13px] font-bold text-gray-900 dark:text-white">IAT Learn</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => setMobileOpen(true)} className="p-1 text-gray-600 dark:text-gray-400"><Menu size={20} /></button>
        </div>
      </div>
      <div className="h-14 flex-shrink-0 md:hidden" />

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative flex h-full w-[260px] flex-col bg-white shadow-xl dark:bg-[#0a0a0b]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 dark:border-zinc-800">
              <Link href="/learn" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <Logo size={22} className="flex-shrink-0" />
                <span className="text-[13px] font-bold text-gray-900 dark:text-white">IAT Learn</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            {renderNav(() => setMobileOpen(false))}
            {renderFooter(() => setMobileOpen(false))}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PortalTopBar crumbs={crumbsFor(pathname)}>
          <PortalSearch items={searchItems} placeholder="Search training…" />
          {chips}
          <ThemeToggle />
        </PortalTopBar>
        <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b]">
          <div className="px-6 py-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
