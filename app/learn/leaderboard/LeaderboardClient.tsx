'use client'

import { useMemo, useState } from 'react'
import { Trophy, BookOpen } from 'lucide-react'
import type { LeaderboardRow } from '@/lib/learn'

function initials(name: string): string {
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

const RANK_STYLE: Record<number, string> = {
  1: 'bg-yellow-400 text-white',
  2: 'bg-slate-300 text-white',
  3: 'bg-amber-600 text-white',
}

export default function LeaderboardClient({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[]
  currentUserId: string
}) {
  const departments = useMemo(
    () => Array.from(new Set(rows.map(r => r.department).filter((d): d is string => !!d))).sort(),
    [rows],
  )
  const [dept, setDept] = useState<string>('All')

  const filtered = useMemo(
    () => (dept === 'All' ? rows : rows.filter(r => r.department === dept)),
    [rows, dept],
  )

  // Rank within the current view.
  const ranked = filtered.map((r, i) => ({ ...r, rank: i + 1 }))
  const me = ranked.find(r => r.userId === currentUserId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <section>
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#dcf5e6] bg-[#f0faf4] px-3 py-1 text-[12px] font-semibold text-[#077a3c] dark:border-zinc-800 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Trophy size={13} /> Leaderboard
        </div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#0a0a0b] dark:text-white">Who&apos;s leading the way</h1>
        <p className="mt-1 text-[14px] text-gray-500 dark:text-zinc-400">Ranked by XP earned across the training library.</p>
      </section>

      {/* Your rank */}
      {me && (
        <section className="flex items-center gap-4 rounded-2xl border border-[#b9ebce] bg-[#f0faf4] p-4 shadow-card dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:shadow-none">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-[#089447] text-[14px] font-bold text-white">
            #{me.rank}
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[#077a3c] dark:text-emerald-400">Your rank{dept !== 'All' ? ` in ${dept}` : ''}</p>
            <p className="text-[12.5px] text-gray-600 dark:text-zinc-300">
              {me.xp.toLocaleString()} XP · {me.lessonsCompleted} lessons · Level {me.level} {me.levelTitle}
            </p>
          </div>
          <span className="hidden text-[12px] font-medium text-gray-500 sm:block dark:text-zinc-400">of {ranked.length}</span>
        </section>
      )}

      {/* Department filter */}
      {departments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {['All', ...departments].map(d => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={[
                'rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                dept === d
                  ? 'bg-[#089447] text-white'
                  : 'border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100',
              ].join(' ')}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none">
        {ranked.length === 0 ? (
          <p className="p-10 text-center text-[13.5px] text-gray-400 dark:text-zinc-500">No one in this group yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60">
            {ranked.map(r => {
              const isMe = r.userId === currentUserId
              return (
                <li
                  key={r.userId}
                  className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${isMe ? 'bg-[#f0faf4] dark:bg-emerald-500/10' : 'dark:hover:bg-zinc-800/60'}`}
                >
                  <span
                    className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums ${
                      RANK_STYLE[r.rank] ?? 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {r.rank}
                  </span>
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gray-800 text-[12px] font-semibold text-white dark:bg-zinc-700">
                    {initials(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-gray-800 dark:text-zinc-100">
                      {r.name}
                      {isMe && <span className="ml-1.5 text-[11px] font-medium text-[#089447] dark:text-emerald-400">You</span>}
                    </p>
                    <p className="truncate text-[12px] text-gray-400 dark:text-zinc-500">
                      {r.department || 'IAT'} · Lvl {r.level} {r.levelTitle}
                    </p>
                  </div>
                  <span className="hidden items-center gap-1 text-[12px] text-gray-400 sm:flex dark:text-zinc-500">
                    <BookOpen size={12.5} /> {r.lessonsCompleted}
                  </span>
                  <span className="w-20 text-right text-[14px] font-bold tabular-nums text-[#0a0a0b] dark:text-white">
                    {r.xp.toLocaleString()}
                    <span className="ml-0.5 text-[11px] font-medium text-gray-400 dark:text-zinc-500">XP</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
