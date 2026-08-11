'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, BookOpen, Clock, Check, CalendarClock, Search, X, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SubjectCard, SubjectStatus } from '@/lib/learn'
import { LEARN_TONE, fmtMins } from './learn-tones'

/* The library, as shelves.

   This replaced a single horizontal deck of every subject. That deck was built
   when there were 14 subjects; the Refrigeration & HVAC/R course took it to 32,
   and `getLearnDashboard` fetches modules ordered by the MODULE's display_order
   alone — which interleaves categories — so the deck was 32 cards of mixed
   subject matter behind a sideways scroll. The team's feedback was exactly that:
   sideways scrolling, and no sense of which part of the library you were in.

   So: one vertical shelf per category, in the admin's display_order, each with
   its own progress. Colour is unchanged — every card still wears its category's
   Tone (the DESIGN.md §2.4 dashboard exception). Grouping makes that read as
   LESS noise, not more: a shelf is now one colour block instead of six tones
   shuffled together.

   Filters still only say things the data can answer — there is no "Recommended"
   signal in the schema, so there is no Recommended tab. */

type FilterKey = 'all' | 'required' | SubjectStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'required', label: 'Required' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'not-started', label: 'Not started' },
  { key: 'completed', label: 'Completed' },
]

/** "in 5 days" / "today" / "3 days overdue" */
function dueLabel(days: number | null): string {
  if (days == null) return 'Required'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days}d`
}

const shelfKey = (s: SubjectCard) => s.categorySlug || '_other'

export default function SubjectLibrary({ subjects }: { subjects: SubjectCard[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => ({
    all: subjects.length,
    required: subjects.filter(s => s.required).length,
    'not-started': subjects.filter(s => s.status === 'not-started').length,
    'in-progress': subjects.filter(s => s.status === 'in-progress').length,
    completed: subjects.filter(s => s.status === 'completed').length,
  }), [subjects])

  /* Shelf totals come from the WHOLE category, never the filtered subset —
     "you have read 34 of 63 lessons in Onboarding" is a fact about Onboarding,
     and would otherwise change every time someone clicked a filter. */
  const totals = useMemo(() => {
    const m = new Map<string, { subjects: number; lessons: number; done: number; minutes: number }>()
    for (const s of subjects) {
      const k = shelfKey(s)
      const t = m.get(k) ?? { subjects: 0, lessons: 0, done: 0, minutes: 0 }
      t.subjects += 1
      t.lessons += s.lessonCount
      t.done += s.completed
      t.minutes += s.minutes
      m.set(k, t)
    }
    return m
  }, [subjects])

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => {
    let list = subjects
    if (filter === 'required') list = list.filter(s => s.required)
    else if (filter !== 'all') list = list.filter(s => s.status === filter)
    if (q) {
      list = list.filter(s =>
        s.title.toLowerCase().includes(q)
        || s.categoryName.toLowerCase().includes(q)
        || (s.description ?? '').toLowerCase().includes(q))
    }
    return list
  }, [subjects, filter, q])

  /* Shelves keep the incoming order within a category (the module display_order
     the admin set — for the HVAC/R course that order is the syllabus). */
  const shelves = useMemo(() => {
    const bySlug = new Map<string, {
      key: string; name: string; tone: SubjectCard['tone']; order: number; items: SubjectCard[]
    }>()
    for (const s of shown) {
      const k = shelfKey(s)
      let sec = bySlug.get(k)
      if (!sec) {
        sec = { key: k, name: s.categoryName || 'Other', tone: s.tone, order: s.categoryOrder, items: [] }
        bySlug.set(k, sec)
      }
      sec.items.push(s)
    }
    return [...bySlug.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }, [shown])

  /* Pinned only on the default view. Under an explicit filter or a search the
     shelves below already answer the question, and a duplicate would be noise. */
  const dueNow = useMemo(() => {
    if (filter !== 'all' || q) return []
    return subjects
      .filter(s => s.required && s.status !== 'completed')
      .sort((a, b) => (a.required?.daysUntilDue ?? 9e9) - (b.required?.daysUntilDue ?? 9e9))
  }, [subjects, filter, q])

  const filtering = filter !== 'all' || !!q

  return (
    <section className="overflow-hidden rounded-xl border border-hairline bg-surface">

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="px-5 pb-3.5 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[16px] font-[650] tracking-tight text-ink">Library</h2>
          <span className="text-[12.5px] text-ink-muted">
            {counts.all} subjects across {totals.size} categories
          </span>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search subjects…"
                aria-label="Search subjects"
                className="h-8 w-[190px] rounded-lg border border-hairline bg-surface pl-7 pr-7 text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-ink-faint transition-colors hover:text-ink"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <Link
              href="/admin/learn/me"
              className="hidden text-[12.5px] font-medium text-ink-muted transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:inline"
            >
              My progress →
            </Link>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {FILTERS.map(f => {
            const active = filter === f.key
            const n = counts[f.key]
            // An empty Required tab reads as a broken feature, not an empty state.
            if (f.key === 'required' && n === 0) return null
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

          {filtering && (
            <span className="ml-auto text-[12px] tabular-nums text-ink-muted">
              {shown.length} of {counts.all}
            </span>
          )}
        </div>
      </div>

      {/* ── Shelf jump ───────────────────────────────────────────────────
          32 subjects is roughly five screens; this makes the page feel its
          real size and doubles as an at-a-glance map of the library. */}
      {!filtering && shelves.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 border-t border-hairline bg-surface-soft px-5 py-2.5">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            <Layers size={11} /> Jump to
          </span>
          {shelves.map(sh => (
            <a
              key={sh.key}
              href={`#shelf-${sh.key}`}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-surface-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', LEARN_TONE[sh.tone].dot)} />
              {sh.name}
              <span className="tabular-nums text-ink-faint">{sh.items.length}</span>
            </a>
          ))}
        </div>
      )}

      {/* ── Required of you ──────────────────────────────────────────────
          A compact list, NOT tiles. Every subject here also appears in its own
          shelf below, and repeating the full tile a screen apart read as a
          rendering bug rather than a shortcut. */}
      {dueNow.length > 0 && (
        <div className="border-t border-hairline">
          <div className="flex items-baseline gap-2 px-5 pb-2.5 pt-4">
            <h3 className="text-[13.5px] font-[650] tracking-tight text-ink">Required of you</h3>
            <span className="text-[12px] text-ink-muted">{dueNow.length} outstanding</span>
          </div>
          <div className="space-y-1.5 px-5 pb-5">
            {dueNow.map(s => {
              const t = LEARN_TONE[s.tone]
              return (
                <Link
                  key={`req-${s.id}`}
                  href={s.href}
                  className="group flex items-center gap-2.5 rounded-lg border border-hairline bg-surface px-3 py-2.5 transition-colors hover:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', t.dot)} />
                  {/* min-w-0: a flex item defaults to min-width:auto, which stops
                      it shrinking below its content and defeats `truncate`. */}
                  <span className="min-w-0 truncate text-[13px] font-[650] text-ink">{s.title}</span>
                  <span className="hidden min-w-0 truncate text-[12px] text-ink-muted sm:inline">
                    {s.categoryName} · {s.lessonCount} lessons
                  </span>
                  <span className={cn(
                    'ml-auto inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    s.required?.overdue
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                      : 'bg-surface-strong text-ink-secondary',
                  )}>
                    <CalendarClock size={11} /> {dueLabel(s.required?.daysUntilDue ?? null)}
                  </span>
                  <span className="w-9 flex-shrink-0 text-right text-[11.5px] font-semibold tabular-nums text-ink-muted">
                    {s.pct}%
                  </span>
                  <ArrowRight size={14} className="flex-shrink-0 text-ink-faint transition-colors group-hover:text-brand" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Shelves ──────────────────────────────────────────────────── */}
      {shelves.length === 0 ? (
        <p className="border-t border-hairline px-5 py-10 text-center text-[13px] text-ink-muted">
          {q
            ? <>Nothing matches “{query.trim()}”.</>
            : <>Nothing in this filter yet.</>}
        </p>
      ) : (
        shelves.map(sh => {
          const t = LEARN_TONE[sh.tone]
          const tot = totals.get(sh.key) ?? { subjects: 0, lessons: 0, done: 0, minutes: 0 }
          const pct = tot.lessons ? Math.round((tot.done / tot.lessons) * 100) : 0
          return (
            <div key={sh.key} id={`shelf-${sh.key}`} className="scroll-mt-24 border-t border-hairline">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pb-3 pt-4">
                <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', t.dot)} />
                <h3 className="text-[13.5px] font-[650] tracking-tight text-ink">{sh.name}</h3>
                <span className="text-[12px] text-ink-muted">
                  {filtering
                    ? `${sh.items.length} of ${tot.subjects}`
                    : `${tot.subjects}`}
                  {` subject${tot.subjects === 1 ? '' : 's'} · `}
                  {tot.lessons} lessons · {fmtMins(tot.minutes)}
                </span>

                {/* Progress is a property of the CATEGORY, so it's lessons read
                    out of lessons in it — not a completion claim (subjects with
                    a published quiz also need a pass; see subjectIsComplete). */}
                <span className="ml-auto flex items-center gap-2.5">
                  <span className="hidden text-[11.5px] tabular-nums text-ink-muted sm:inline">
                    {tot.done}/{tot.lessons} lessons read
                  </span>
                  <span className={cn('h-1.5 w-24 overflow-hidden rounded-full', t.track)}>
                    <span className={cn('block h-full rounded-full', t.bar)} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 text-right text-[11.5px] font-semibold tabular-nums text-ink">{pct}%</span>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
                {sh.items.map(s => <SubjectTile key={s.id} s={s} />)}
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}

function SubjectTile({ s }: { s: SubjectCard }) {
  const t = LEARN_TONE[s.tone]
  const done = s.status === 'completed'
  const due = s.required && !done ? s.required : null
  /* Every lesson read, but the subject has a published quiz that hasn't been
     passed — so it is NOT complete (subjectIsComplete). Showing a bare "100%"
     there reads as finished and hides the one thing left to do. */
  const quizPending = !done && s.pct === 100 && s.quiz && !s.quiz.passed

  return (
    <Link
      href={s.href}
      className={cn(
        'group relative flex flex-col rounded-xl border p-4 transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        t.card,
      )}
    >
      {/* Title first, always. It is what people scan down a shelf, so anything
          optional above it (a due chip, a Done pill) would knock the titles in
          a row out of line with each other. Status moved below / into the
          progress row for the same reason. */}
      <h4 className="pr-5 text-[14.5px] font-[650] leading-snug tracking-tight text-ink">{s.title}</h4>

      {due && (
        <span className={cn(
          'mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
          due.overdue
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
            : 'bg-white/75 text-ink dark:bg-white/10',
        )}>
          <CalendarClock size={11} /> {dueLabel(due.daysUntilDue)}
        </span>
      )}

      {s.description && (
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-secondary">
          {s.description}
        </p>
      )}

      <div className="mt-auto pt-3.5">
        <div className="mb-2 flex items-center gap-3 text-[11.5px] font-medium text-ink-secondary">
          <span className="inline-flex items-center gap-1"><BookOpen size={11} /> {s.lessonCount} lessons</span>
          <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmtMins(s.minutes)}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className={cn('h-1.5 flex-1 overflow-hidden rounded-full', t.track)}>
            <span className={cn('block h-full rounded-full transition-all', t.bar)} style={{ width: `${s.pct}%` }} />
          </span>
          {done ? (
            <span className={cn('inline-flex flex-shrink-0 items-center gap-1 text-[11.5px] font-semibold', t.accent)}>
              <Check size={12} /> Done
            </span>
          ) : quizPending ? (
            <span className={cn('flex-shrink-0 text-[11.5px] font-semibold', t.accent)}>Quiz left</span>
          ) : (
            <span className="w-8 flex-shrink-0 text-right text-[11.5px] font-semibold tabular-nums text-ink">{s.pct}%</span>
          )}
        </div>
      </div>

      <ArrowRight
        size={15}
        className={cn('absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100', t.accent)}
      />
    </Link>
  )
}
