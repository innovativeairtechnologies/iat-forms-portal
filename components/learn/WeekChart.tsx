import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LearnDashboard } from '@/lib/learn'
import { fmtMins } from './learn-tones'

/* Weekly activity.

   ⚠️ These are minutes of content COMPLETED, not measured study time.
   learn_progress.time_spent_seconds exists but is never written by anything, so
   a real "hours studied" figure would be fabricated. Each bar sums the
   estimated_minutes of the lessons finished that day, bucketed in the house
   timezone (same rule as streaks, so a late-evening finish can't count toward a
   streak but land on the previous bar). The label says so. */

/** Tallest bar, in px. The row reserves this plus room for the value label. */
const BAR_MAX = 96

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-4 py-3 first:pl-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 text-[22px] font-[650] leading-none tracking-tight tabular-nums text-ink">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-ink-muted">{sub}</p>}
    </div>
  )
}

export default function WeekChart({ data }: { data: LearnDashboard }) {
  const { week, weekMinutes, deltaPct, stats } = data
  const peak = Math.max(...week.map(d => d.minutes), 1)

  const Delta = deltaPct === null ? Minus : deltaPct >= 0 ? TrendingUp : TrendingDown
  const deltaTone =
    deltaPct === null ? 'text-ink-muted'
      : deltaPct >= 0 ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-amber-700 dark:text-amber-400'

  return (
    <section className="flex flex-col rounded-xl border border-hairline bg-surface">
      <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-4">
        <h2 className="text-[16px] font-[650] tracking-tight text-ink">This week</h2>
        <span className="text-[11px] text-ink-muted">Content completed</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pb-4">
        <span className="text-[24px] font-[650] leading-none tracking-tight tabular-nums text-ink">
          {fmtMins(weekMinutes)}
        </span>
        <span className={cn('inline-flex items-center gap-1 text-[12px] font-semibold', deltaTone)}>
          <Delta size={13} />
          {deltaPct === null ? 'first week' : `${deltaPct >= 0 ? '+' : ''}${deltaPct}%`}
        </span>
        <span className="text-[12px] text-ink-muted">vs last week</span>
      </div>

      {/* Bars.
          Heights are explicit PIXELS, not percentages. The columns are
          `items-end` inside the row, so they size to their content — a
          percentage height would resolve against an auto-height parent and
          collapse to nothing (which is exactly what the first cut did). */}
      <div className="flex flex-1 items-end gap-2 px-5" style={{ minHeight: BAR_MAX + 28 }}>
        {week.map(d => {
          const h = d.minutes > 0 ? Math.max(6, Math.round((d.minutes / peak) * BAR_MAX)) : 3
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[10px] font-semibold tabular-nums text-ink-muted">
                {d.minutes > 0 ? d.minutes : ''}
              </span>
              <div
                title={`${d.lessons} lesson${d.lessons === 1 ? '' : 's'} · ${d.minutes} min`}
                style={{ height: h }}
                className={cn(
                  'w-full rounded-md transition-colors',
                  // NB: no `/opacity` on --brand. A semantic token with an opacity
                  // modifier compiles to nothing (DESIGN §2.5) — the quieter bars
                  // use the emerald Tone scale, which does support it.
                  d.minutes === 0
                    ? 'bg-surface-strong'
                    : d.isToday
                      ? 'bg-brand'
                      : 'bg-emerald-200 dark:bg-emerald-500/30',
                )}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-2 px-5 pb-4 pt-2">
        {week.map(d => (
          <span
            key={d.key}
            className={cn(
              'flex-1 text-center text-[10.5px] font-semibold uppercase tracking-wide',
              d.isToday ? 'text-ink' : 'text-ink-faint',
            )}
          >
            {d.label}
          </span>
        ))}
      </div>

      <div className="mt-auto grid grid-cols-2 divide-x divide-hairline-soft border-t border-hairline px-5 sm:grid-cols-4">
        <Stat label="Lessons" value={`${stats.lessonsCompleted}`} sub={`of ${stats.totalLessons}`} />
        <Stat label="Subjects" value={`${stats.subjectsCompleted}`} sub={`${stats.subjectsInProgress} in progress`} />
        <Stat label="Streak" value={`${stats.streak}`} sub={stats.longestStreak > stats.streak ? `best ${stats.longestStreak}` : 'days'} />
        <Stat label="Library" value={`${stats.libraryPct}%`} sub="complete" />
      </div>
    </section>
  )
}
