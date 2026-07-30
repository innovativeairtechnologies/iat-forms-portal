'use client'

import { useMemo, useState } from 'react'
import { Trophy, BookOpen } from 'lucide-react'
import type { LeaderboardRow } from '@/lib/learn'

function initials(name: string): string {
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

// Podium chips on the DESIGN §2.4 Tone system (soft washes, never saturated
// fills). Gold/silver/bronze map to amber / slate / violet — three sanctioned,
// visually distinct tones. Same ladder as TIER_STYLE in components/learn/BadgeIcon.
const RANK_STYLE: Record<number, string> = {
  1: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  2: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
  3: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
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
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-transparent bg-brand-soft px-3 py-1 text-[12px] font-semibold text-brand">
          <Trophy size={13} /> Leaderboard
        </div>
        <h1 className="text-[26px] font-[650] tracking-tight text-ink">Who&apos;s leading the way</h1>
        <p className="mt-1 text-[14px] text-ink-secondary">Ranked by XP earned across the training library.</p>
      </section>

      {/* Your rank */}
      {me && (
        <section className="flex items-center gap-4 rounded-xl border border-brand bg-brand-soft p-4">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-brand text-[14px] font-[650] text-white">
            #{me.rank}
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-brand">Your rank{dept !== 'All' ? ` in ${dept}` : ''}</p>
            <p className="text-[12.5px] text-ink-secondary">
              {me.xp.toLocaleString()} XP · {me.lessonsCompleted} lessons · Level {me.level} {me.levelTitle}
            </p>
          </div>
          <span className="hidden text-[12px] font-medium text-ink-secondary sm:block">of {ranked.length}</span>
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
                  ? 'bg-brand text-white'
                  : 'border border-hairline bg-surface text-ink-secondary hover:border-hairline-strong hover:text-ink',
              ].join(' ')}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-hairline bg-surface">
        {ranked.length === 0 ? (
          <p className="p-10 text-center text-[13.5px] text-ink-muted">No one in this group yet.</p>
        ) : (
          <ul className="divide-y divide-hairline-soft">
            {ranked.map(r => {
              const isMe = r.userId === currentUserId
              return (
                <li
                  key={r.userId}
                  className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${isMe ? 'bg-brand-soft' : 'hover:bg-surface-soft'}`}
                >
                  <span
                    className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[12px] font-[650] tabular-nums ${
                      RANK_STYLE[r.rank] ?? 'bg-surface-strong text-ink-secondary'
                    }`}
                  >
                    {r.rank}
                  </span>
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-surface-strong text-[12px] font-semibold text-ink-secondary">
                    {initials(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink">
                      {r.name}
                      {isMe && <span className="ml-1.5 text-[11px] font-medium text-brand">You</span>}
                    </p>
                    <p className="truncate text-[12px] text-ink-muted">
                      {r.department || 'IAT'} · Lvl {r.level} {r.levelTitle}
                    </p>
                  </div>
                  <span className="hidden items-center gap-1 text-[12px] text-ink-muted sm:flex">
                    <BookOpen size={12.5} /> {r.lessonsCompleted}
                  </span>
                  <span className="w-20 text-right text-[14px] font-[650] tabular-nums text-ink">
                    {r.xp.toLocaleString()}
                    <span className="ml-0.5 text-[11px] font-medium text-ink-muted">XP</span>
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
