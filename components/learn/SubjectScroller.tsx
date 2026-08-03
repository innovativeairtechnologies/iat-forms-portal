'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Clock, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SubjectCard, SubjectStatus } from '@/lib/learn'
import { LEARN_TONE, fmtMins } from './learn-tones'

/* The library as a horizontal deck of subject cards.

   Filters are only the ones the data can actually answer. The reference design
   this is modelled on had "Mandatory" and "Recommended" tabs and a due-date
   pill; neither exists in the schema (no is_mandatory, no due_date), so rather
   than fake them the pill carries the CATEGORY and the filters carry real
   progress state. Due dates arrive with the assignments feature. */

const FILTERS: { key: 'all' | SubjectStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'not-started', label: 'Not started' },
  { key: 'completed', label: 'Completed' },
]

export default function SubjectScroller({ subjects }: { subjects: SubjectCard[] }) {
  const [filter, setFilter] = useState<'all' | SubjectStatus>('all')

  const counts = useMemo(() => ({
    all: subjects.length,
    'not-started': subjects.filter(s => s.status === 'not-started').length,
    'in-progress': subjects.filter(s => s.status === 'in-progress').length,
    completed: subjects.filter(s => s.status === 'completed').length,
  }), [subjects])

  const shown = filter === 'all' ? subjects : subjects.filter(s => s.status === filter)

  return (
    <section className="rounded-xl border border-hairline bg-surface">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <h2 className="text-[16px] font-[650] tracking-tight text-ink">My courses</h2>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map(f => {
            const active = filter === f.key
            const n = counts[f.key]
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                disabled={n === 0 && f.key !== 'all'}
                className={cn(
                  'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  active
                    ? 'bg-ink text-surface'
                    : 'bg-surface-strong text-ink-secondary hover:text-ink disabled:opacity-40 disabled:hover:text-ink-secondary',
                )}
              >
                {f.label}
                <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
              </button>
            )
          })}
        </div>

        <Link
          href="/admin/learn/me"
          className="ml-auto text-[12.5px] font-medium text-ink-muted transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          My progress →
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="px-5 pb-6 text-[13px] text-ink-muted">Nothing here yet.</p>
      ) : (
        // Horizontal deck. `-mx-px px-5` keeps the first/last card's border from
        // being clipped by the scroll container.
        <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-5 learn-deck">
          {shown.map(s => {
            const t = LEARN_TONE[s.tone]
            const done = s.status === 'completed'
            return (
              <Link
                key={s.id}
                href={s.href}
                className={cn(
                  'group relative flex w-[262px] flex-shrink-0 snap-start flex-col rounded-xl border p-4 transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  t.card,
                )}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', t.pill)}>
                    <BookOpen size={11} /> {s.categoryName}
                  </span>
                  {done && (
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold', t.pill)}>
                      <Check size={11} /> Done
                    </span>
                  )}
                </div>

                <h3 className="text-[15px] font-[650] leading-snug tracking-tight text-ink">{s.title}</h3>
                {s.description && (
                  <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-ink-secondary">
                    {s.description}
                  </p>
                )}

                <div className="mt-auto pt-4">
                  <div className="mb-2 flex items-center gap-3 text-[11.5px] font-medium text-ink-secondary">
                    <span className="inline-flex items-center gap-1"><BookOpen size={11} /> {s.lessonCount} lessons</span>
                    <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmtMins(s.minutes)}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={cn('h-1.5 flex-1 overflow-hidden rounded-full', t.track)}>
                      <span className={cn('block h-full rounded-full transition-all', t.bar)} style={{ width: `${s.pct}%` }} />
                    </span>
                    <span className="text-[11.5px] font-semibold tabular-nums text-ink">{s.pct}%</span>
                  </div>
                </div>

                <ArrowRight
                  size={15}
                  className={cn('absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100', t.accent)}
                />
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
