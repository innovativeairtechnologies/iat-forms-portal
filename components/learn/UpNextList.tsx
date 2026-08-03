import Link from 'next/link'
import { Clock, Play, Flame, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LearnDashboard } from '@/lib/learn'
import { LEARN_TONE } from './learn-tones'

/* "Up next" — what to actually open, plus a 7-day activity strip.

   The reference design showed scheduled lessons with an instructor avatar and a
   clock time. Lessons have neither an instructor nor a schedule, so instead of
   inventing both this answers the question that panel really serves: what do I
   open next? Subjects already underway come first (resume beats start), then
   fresh ones, in library order.

   The day strip is the streak made visible — a filled dot for every day you
   finished something, today ringed. Same buckets as the chart. */

export default function UpNextList({ data }: { data: LearnDashboard }) {
  const { week, upNext, stats } = data

  return (
    <section className="flex flex-col rounded-xl border border-hairline bg-surface">
      <div className="flex items-baseline justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="text-[16px] font-[650] tracking-tight text-ink">Up next</h2>
        {stats.streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <Flame size={12} /> {stats.streak}-day streak
          </span>
        )}
      </div>

      {/* Activity strip */}
      <div className="flex gap-1.5 border-b border-hairline px-5 pb-4">
        {week.map(d => {
          const active = d.lessons > 0
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={cn('text-[10px] font-semibold uppercase tracking-wide', d.isToday ? 'text-ink' : 'text-ink-faint')}>
                {d.label}
              </span>
              <span
                title={active ? `${d.lessons} lesson${d.lessons === 1 ? '' : 's'}` : 'No activity'}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold tabular-nums transition-colors',
                  active
                    ? 'bg-brand text-white'
                    : 'bg-surface-strong text-ink-muted',
                  d.isToday && !active && 'ring-2 ring-inset ring-emerald-400',
                  d.isToday && active && 'ring-2 ring-offset-2 ring-emerald-300 ring-offset-surface dark:ring-emerald-600',
                )}
              >
                {d.dayOfMonth}
              </span>
            </div>
          )
        })}
      </div>

      {upNext.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <Trophy size={22} className="text-amber-500" />
          <p className="text-[13.5px] font-semibold text-ink">Library complete</p>
          <p className="text-[12.5px] text-ink-secondary">
            You&apos;ve finished every published lesson. New content will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-hairline-soft">
          {upNext.map(l => {
            const t = LEARN_TONE[l.tone]
            return (
              <li key={l.id}>
                <Link
                  href={l.href}
                  className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                >
                  <span className={cn('grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg', t.card, t.accent)}>
                    <Play size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink group-hover:text-brand">{l.title}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
                      {l.resuming ? 'Continue' : 'Start'} · {l.moduleTitle}
                    </p>
                  </div>
                  <span className="inline-flex flex-shrink-0 items-center gap-1 text-[11.5px] tabular-nums text-ink-muted">
                    <Clock size={11} /> {l.minutes}m
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
