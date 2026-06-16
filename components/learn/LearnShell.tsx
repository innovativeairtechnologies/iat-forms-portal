import Link from 'next/link'
import Logo from '@/components/Logo'
import { GraduationCap, LayoutGrid, Shield, ArrowLeft, Trophy, Flame, Sparkles } from 'lucide-react'
import type { LearnHeaderStats } from '@/lib/learn'

// Top-header shell for the entire /learn experience. Server component; the
// active-link highlighting is intentionally light-touch to keep it RSC-friendly.
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
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U'

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#0a0a0b]">
      {/* Ambient brand wash behind the header */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-[#f0faf4] to-transparent" />

      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6">
          <Link href="/learn" className="flex items-center gap-2.5">
            <Logo size={30} className="flex-shrink-0" />
            <span className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
              <span className="text-[#0a0a0b]">IAT</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-[#f0faf4] px-1.5 py-0.5 text-[12px] font-bold text-[#089447]">
                <GraduationCap size={13} /> Learn
              </span>
            </span>
          </Link>

          <nav className="ml-1 hidden items-center gap-1 sm:flex">
            <Link
              href="/learn"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <LayoutGrid size={14} /> Browse
            </Link>
            <Link
              href="/learn/me"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Sparkles size={14} /> My Learning
            </Link>
            <Link
              href="/learn/leaderboard"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Trophy size={14} /> Leaderboard
            </Link>
            {isAdmin && (
              <Link
                href="/learn/admin"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <Shield size={14} /> Admin
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            {/* Streak + XP chips link to the personal dashboard */}
            <Link href="/learn/me" className="hidden items-center gap-2 sm:flex">
              {stats.currentStreak > 0 && (
                <span
                  title={`${stats.currentStreak}-day streak`}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[12px] font-bold text-orange-600 ring-1 ring-orange-200/70 transition-colors hover:bg-orange-100"
                >
                  <Flame size={13} /> {stats.currentStreak}
                </span>
              )}
              <span
                title={`Level ${stats.level} · ${stats.levelTitle}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f0faf4] px-2.5 py-1 text-[12px] font-bold text-[#077a3c] ring-1 ring-[#dcf5e6] transition-colors hover:bg-[#e3f6ec]"
              >
                <span className="grid h-4 w-4 place-items-center rounded-full bg-[#089447] text-[10px] text-white">
                  {stats.level}
                </span>
                {stats.totalXp.toLocaleString()} XP
              </span>
            </Link>

            <Link
              href={portalHref}
              className="hidden items-center gap-1.5 text-[12.5px] font-medium text-gray-400 transition-colors hover:text-gray-700 lg:flex"
            >
              <ArrowLeft size={13} /> Exit
            </Link>
            <Link href="/learn/me" className="flex items-center gap-2" title="My Learning">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#089447] text-[13px] font-semibold text-white">
                {initial}
              </div>
              <span className="hidden text-[13px] font-medium text-gray-700 xl:block">{displayName}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-10">{children}</main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-4">
        <p className="text-[12px] text-gray-400">
          IAT Learn · Innovative Air Technologies internal training
        </p>
      </footer>
    </div>
  )
}
